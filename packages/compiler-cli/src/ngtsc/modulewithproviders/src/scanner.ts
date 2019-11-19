import {ExpressionType, ExternalExpr, R3Identifiers as Identifiers, Type, WrappedNodeExpr} from '@angular/compiler';
import * as ts from 'typescript';

import {ImportMode, Reference, ReferenceEmitter} from '../../imports';
import {PartialEvaluator} from '../../partial_evaluator';
import {ReflectionHost} from '../../reflection';

export interface DtsHandler { addTypeReplacement(node: ts.Declaration, type: Type): void; }

export class ModuleWithProvidersScanner {
  constructor(
      private host: ReflectionHost, private evaluator: PartialEvaluator,
      private emitter: ReferenceEmitter) {}

  scan(sf: ts.SourceFile, dts: DtsHandler): void {
    console.error('scanning', sf.fileName);
    for (const stmt of sf.statements) {
      this.visitStatement(dts, stmt);
    }
  }

  private visitStatement(dts: DtsHandler, stmt: ts.Statement): void {
    // Detect whether a statement is exported, which is used as one of the hints whether to look
    // more closely at possible MWP functions within. This is a syntactic check, not a semantic
    // check, so it won't detect cases like:
    //
    // var X = ...;
    // export {X}
    //
    // This is intentional, because the alternative is slow and this will catch 99% of the cases we
    // need to handle.
    const isExported = stmt.modifiers !== undefined &&
        stmt.modifiers.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword);

    if (!isExported) {
      console.error('not exported', stmt.getFullText());
      return;
    }

    if (ts.isClassDeclaration(stmt)) {
      console.error('found class', stmt.name !.text);
      for (const member of stmt.members) {
        if (!ts.isMethodDeclaration(member) || !isStatic(member) || !isNamed(member)) {
          continue;
        }

        this.visitFunctionOrMethodDeclaration(dts, member);
      }
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        this.visitVariableDeclaration(decl);
      }
    } else if (ts.isFunctionDeclaration(stmt) && isNamed(stmt)) {
      this.visitFunctionOrMethodDeclaration(dts, stmt);
    }
  }


  private visitVariableDeclaration(decl: ts.VariableDeclaration): void {}

  private visitFunctionOrMethodDeclaration(
      dts: DtsHandler, decl: Named<ts.MethodDeclaration|ts.FunctionDeclaration>): void {
    console.error('visit decl', decl.getFullText());
    // First, some sanity. This should have a method body with a single return statement.
    if (decl.body === undefined || decl.body.statements.length !== 1) {
      console.error('body not right');
      return;
    }
    const retStmt = decl.body.statements[0];
    if (!ts.isReturnStatement(retStmt) || retStmt.expression === undefined) {
      console.error('body stmt not right');
      return;
    }
    const retValue = retStmt.expression;

    // Now, look at the return type of the method. Maybe bail if the type is already marked, or if
    // it's incompatible with a MWP function.
    const returnType = this.returnTypeOf(decl);
    if (returnType === ReturnType.OTHER || returnType === ReturnType.MWP_WITH_TYPE) {
      // Don't process this declaration, it either already declares the right return type, or an
      // incompatible one.
      console.error('return type not right');
      return;
    }

    const value = this.evaluator.evaluate(retValue);
    if (value instanceof Map && value.has('ngModule')) {
      // Definitively a MWP.
      const ngModule = value.get('ngModule');
      if (!(ngModule instanceof Reference) || !ts.isClassDeclaration(ngModule.node)) {
        throw new Error(`Expected Reference?`);
      }

      debugger;

      const ngModuleExpr =
          this.emitter.emit(ngModule, decl.getSourceFile(), ImportMode.ForceNewImport);
      const ngModuleType = new ExpressionType(ngModuleExpr);

      const mwpNgType = new ExpressionType(
          new ExternalExpr(Identifiers.ModuleWithProviders), null, [ngModuleType]);


      dts.addTypeReplacement(decl, mwpNgType);
      console.error('record type replacement');
    } else if (returnType === ReturnType.MWP_NO_TYPE) {
      throw new Error(`Should be a MWP type, but could not resolve?`);
    } else {
      // Not a MWP function after all.
      console.error('not mwp', value);
      return;
    }
  }

  private returnTypeOf(decl: ts.FunctionDeclaration|ts.MethodDeclaration|
                       ts.VariableDeclaration): ReturnType {
    if (decl.type === undefined) {
      return ReturnType.INFERRED;
    } else if (!ts.isTypeReferenceNode(decl.type)) {
      return ReturnType.OTHER;
    }

    // Try to figure out if the type is of a familiar form, something that looks like it was
    // imported.
    let typeId: ts.Identifier;
    if (ts.isIdentifier(decl.type.typeName)) {
      // def: ModuleWithProviders
      typeId = decl.type.typeName;
    } else if (ts.isQualifiedName(decl.type.typeName) && ts.isIdentifier(decl.type.typeName.left)) {
      // def: i0.ModuleWithProviders
      typeId = decl.type.typeName.right;
    } else {
      return ReturnType.OTHER;
    }

    const importDecl = this.host.getImportOfIdentifier(typeId);
    if (importDecl === null || importDecl.from !== '@angular/core' ||
        importDecl.name !== 'ModuleWithProviders') {
      return ReturnType.OTHER;
    }

    if (decl.type.typeArguments === undefined || decl.type.typeArguments.length === 0) {
      // The return type is indeed ModuleWithProviders, but no generic type parameter was found.
      return ReturnType.MWP_NO_TYPE;
    } else {
      // The return type is ModuleWithProviders, and the user has already specified a generic type.
      return ReturnType.MWP_WITH_TYPE;
    }
  }
}

enum ReturnType {
  INFERRED,
  MWP_NO_TYPE,
  MWP_WITH_TYPE,
  OTHER,
}

function isStatic(node: ts.Node): boolean {
  return node.modifiers !== undefined &&
      node.modifiers.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword);
}

type Named<T extends ts.Declaration> = T & {name: ts.Identifier};

function isNamed<T extends ts.Declaration>(value: T): value is Named<T> {
  const typedValue: T&{name?: ts.Node} = value;
  return typedValue.name !== undefined && ts.isIdentifier(typedValue.name);
}
