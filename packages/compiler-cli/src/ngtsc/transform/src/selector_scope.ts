import * as ts from 'typescript';

import {CompilerAdapter, AnalysisOutput, AddStaticFieldInstruction} from './api';
import { Decorator, reflectObjectLiteral } from '../../metadata';
import {SelectorScope, ScopeMap, getImportPath} from './scope';

import {ConstantPool, DYNAMIC_TYPE, LiteralExpr, ReadVarExpr, ExternalExpr, ExternalReference, ExpressionType, BuiltinType, BuiltinTypeName, LiteralArrayExpr} from '@angular/compiler';

export class SelectorScopeAdapter implements CompilerAdapter<SelectorScope> {
  constructor(private scopeMap: ScopeMap) {}

  detect(decorators: Decorator[]): Decorator | undefined {
    return decorators.find(decorator => decorator.from === '@angular/core' && decorator.name === 'NgModule');
  }

  analyze(node: ts.ClassDeclaration, decorator: Decorator): AnalysisOutput<SelectorScope> {
    const moduleScope = this.scopeMap.getScopeOfModule(node);
    if (moduleScope === undefined) {
      return {};
    }

    const scope = moduleScope.compilationScope;
    return {
      analysis: scope,
    };
  }

  compile(node: ts.ClassDeclaration, scope: SelectorScope, constantPool: ConstantPool): AddStaticFieldInstruction {
    const directiveTypes = scope
      .directives
      .map(dir => {
        const moduleName = getImportPath(node.getSourceFile().fileName, dir.importFrom.relatively!);
        const refExpr = moduleName === '' ? new ReadVarExpr(dir.identifier) : new ExternalExpr({moduleName, name: dir.identifier} as ExternalReference);
        return new ExternalExpr({moduleName: '@angular/core', name: 'ɵDirectiveInScope'} as ExternalReference, undefined, [
          new ExpressionType(new LiteralExpr(dir.selector)),
          new ExpressionType(refExpr),
        ]);
      });

    const type = new ExpressionType(
      new ExternalExpr({moduleName: '@angular/core', name: 'ɵSelectorScopeDef'} as ExternalReference, undefined, [
        new ExpressionType(new LiteralArrayExpr(directiveTypes)),
        DYNAMIC_TYPE,
      ])
    );

    return {
      field: 'ngSelectorScopeDef',
      initializer: new LiteralExpr(undefined),
      type,
    };
  }
}
