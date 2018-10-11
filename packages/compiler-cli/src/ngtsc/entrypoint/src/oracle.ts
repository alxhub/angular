/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript';

export interface EntryPointOracle {
  getExportedAs(decl: ts.Declaration): string|null;
}

export class ProgramEntryPointOracle implements EntryPointOracle {

  private map: Map<ts.Declaration, string>|undefined = undefined;

  constructor(private entryPoints: ts.SourceFile[], private checker: ts.TypeChecker) {}

  getExportedAs(decl: ts.Declaration): string|null {
    return this.populateMap().get(decl) || null;
  }

  private populateMap(): Map<ts.Declaration, string> {
    if (this.map === undefined) {
      this.map = new Map<ts.Declaration, string>();
        this
        .entryPoints
        .map(entryPoint => this.checker.getSymbolAtLocation(entryPoint))
        .filter(isNotUndefined)
        .forEach(entryPoint => {
          this
          .checker
          .getExportsOfModule(entryPoint)
          .filter(exportSym => exportSym.valueDeclaration !== undefined)
          .forEach(exportSym => {
            this.map!.set(exportSym.valueDeclaration, exportSym.name);
          });
        });
    }
    return this.map;
  }
}

function isNotUndefined<T>(value: T): value is Exclude<T, undefined> {
  return value !== undefined;
}
