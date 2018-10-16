/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript';

import {ExportHost} from './export_host';

/**
 * Tracks export relationships (e.g. an NgModule exporting another NgModule or a Directive) to
 * certify that there are no unexported entities which are exposed via exported entities.
 */
export class ExportTracker {

  private exportedViaEntryPoint: Set<ts.Declaration>|undefined = undefined;
  private relationships = new Map<ts.Declaration, ts.Declaration[]>();

  constructor(private exportHost: ExportHost) {}

  addExportRelationship(decl: ts.Declaration, exportedBy: ts.Declaration) {
    console.error(`addExportRelationship(${nameOf(decl)} -> ${nameOf(exportedBy)})`);
    if (!this.relationships.has(decl)) {
      this.relationships.set(decl, [exportedBy]);
    } else {
      this.relationships.get(decl)!.push(exportedBy);
    }
  }

  private isPubliclyVisible(decl: ts.Declaration): boolean {
    // If the declaration is part of the public exports, then yes.
    if (this.exportedViaEntryPoint!.has(decl)) {
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
    if (this.exportedViaEntryPoint === undefined) {
      this.exportedViaEntryPoint = new Set<ts.Declaration>();
      this.exportHost.enumeratePublicExports().forEach(exp => this.exportedViaEntryPoint!.add(exp));
    }
    return Array
      .from(this.relationships.keys())
      .filter(decl => this.isPubliclyVisible(decl))
      .filter(decl => !this.exportedViaEntryPoint!.has(decl));
  }
}

function nameOf(decl: ts.Declaration): string {
  return (decl as ts.ClassDeclaration).name!.text;
}
