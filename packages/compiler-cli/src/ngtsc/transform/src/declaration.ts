/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Type} from '@angular/compiler';
import * as ts from 'typescript';

import {ImportRewriter} from '../../imports';
import {ImportManager, translateType} from '../../translator';

import {CompileResult} from './api';
import {IvyCompilation} from './compilation';
import {addImports} from './utils';



export function declarationTransformFactory(compilation: IvyCompilation):
    ts.TransformerFactory<ts.Bundle|ts.SourceFile> {
  return (context: ts.TransformationContext) => {
    return (fileOrBundle) => {
      if (ts.isBundle(fileOrBundle)) {
        // Only attempt to transform source files.
        return fileOrBundle;
      }
      return compilation.transformedDtsFor(fileOrBundle, context);
    };
  };
}

/**
 * Processes .d.ts file text and adds static field declarations, with types.
 */
export class DtsFileTransformer {
  private ivyFields = new Map<string, CompileResult[]>();
  private typeReplacement = new Map<ts.Declaration, Type>();
  private imports: ImportManager;

  constructor(private importRewriter: ImportRewriter, importPrefix?: string) {
    this.imports = new ImportManager(importRewriter, importPrefix);
  }

  /**
   * Track that a static field was added to the code for a class.
   */
  recordStaticField(name: string, decls: CompileResult[]): void { this.ivyFields.set(name, decls); }

  addTypeReplacement(node: ts.Declaration, type: Type): void {
    this.typeReplacement.set(node, type);
  }

  /**
   * Transform the declaration file and add any declarations which were recorded.
   */
  transform(file: ts.SourceFile, context: ts.TransformationContext): ts.SourceFile {
    const visitor: ts.Visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
      debugger;
      // This class declaration needs to have fields added to it.
      if (ts.isClassDeclaration(node) && node.name !== undefined &&
          this.ivyFields.has(node.name.text)) {
        const decls = this.ivyFields.get(node.name.text) !;
        const newMembers = decls.map(decl => {
          const modifiers = [ts.createModifier(ts.SyntaxKind.StaticKeyword)];
          const typeRef = translateType(decl.type, this.imports);
          return ts.createProperty(undefined, modifiers, decl.name, undefined, typeRef, undefined);
        });

        return ts.updateClassDeclaration(
            node, node.decorators, node.modifiers, node.name, node.typeParameters,
            node.heritageClauses,
            [...node.members.map(member => ts.visitNode(member, visitor)), ...newMembers]);
      } else if (ts.isMethodSignature(node)) {
        const original = ts.getOriginalNode(node) as ts.MethodDeclaration;
        console.error('visit method decl', original.getFullText());
        if (this.typeReplacement.has(original)) {
          const newType = translateType(this.typeReplacement.get(original) !, this.imports);
          return ts.updateMethodSignature(
              node,
              /* typeParameters */ node.typeParameters,
              /* parameters */ node.parameters,
              /* type */ newType,
              /* name */ node.name,
              /* questionToken */ node.questionToken);
        }
      }

      // Otherwise return node as is.
      return ts.visitEachChild(node, visitor, context);
    };

    // Recursively scan through the AST and add all class members needed.
    let sf = ts.visitNode(file, visitor);

    // Add new imports for this file.
    return addImports(this.imports, sf);
  }
}
