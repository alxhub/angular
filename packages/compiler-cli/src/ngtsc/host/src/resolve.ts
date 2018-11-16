/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript';

export class ModuleResolver {
  constructor(private program: ts.Program, private compilerOptions: ts.CompilerOptions, private host: ts.CompilerHost) {}

  resolveModuleName(module: string, containingFile: ts.SourceFile): ts.SourceFile|null {
    const resolved = ts.resolveModuleName(module, containingFile.fileName, this.compilerOptions, this.host).resolvedModule;
    if (resolved === undefined) {
      return null;
    }
    return this.program.getSourceFile(resolved.resolvedFileName) || null;
  }
}
