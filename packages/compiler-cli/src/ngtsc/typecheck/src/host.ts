/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript';

import {absoluteFrom, absoluteFromSourceFile, resolve} from '../../file_system';
import {copyFileShimData, ShimReferenceTagger} from '../../shims';

import {TypeCheckContext} from './context';
import {TypeCheckShimGenerator} from './shim';



/**
 * A `ts.CompilerHost` which augments source files with type checking code from a
 * `TypeCheckContext`.
 */
export class TypeCheckProgramHost implements ts.CompilerHost {
  /**
   * Map of source file names to `ts.SourceFile` instances.
   */
  private sfMap: Map<string, ts.SourceFile>;


  private shimReferenceHostAdapter = new ShimReferenceTagger(this.shimExtensionPrefixes);

  readonly resolveModuleNames?: ts.CompilerHost['resolveModuleNames'];

  constructor(
      sfMap: Map<string, ts.SourceFile>, private delegate: ts.CompilerHost,
      private shimExtensionPrefixes: string[]) {
    this.sfMap = sfMap;

    if (delegate.getDirectories !== undefined) {
      this.getDirectories = (path: string) => delegate.getDirectories!(path);
    }

    if (delegate.resolveModuleNames !== undefined) {
      this.resolveModuleNames = delegate.resolveModuleNames;
    }
  }

  getSourceFile(
      fileName: string, languageVersion: ts.ScriptTarget,
      onError?: ((message: string) => void)|undefined,
      shouldCreateNewSourceFile?: boolean|undefined): ts.SourceFile|undefined {
    const delegateSf =
        this.delegate.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)!;
    if (delegateSf === undefined) {
      throw new Error(
          `AssertionError: TypeCheckProgramHost could not find contents for ${fileName}`);
    }

    // Look for replacements.
    let sf: ts.SourceFile;
    if (this.sfMap.has(fileName)) {
      sf = this.sfMap.get(fileName)!;
      copyFileShimData(delegateSf, sf);
    } else {
      const maybeSf = this.delegate.getSourceFile(
          fileName, languageVersion, onError, shouldCreateNewSourceFile);
      if (maybeSf === undefined) {
        throw new Error(
            `AssertionError: TypeCheckProgramHost could not find contents for ${fileName}`);
      }
      sf = maybeSf;
    }
    // TypeScript doesn't allow returning redirect source files. To avoid unforseen errors we
    // return the original source file instead of the redirect target.
    const redirectInfo = (sf as any).redirectInfo;
    if (redirectInfo !== undefined) {
      sf = redirectInfo.unredirected;
    }

    this.shimReferenceHostAdapter.maybeAddReferences(sf);

    return sf;
  }

  cleanup(): void {
    this.shimReferenceHostAdapter.cleanup();
  }

  // The rest of the methods simply delegate to the underlying `ts.CompilerHost`.

  getDefaultLibFileName(options: ts.CompilerOptions): string {
    return this.delegate.getDefaultLibFileName(options);
  }

  writeFile(
      fileName: string, data: string, writeByteOrderMark: boolean,
      onError: ((message: string) => void)|undefined,
      sourceFiles: ReadonlyArray<ts.SourceFile>|undefined): void {
    throw new Error(`TypeCheckProgramHost should never write files`);
  }

  getCurrentDirectory(): string {
    return this.delegate.getCurrentDirectory();
  }

  getDirectories?: (path: string) => string[];

  getCanonicalFileName(fileName: string): string {
    return this.delegate.getCanonicalFileName(fileName);
  }

  useCaseSensitiveFileNames(): boolean {
    return this.delegate.useCaseSensitiveFileNames();
  }

  getNewLine(): string {
    return this.delegate.getNewLine();
  }

  fileExists(fileName: string): boolean {
    return this.sfMap.has(fileName) || this.delegate.fileExists(fileName);
  }

  readFile(fileName: string): string|undefined {
    return this.delegate.readFile(fileName);
  }
}