/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {WrappedNodeExpr} from '@angular/compiler';
import * as ts from 'typescript';

import {VisitListEntryResult, Visitor, visit} from '../../util/src/visitor';

import {CompileResult} from './api';
import {IvyCompilation} from './compilation';
import {ImportManager, translateExpression, translateStatement} from './translator';
import {ReflectionHost, Decorator} from '../../host';

const NO_DECORATORS = new Set<ts.Decorator>();

export function ivyTransformFactory(compilation: IvyCompilation, reflector: ReflectionHost):
    ts.TransformerFactory<ts.SourceFile> {
  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (file: ts.SourceFile): ts.SourceFile => {
      return transformIvySourceFile(compilation, context, reflector, file);
    };
  };
}

class IvyVisitor extends Visitor {
  constructor(private compilation: IvyCompilation, private reflector: ReflectionHost, private importManager: ImportManager) {
    super();
  }

  visitClassDeclaration(node: ts.ClassDeclaration):
      VisitListEntryResult<ts.Statement, ts.ClassDeclaration> {
    // Determine if this class has an Ivy field that needs to be added, and compile the field
    // to an expression if so.
    const res = this.compilation.compileIvyFieldFor(node);

    if (res !== undefined) {
      // There is at least one field to add.
      const statements: ts.Statement[] = [];
      const members = [...node.members];

      res.forEach(field => {
        // Translate the initializer for the field into TS nodes.
        const exprNode = translateExpression(field.initializer, this.importManager);

        // Create a static property declaration for the new field.
        const property = ts.createProperty(
            undefined, [ts.createToken(ts.SyntaxKind.StaticKeyword)], field.name, undefined,
            undefined, exprNode);

        field.statements.map(stmt => translateStatement(stmt, this.importManager))
            .forEach(stmt => statements.push(stmt));

        members.push(property);
      });

      // Replace the class declaration with an updated version.
      node = ts.updateClassDeclaration(
          node,
          // Remove the decorator which triggered this compilation, leaving the others alone.
          maybeFilterDecorator(
              node.decorators, this.compilation.ivyDecoratorFor(node) !.node as ts.Decorator),
          node.modifiers, node.name, node.typeParameters, node.heritageClauses || [],
          members.map(member => this._stripAngularDecorators(member)));
      return {node, before: statements};
    }

    return {node};
  }

  private _angularCoreDecorators(decl: ts.Declaration): Set<ts.Decorator> {
    const decorators = this.reflector.getDecoratorsOfDeclaration(decl);
    if (decorators === null) {
      return NO_DECORATORS;
    }
    const coreDecorators = decorators
      .filter(isAngularCore)
      .map(dec => dec.node as ts.Decorator);
    if (coreDecorators.length > 0) {
      return new Set<ts.Decorator>(coreDecorators);
    } else {
      return NO_DECORATORS;
    }
  }

  private _nonCoreDecoratorsOnly(node: ts.Declaration): ts.NodeArray<ts.Decorator>|undefined {
    
    console.error(`Looking at decorators of node: ${ts.SyntaxKind[node.kind]}`);
    if (node.decorators === undefined) {
      console.error('There are none.');
      return undefined;
    }
    const coreDecorators = this._angularCoreDecorators(node);
    if (coreDecorators.size === node.decorators.length) {
      console.error(`Removing all ${coreDecorators.size} decorators`);
      return undefined;
    } else if (coreDecorators.size === 0) {
      console.error('No decorators to remove');
      return node.decorators;
    }
    const filtered = node.decorators.filter(dec => !coreDecorators.has(dec));
    if (filtered.length === 0) {
      console.error('No decorators left');
      return undefined;
    }
    const array = ts.createNodeArray(filtered);
    array.pos = node.decorators.pos;
    array.end = node.decorators.end;
    console.error(`Removed ${node.decorators.length - array.length} decorators`);
    return array;
  }

  private _stripAngularDecorators<T extends ts.Node>(node: T): T {
    console.error(`Processing node of type ${ts.SyntaxKind[node.kind]}`);
    if (ts.isPropertyDeclaration(node) && node.decorators !== undefined) {
      node = ts.updateProperty(
        node,
        this._nonCoreDecoratorsOnly(node),
        node.modifiers,
        node.name,
        node.questionToken,
        node.type,
        node.initializer
      ) as T & ts.PropertyDeclaration;
    } else if (ts.isConstructorDeclaration(node)) {
      const parameters = node
        .parameters
        .map(param => this._stripAngularDecorators(param));

      node = ts.updateConstructor(
        node,
        node.decorators,
        node.modifiers,
        parameters,
        node.body
      ) as T & ts.ConstructorDeclaration;
    } else if (ts.isGetAccessor(node)) {
      node = ts.updateGetAccessor(
        node,
        this._nonCoreDecoratorsOnly(node),
        node.modifiers,
        node.name,
        node.parameters,
        node.type,
        node.body
      ) as T & ts.GetAccessorDeclaration;
    } else if (ts.isSetAccessor(node)) {
      node = ts.updateSetAccessor(
        node,
        this._nonCoreDecoratorsOnly(node),
        node.modifiers,
        node.name,
        node.parameters,
        node.body
      ) as T & ts.SetAccessorDeclaration;
    }
    return node;
  }
}

/**
 * A transformer which operates on ts.SourceFiles and applies changes from an `IvyCompilation`.
 */
function transformIvySourceFile(
    compilation: IvyCompilation, context: ts.TransformationContext,
    reflector: ReflectionHost, file: ts.SourceFile): ts.SourceFile {
  const importManager = new ImportManager();

  // Recursively scan through the AST and perform any updates requested by the IvyCompilation.
  const sf = visit(file, new IvyVisitor(compilation, reflector, importManager), context);

  // Generate the import statements to prepend.
  const imports = importManager.getAllImports().map(
      i => ts.createImportDeclaration(
          undefined, undefined,
          ts.createImportClause(undefined, ts.createNamespaceImport(ts.createIdentifier(i.as))),
          ts.createLiteral(i.name)));

  // Prepend imports if needed.
  if (imports.length > 0) {
    sf.statements = ts.createNodeArray([...imports, ...sf.statements]);
  }
  return sf;
}

function maybeFilterDecorator(
    decorators: ts.NodeArray<ts.Decorator>| undefined,
    toRemove: ts.Decorator): ts.NodeArray<ts.Decorator>|undefined {
  if (decorators === undefined) {
    return undefined;
  }
  const filtered = decorators.filter(dec => ts.getOriginalNode(dec) !== toRemove);
  if (filtered.length === 0) {
    return undefined;
  }
  return ts.createNodeArray(filtered);
}

function isAngularCore(decorator: Decorator): boolean {
  return decorator.import !== null && decorator.import.from === '@angular/core';
}
