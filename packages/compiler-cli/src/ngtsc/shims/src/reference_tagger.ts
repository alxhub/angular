/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript';

import {absoluteFrom, absoluteFromSourceFile} from '../../file_system';

import {extendSf, isExtended as isExtendedSf, isFileShimSourceFile, NgExtension} from './expando';

/**
 * Manipulates the `referencedFiles` property of `ts.SourceFile`s to add references to shim files
 * for each original source file, causing the shims to be loaded into the program as well.
 */
export class ShimReferenceTagger {
  private suffixes: string[];
  private patchedReferences = new Set<ts.SourceFile>();

  constructor(shimExtensions: string[]) {
    this.suffixes = shimExtensions.map(extension => `.${extension}.ts`);
  }

  /**
   * Tag `sf` with any needed references if it's not a shim itself.
   */
  maybeAddReferences(sf: ts.SourceFile): void {
    const sfPath = absoluteFromSourceFile(sf);
    if (sf.isDeclarationFile || isFileShimSourceFile(sf) || this.suffixes.length === 0) {
      return;
    }

    extendSf(sf);

    sf[NgExtension].originalReferencedFiles = sf.referencedFiles;
    const referencedFiles = [...sf.referencedFiles];

    for (const suffix of this.suffixes) {
      referencedFiles.push({
        fileName: absoluteFrom(sfPath.replace(/\.ts(x)?$/, suffix)),
        pos: 0,
        end: 0,
      });
    }

    sf.referencedFiles = referencedFiles;
    this.patchedReferences.add(sf);
  }

  /**
   * Restore the original `referencedFiles` values of all tagged `ts.SourceFile`s.
   */
  cleanup(): void {
    for (const sf of this.patchedReferences) {
      if (isExtendedSf(sf) && sf[NgExtension].originalReferencedFiles !== null) {
        sf.referencedFiles = sf[NgExtension].originalReferencedFiles! as ts.FileReference[];
      }
    }
    this.patchedReferences.clear();
  }
}
