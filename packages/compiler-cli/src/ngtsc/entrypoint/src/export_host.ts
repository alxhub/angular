/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript';

import {resolveAliasedSymbol} from './util';

export interface ExportHost {
  getExportedAs(decl: ts.Declaration): string|null;
  enumeratePublicExports(): ts.Declaration[];  
}

export class EntryPointExportHost implements ExportHost {

  private map: Map<ts.Declaration, string>|undefined = undefined;

  constructor(private entryPoint: ts.SourceFile, private checker: ts.TypeChecker) {}

  getExportedAs(decl: ts.Declaration): string|null {
    return this.populateMap().get(decl) || null;
  }

  enumeratePublicExports(): ts.Declaration[] {
    return Array.from(this.populateMap().keys());
  }

  private populateMap(): Map<ts.Declaration, string> {
    if (this.map === undefined) {
      const entryPointSymbol = this.checker.getSymbolAtLocation(this.entryPoint)!;
      this.map = new Map<ts.Declaration, string>();
      this
        .checker
        .getExportsOfModule(entryPointSymbol)
        .map(exportSymbol => ({
          exportSymbol,
          valueSymbol: resolveAliasedSymbol(exportSymbol, this.checker),
        }))
        .forEach(({exportSymbol, valueSymbol}) => {
          if (valueSymbol.valueDeclaration !== undefined) {
            this.map!.set(valueSymbol.valueDeclaration, exportSymbol.name);
          }
        });
    }
    return this.map;
  }
}

/**
 * An `ExportHost` for applications without public exports.
 */
export class NoExportsExportHost implements ExportHost {
  getExportedAs(decl: ts.Declaration): string|null {
    return null;
  }

  enumeratePublicExports(): ts.Declaration[] {
    return [];
  }
}

function isNotUndefined<T>(value: T): value is Exclude<T, undefined> {
  return value !== undefined;
}
