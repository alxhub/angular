import {DYNAMIC_TYPE, ExpressionType, ExternalExpr, Type} from '@angular/compiler';
import * as ts from 'typescript';

import {NOOP_DEFAULT_IMPORT_RECORDER, Reference, ReferenceEmitter} from '../../imports';
import {ClassDeclaration} from '../../reflection';
import {ImportManager, translateExpression, translateType} from '../../translator';

import {TypeCheckableDirectiveMeta, TypeCheckingConfig, TypeCtorMetadata} from './api';
import {TypeCheckContext} from './context';
import {tsDeclareVariable} from './ts_util';
import {generateTypeCtorDeclarationFn, requiresInlineTypeCtor} from './type_constructor';

export class Environment {
  private nextIds = {
    pipeInst: 1,
    typeCtor: 1,
  };

  private typeCtors = new Map<ClassDeclaration, ts.Expression>();
  protected typeCtorStatements: ts.Statement[] = [];

  private pipeInsts = new Map<ClassDeclaration, ts.Expression>();
  protected pipeInstStatements: ts.Statement[] = [];

  constructor(
      readonly config: TypeCheckingConfig, protected importManager: ImportManager,
      private refEmitter: ReferenceEmitter, protected contextFile: ts.SourceFile) {}

  /**
   * Get an expression referring to a type constructor for the given directive.
   *
   * Depending on the shape of the directive itself, this could be either a reference to a declared
   * type constructor, or to an inline type constructor.
   */
  typeCtorFor(dir: TypeCheckableDirectiveMeta): ts.Expression {
    const node = dir.ref.node as ClassDeclaration<ts.ClassDeclaration>;
    if (this.typeCtors.has(node)) {
      return this.typeCtors.get(node) !;
    }

    if (requiresInlineTypeCtor(node)) {
      // The constructor has already been created inline, we just need to construct a reference to
      // it.
      const ref = this.reference(dir.ref);
      const typeCtorExpr = ts.createPropertyAccess(ref, 'ngTypeCtor');
      this.typeCtors.set(node, typeCtorExpr);
      return typeCtorExpr;
    } else {
      const fnName = `_ctor${this.nextIds.typeCtor++}`;
      const nodeTypeRef = this.referenceType(dir.ref);
      if (!ts.isTypeReferenceNode(nodeTypeRef)) {
        throw new Error(`Expected TypeReferenceNode from reference to ${dir.ref.debugName}`);
      }
      const meta: TypeCtorMetadata = {
        fnName,
        body: true,
        fields: {
          inputs: Object.keys(dir.inputs),
          outputs: Object.keys(dir.outputs),
          // TODO: support queries
          queries: dir.queries,
        }
      };
      const typeCtor = generateTypeCtorDeclarationFn(node, meta, nodeTypeRef.typeName);
      this.typeCtorStatements.push(typeCtor);
      const fnId = ts.createIdentifier(fnName);
      this.typeCtors.set(node, fnId);
      return fnId;
    }
  }

  /**
   * Get an expression referring to an instance of the given pipe.
   */
  pipeInst(ref: Reference<ClassDeclaration<ts.ClassDeclaration>>): ts.Expression {
    if (this.pipeInsts.has(ref.node)) {
      return this.pipeInsts.get(ref.node) !;
    }

    const pipeType = this.referenceType(ref);
    const pipeInstId = ts.createIdentifier(`_pipe${this.nextIds.pipeInst++}`);

    this.pipeInstStatements.push(tsDeclareVariable(pipeInstId, pipeType));
    this.pipeInsts.set(ref.node, pipeInstId);

    return pipeInstId;
  }

  reference(ref: Reference<ts.Node>): ts.Expression {
    const ngExpr = this.refEmitter.emit(ref, this.contextFile);
    if (ngExpr === null) {
      throw new Error(`Unreachable reference: ${ref.node}`);
    }

    // Use `translateExpression` to convert the `Expression` into a `ts.Expression`.
    return translateExpression(ngExpr, this.importManager, NOOP_DEFAULT_IMPORT_RECORDER);
  }

  referenceType(ref: Reference<ts.Node>): ts.TypeNode {
    const ngExpr = this.refEmitter.emit(ref, this.contextFile);
    if (ngExpr === null) {
      throw new Error(`Unreachable reference: ${ref.node}`);
    }

    // Create an `ExpressionType` from the `Expression` and translate it via `translateType`.
    // TODO: generic args
    return translateType(new ExpressionType(ngExpr), this.importManager);
  }

  referenceCoreType(name: string, typeParamCount: number = 0): ts.TypeNode {
    const external = new ExternalExpr({
      moduleName: '@angular/core',
      name,
    });
    let typeParams: Type[]|null = null;
    if (typeParamCount > 0) {
      typeParams = [];
      for (let i = 0; i < typeParamCount; i++) {
        typeParams.push(DYNAMIC_TYPE);
      }
    }
    return translateType(new ExpressionType(external, null, typeParams), this.importManager);
  }

  getPreludeStatements(): ts.Statement[] {
    return [
      ...this.pipeInstStatements,
      ...this.typeCtorStatements,
    ];
  }
}
