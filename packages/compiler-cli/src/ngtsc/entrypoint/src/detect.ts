/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/// <reference types="node" />

import * as path from 'path';

const INDEX_TS = path.sep + 'index.ts';

export function inferEntryPoint(rootFiles: ReadonlyArray<string>): string|null {
  if (rootFiles.length === 1 && !rootFiles[0].endsWith('.d.ts')) {
    return rootFiles[0];
  } else {
    return rootFiles
      .filter(file => file.endsWith(INDEX_TS))
      .reduce((entryPointCandidate, rootFile) => {
        if (entryPointCandidate === null || rootFile.length < entryPointCandidate.length) {
          return rootFile;
        } else {
          return entryPointCandidate;
        }
      }, null as string|null);
  }
}
