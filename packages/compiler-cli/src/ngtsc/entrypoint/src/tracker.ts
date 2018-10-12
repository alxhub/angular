/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript';

/**
 * Tracks export relationships (e.g. an NgModule exporting another NgModule or a Directive) to
 * certify that there are no unexported entities which are exposed via exported entities.
 */
export class ExportTracker {

  private publicExports = new Set<ts.Declaration>();
  private relationships = new Map<ts.Declaration, ts.Declaration[]>();

  addTopLevelExport(decl: ts.Declaration) {
    if (ts.isClassDeclaration(decl) && decl.name !== undefined) {
      console.error('Add top level export', decl.name.text);
    }
    this.publicExports.add(decl);
  }

  addExportRelationship(decl: ts.Declaration, exportedBy: ts.Declaration) {
    console.error(`addExportRelationship(${nameOf(decl)} -> ${nameOf(exportedBy)})`);
    if (!this.relationships.has(decl)) {
      this.relationships.set(decl, [exportedBy]);
    } else {
      this.relationships.get(decl)!.push(exportedBy);
    }
  }

  isPubliclyVisible(decl: ts.Declaration): boolean {
    if (ts.isClassDeclaration(decl) && decl.name) {
      console.error('checking public exports for', decl.name.text);
    }
    // If the declaration is part of the public exports, then yes.
    if (this.publicExports.has(decl)) {
      return true;
    }

    // If it's not referenced to by anything else, then no.
    if (!this.relationships.has(decl)) {
      return false;
    }

    // Otherwise, it's exported if at least one thing which refers to it is exported.
    return this.relationships.get(decl)!.some(upstream => this.isPubliclyVisible(upstream));
  }

  scanForPrivateExports(): ts.Declaration[] {
    return Array
      .from(this.relationships.keys())
      .filter(decl => this.isPubliclyVisible(decl))
      .filter(decl => !this.publicExports.has(decl));
  }
}

export function getTopLevelExports(entryPoint: ts.SourceFile, checker: ts.TypeChecker): ts.Declaration[] {
  const entrySymbol = checker.getSymbolAtLocation(entryPoint);
  if (entrySymbol === undefined) {
    throw new Error(`No symbol for entrypoint ${entryPoint.fileName}`);
  }
  return checker
    .getExportsOfModule(entrySymbol)
    .map(symbol => symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol)
    .filter(exportSym => exportSym.valueDeclaration !== undefined)
    .map(exportSym => exportSym.valueDeclaration);    
}

function nameOf(decl: ts.Declaration): string {
  return (decl as ts.ClassDeclaration).name!.text;
}
