/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript';

import {absoluteFrom, absoluteFromSourceFile, AbsoluteFsPath} from '../../file_system';
import {PerFileShimGenerator, TopLevelShimGenerator} from '../api';

import {extendSf, isFileShimSourceFile, NgExtension, NgFileShimSourceFile} from './expando';
import {ShimReferenceTagger} from './reference_tagger';

/**
 * Generates and tracks shim files for each original `ts.SourceFile`.
 *
 * The `ShimHostAdapter` provides an API that's designed to be used by a `ts.CompilerHost`
 * implementation and allow it to include synthetic "shim" files in the program that's being
 * created. It works for both freshly created programs as well as with reuse of an older program
 * (which already may contain shim files and thus have a different creation flow).
 */
export class ShimHostAdapter {
  /**
   * A map of shim file names to the `ts.SourceFile` generated for those shims.
   */
  private shimMap = new Map<AbsoluteFsPath, ts.SourceFile>();

  /**
   * A map of shim file names to existing shims which were part of a previous iteration of this
   * program.
   *
   * Not all of these shims will be inherited into this program.
   */
  private priorShimMap: Map<AbsoluteFsPath, NgFileShimSourceFile>|null;

  /**
   * Tracks which original files have been processed and had shims generated if necessary.
   *
   * This is used to avoid generating shims twice for the same file.
   */
  private checkedForShimGeneration = new Set<ts.SourceFile>();

  /**
   * Mapping of `PerFileShimGenerator` to a processed form of its file extension.
   *
   * For example, if a shim generator declares its extension prefix to be 'ngfactory', this map will
   * associate it with the string '.ngfactory.ts'. This is used to avoid excessive string
   * concatenation inside the shim processing loops.
   */
  private shimToExtension = new Map<PerFileShimGenerator, string>();

  /**
   * Mapping of extension prefix to the `PerFileShimGenerator` responsible for it.
   *
   * When a shim is present in a previous program, it carries a tag with the extension prefix of its
   * generator. This map allows reconciliation of that tag with the current generator responsible
   * for that shim.
   */
  private extensionToShim = new Map<string, PerFileShimGenerator>();

  /**
   * A list of extra filenames which should be considered inputs to program creation.
   *
   * This includes any top-level shims generated for the program.
   */
  readonly extraInputFiles: string[] = [];

  /**
   * A `Set` of shim `ts.SourceFile`s which should not be emitted.
   */
  readonly ignoreForEmit = new Set<ts.SourceFile>();

  /**
   * The `ShimReferenceTagger` used internally to tag original `ts.SourceFile`s with their shims,
   * and ensure all necessary shims are loaded into the program.
   */
  private referenceTagger =
      new ShimReferenceTagger(this.perFileShims.map(shim => shim.extensionPrefix));

  private constructor(
      topLevelShims: TopLevelShimGenerator[], private perFileShims: PerFileShimGenerator[],
      priorShimMap: Map<AbsoluteFsPath, NgFileShimSourceFile>|null) {
    this.priorShimMap = priorShimMap;

    // Prepopulate `shimMap` with the top-level shims, and add them to the program's `inputFiles`
    // explicitly.
    for (const shim of topLevelShims) {
      const shimSf = shim.makeTopLevelShim();
      extendSf(shimSf);
      shimSf[NgExtension].isTopLevelShim = true;
      this.shimMap.set(absoluteFromSourceFile(shimSf), shimSf);
      this.extraInputFiles.push(shimSf.fileName);

      // If the shim is not supposed to be emitted, add it to the ignore set.
      if (!shim.shouldEmit) {
        this.ignoreForEmit.add(shimSf);
      }
    }

    // Populate the extension-to-shim and v/v maps.
    for (const shim of this.perFileShims) {
      this.shimToExtension.set(shim, `.${shim.extensionPrefix}.ts`);
      this.extensionToShim.set(shim.extensionPrefix, shim);
    }
  }

  /**
   * Extension prefixes for all per-file shims present in this adapter.
   */
  get extensionPrefixes(): string[] {
    return this.perFileShims.map(shim => shim.extensionPrefix);
  }

  /**
   * Check whether the given path represents a shim which has been either generated for an original
   * file, or adopted from the previous program.
   */
  isAddedShim(path: AbsoluteFsPath): boolean {
    // This check only picks up on shims which have already been processed via either `maybeGetShim`
    // or `maybeAddShims`. Without knowing the full set of `ts.SourceFile`s in the program, it's
    // difficult to know here whether the given path represents a theoretically _valid_ shim path or
    // not. Fortunately, TypeScript seems to call host methods in a way that this question does not
    // need to be answered.
    //
    return this.shimMap.has(path);
  }

  /**
   * Retrieve the shim `ts.SourceFile` for `path`, if `path` represents a valid shim file for the
   * current program.
   *
   * If the program being created is fresh (no prior program exists), this method can only be called
   * after `maybeAddShims` has added the shim being requested to some original file (otherwise
   * TypeScript would have no knowledge of the shim path).
   *
   * If a prior program exists, `maybeGetShim` can be called for a shim path which did exist in the
   * previous program, even if `maybeAddShims` has not yet been called for that original file.
   *
   * @returns the shim `ts.SourceFile` if one exists, `null` if `path` does not represent a shim, or
   * `undefined` if `path` represents a shim that's no longer present in the program (that is, a
   * a prior shim existed under this path, but the original file has since been removed).
   */
  maybeGetShim(
      path: AbsoluteFsPath, getSourceFileDelegate: (fileName: string) => ts.SourceFile | undefined):
      ts.SourceFile|null|undefined {
    // Shims are only generated for .ts files, so short-circuit the logic here for typings.
    if (path.endsWith('.d.ts')) {
      return null;
    }

    // First, check whether this shim has been generated via maybeAddShims, or has been encountered
    // before.
    if (this.shimMap.has(path)) {
      // Yes, this path has a known shim which has already been generated. Return it.
      return this.shimMap.get(path)!;
    }

    // Either:
    // 1) this file is a shim which previously existed in a prior program, and thus is being
    //    requested before its addition via maybeAddShims(), or
    // 2) this file is not a shim, regardless of its existence in the previous program
    if (this.priorShimMap === null || !this.priorShimMap.has(path)) {
      // This file is not a shim, so nothing to do here.
      return null;
    }

    const priorShimSf = this.priorShimMap.get(path)!;

    // priorShimSf is a shim from the previous program. There's no way it could be present in the
    // delegate otherwise. Try to find the responsible generator.
    const shimData = priorShimSf[NgExtension].fileShim;

    const originalFile = getSourceFileDelegate(shimData.generatedFrom);
    if (originalFile === undefined) {
      // The shim's original file is no longer part of the original program, so the shim should be
      // removed as well.
      return undefined;
    }

    if (!this.extensionToShim.has(shimData.extension)) {
      // No generator supports this extension. This shim should be passed through unaltered - it's
      // effectively a part of the original program now.
      return null;
    }

    const shim = this.extensionToShim.get(shimData.extension)!;

    // Even though the prior shim exists, the generator may want to replace it with a freshly
    // generated file, so call `generateShimForFile` again.
    const shimSf = shim.generateShimForFile(originalFile, path, priorShimSf);

    // Patch the shim with fileShim data.
    extendSf(shimSf);
    shimSf[NgExtension].fileShim = shimData;

    this.shimMap.set(path, shimSf);

    if (!shim.shouldEmit) {
      this.ignoreForEmit.add(shimSf);
    }

    return shimSf;
  }

  /**
   * Generate any necessary shims for the given file, if it's an original file.
   */
  maybeAddShims(sf: ts.SourceFile, sfPath: AbsoluteFsPath = absoluteFromSourceFile(sf)): void {
    // Only generate shims if:
    // 1) the file is not a .d.ts file
    // 2) there are shims to be generated
    // 3) the file has not previously had shims generated for it (that is, `getSourceFile` should be
    //    idempotent with respect to shim generation).
    // 4) the file is not a shim itself
    if (sf.isDeclarationFile || this.perFileShims.length === 0 ||
        this.checkedForShimGeneration.has(sf) || isFileShimSourceFile(sf)) {
      // Nothing to do here.
      return;
    }

    // The file is an original file, and might need shims generated for it.
    for (const shim of this.perFileShims) {
      const extension = this.shimToExtension.get(shim)!;
      const shimFileName = absoluteFrom(sfPath.replace(/\.tsx?$/, extension));
      let shimSf: ts.SourceFile;

      // If no shim has been generated previously for this path, attempt to generate one now. It
      // might previously have been generated by maybeGetShim() if:
      // - a prior program existed which had the shim, and
      // - TypeScript requested the shim before the original file.
      if (!this.shimMap.has(shimFileName)) {
        // No shim has been generated previously, but a prior program might still have had a version
        // of the requested shim, so check first.
        let priorShimSf: ts.SourceFile|null = null;
        if (this.priorShimMap !== null && this.priorShimMap.has(shimFileName)) {
          priorShimSf = this.priorShimMap.get(shimFileName)!;
        }

        shimSf = shim.generateShimForFile(sf, shimFileName, priorShimSf);
        this.shimMap.set(shimFileName, shimSf);

        extendSf(shimSf);
        shimSf[NgExtension].fileShim = {
          extension: shim.extensionPrefix,
          generatedFrom: sfPath,
        };

        if (!shim.shouldEmit) {
          this.ignoreForEmit.add(shimSf);
        }
      }
    }

    // Track this original file as having shims now, so they aren't generated again.
    this.checkedForShimGeneration.add(sf);

    // The last step is to tag the original file with TypeScript references, which causes TS to load
    // the shims into the program alongside the file.
    this.referenceTagger.maybeAddReferences(sf);
  }

  /**
   * After program creation, cleans up any state which is no longer needed.
   *
   * This helps to ensure cache integrity (if any `ts.SourceFile`s are cached) as well as memory
   * efficiency.
   */
  cleanup(): void {
    this.referenceTagger.cleanup();

    // Explicitly free the `priorShimMap` if it exists, which will allow any unused shims from the
    // previous program to be garbage collected.
    if (this.priorShimMap !== null) {
      this.priorShimMap = null;
    }
  }

  /**
   * Construct a `ShimHostAdapter` from a set of shims as well as possibly a previous program.
   */
  static create(
      topLevelShims: TopLevelShimGenerator[], perFileShims: PerFileShimGenerator[],
      oldProgram: ts.Program|null): ShimHostAdapter {
    let priorShimMap: Map<AbsoluteFsPath, NgFileShimSourceFile>|null = null;
    if (oldProgram !== null) {
      // Rather than save the old program entirely in the ShimHostAdapter (which might retain a lot
      // of memory), build a map of only those files which represent shims that might be inherited.
      priorShimMap = new Map<AbsoluteFsPath, NgFileShimSourceFile>();
      for (const sf of oldProgram.getSourceFiles()) {
        if (sf.isDeclarationFile) {
          continue;
        }

        if (isFileShimSourceFile(sf)) {
          priorShimMap.set(absoluteFromSourceFile(sf), sf);
        }
      }
    }
    return new ShimHostAdapter(topLevelShims, perFileShims, priorShimMap);
  }
}
