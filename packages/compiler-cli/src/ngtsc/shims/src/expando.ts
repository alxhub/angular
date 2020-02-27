/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript';
import {AbsoluteFsPath} from '../../file_system';

export const NgExtension = Symbol('NgExtension');

/**
 * Contents of the `NgExtension` property of a `ts.SourceFile`.
 */
export interface NgExtensionData {
  isTopLevelShim: boolean;
  fileShim: NgFileShimData|null;
  originalReferencedFiles: ReadonlyArray<ts.FileReference>|null;
}

/**
 * A `ts.SourceFile` which may or may not have `NgExtension` data.
 */
interface MaybeNgExtendedSourceFile extends ts.SourceFile {
  [NgExtension]?: NgExtensionData;
}

/**
 * A `ts.SourceFile` which has `NgExtension` data.
 */
export interface NgExtendedSourceFile extends ts.SourceFile {
  /**
   * Overrides the type of `referencedFiles` to be writeable.
   */
  referencedFiles: ts.FileReference[];

  [NgExtension]: NgExtensionData;
}

/**
 * Narrows a `ts.SourceFile` if it has an `NgExtension` property.
 */
export function isExtended(sf: ts.SourceFile): sf is NgExtendedSourceFile {
  return (sf as MaybeNgExtendedSourceFile)[NgExtension] !== undefined;
}

export function extendSf(sf: ts.SourceFile): asserts sf is NgExtendedSourceFile {
  const extSf = sf as MaybeNgExtendedSourceFile;
  if (extSf[NgExtension] !== undefined) {
    return;
  }

  extSf[NgExtension] = {
    isTopLevelShim: false,
    fileShim: null,
    originalReferencedFiles: null,
  };
}

export interface NgFileShimData {
  generatedFrom: AbsoluteFsPath;
  extension: string;
}

export interface NgFileShimSourceFile extends NgExtendedSourceFile {
  [NgExtension]: NgExtensionData&{
    fileShim: NgFileShimData,
  };
}

export function isFileShimSourceFile(sf: ts.SourceFile): sf is NgFileShimSourceFile {
  return isExtended(sf) && sf[NgExtension].fileShim !== null;
}

export function isShim(sf: ts.SourceFile): boolean {
  return isExtended(sf) && (sf[NgExtension].fileShim !== null || sf[NgExtension].isTopLevelShim);
}
