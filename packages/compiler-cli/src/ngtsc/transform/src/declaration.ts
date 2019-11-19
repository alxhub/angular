/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript';

import {ImportRewriter} from '../../imports';
import {ClassDeclaration} from '../../reflection';
import {ImportManager, translateType} from '../../translator';

import {DtsTransform} from './api';
import {IvyCompilation} from './compilation';
import {addImports} from './utils';

export function declarationTransformFactory(
    transforms: DtsTransform[], importRewriter: ImportRewriter,
    importPrefix?: string): ts.TransformerFactory<ts.Bundle|ts.SourceFile> {
  return (context: ts.TransformationContext) => {
    const transformer = new DtsTransformer(transforms, context, importRewriter, importPrefix);
    return (fileOrBundle) => {
      if (ts.isBundle(fileOrBundle)) {
        // Only attempt to transform source files.
        return fileOrBundle;
      }
      return transformer.transform(fileOrBundle);
    };
  };
}

/**
 * Processes .d.ts file text and adds static field declarations, with types.
 */
class DtsTransformer {
  constructor(
      private transforms: DtsTransform[], private ctx: ts.TransformationContext,
      private importRewriter: ImportRewriter, private importPrefix?: string) {}

  private transformClassDeclaration(clazz: ts.ClassDeclaration, imports: ImportManager):
      ts.ClassDeclaration {
    let elements: ts.ClassElement[]|ReadonlyArray<ts.ClassElement> = clazz.members;
    let elementsChanged: boolean = false;

    for (let i = 0; i < this.transforms.length; i++) {
      const transform = this.transforms[i];

      if (transform.transformClassElement !== undefined) {
        for (let j = 0; j < elements.length; j++) {
          const res = transform.transformClassElement(elements[j], imports);
          if (res !== elements[j]) {
            if (!elementsChanged) {
              elements = [...elements];
              elementsChanged = true;
            }
            (elements as ts.ClassElement[])[j] = res;
          }
        }
      }
    }

    let newClazz: ts.ClassDeclaration = clazz;

    for (let i = 0; i < this.transforms.length; i++) {
      const transform = this.transforms[i];

      // If no DtsTransform has changed the class yet, then the (possibly mutated) elements have not
      // yet been incorporated. Otherwise, `newClazz.members` holds the latest class members.
      const inputMembers = (clazz === newClazz ? elements : newClazz.members);

      if (transform.transformClass !== undefined) {
        newClazz = transform.transformClass(newClazz, inputMembers, imports);
      }
    }

    if (elementsChanged && clazz === newClazz) {
      newClazz = ts.updateClassDeclaration(
          /* node */ clazz,
          /* decorators */ clazz.decorators,
          /* modifiers */ clazz.modifiers,
          /* name */ clazz.name,
          /* typeParameters */ clazz.typeParameters,
          /* heritageClauses */ clazz.heritageClauses,
          /* members */ elements);
    }

    return newClazz;
  }

  /**
   * Transform the declaration file and add any declarations which were recorded.
   */
  transform(sf: ts.SourceFile): ts.SourceFile {
    const imports = new ImportManager(this.importRewriter, this.importPrefix);

    const visitor: ts.Visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
      if (ts.isClassDeclaration(node)) {
        return this.transformClassDeclaration(node, imports);
      } else {
        // Otherwise return node as is.
        return ts.visitEachChild(node, visitor, this.ctx);
      }
    };
    //   // This class declaration needs to have fields added to it.
    //   if (ts.isClassDeclaration(node) && node.name !== undefined &&
    //       this.ivyFields.has(node.name.text)) {
    //     const decls = this.ivyFields.get(node.name.text) !;
    //     const newMembers = decls.map(decl => {
    //       const modifiers = [ts.createModifier(ts.SyntaxKind.StaticKeyword)];
    //       const typeRef = translateType(decl.type, this.imports);
    //       return ts.createProperty(undefined, modifiers, decl.name, undefined, typeRef,
    //       undefined);
    //     });

    //     return ts.updateClassDeclaration(
    //         node, node.decorators, node.modifiers, node.name, node.typeParameters,
    //         node.heritageClauses, [...node.members, ...newMembers]);
    //   }

    //   // Otherwise return node as is.
    //   return ts.visitEachChild(node, visitor, context);
    // };

    // Recursively scan through the AST and add all class members needed.
    sf = ts.visitNode(sf, visitor);

    // Add new imports for this file.
    return addImports(imports, sf);
  }
}

export class IvyDeclarationDtsTransform implements DtsTransform {
  constructor(private compilation: IvyCompilation) {}

  transformClass(
      clazz: ts.ClassDeclaration, members: ReadonlyArray<ts.ClassElement>,
      imports: ImportManager): ts.ClassDeclaration {
    if (clazz.name === undefined) {
      return clazz;
    }

    const original = ts.getOriginalNode(clazz) as ClassDeclaration;

    const fields = this.compilation.getDtsFields(original);
    if (fields === null) {
      return clazz;
    }

    const newMembers = fields.map(decl => {
      const modifiers = [ts.createModifier(ts.SyntaxKind.StaticKeyword)];
      const typeRef = translateType(decl.type, imports);
      return ts.createProperty(
          /* decorators */ undefined,
          /* modifiers */ modifiers,
          /* name */ decl.name,
          /* questionOrExclamationToken */ undefined,
          /* type */ typeRef,
          /* initializer */ undefined);
    });

    return ts.updateClassDeclaration(
        /* node */ clazz,
        /* decorators */ clazz.decorators,
        /* modifiers */ clazz.modifiers,
        /* name */ clazz.name,
        /* typeParameters */ clazz.typeParameters,
        /* heritageClauses */ clazz.heritageClauses,
        /* members */[...members, ...newMembers]);
  }
}