/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {CompileInjectableMetadata, CompileNgModuleMetadata, CompileProviderMetadata, identifierName} from './compile_metadata';
import {CompileReflector} from './compile_reflector';
import {NodeFlags} from './core';
import {Identifiers} from './identifiers';
import * as o from './output/output_ast';
import {typeSourceSpan} from './parse_util';
import {NgModuleProviderAnalyzer} from './provider_analyzer';
import {OutputContext} from './util';
import {convertValueToOutputAst} from './output/value_util';
import {componentFactoryResolverProviderDef, depDef, providerDef} from './view_compiler/provider_compiler';
import { OutletContext } from 'router/src/router_outlet_context';

type MapEntry = {key: string, quoted: boolean, value: o.Expression};
type MapLiteral = MapEntry[];

function mapEntry(key: string, value: o.Expression): MapEntry {
  return {key, value, quoted: false};
}

export class InjectableCompiler {
  constructor(private reflector: CompileReflector) {}

  _depsArray(deps: any[], ctx: OutputContext): o.Expression[] {
    return deps.map(dep => {
      let token = dep;
      if (Array.isArray(token)) {
        token = dep[0];
        if (dep.length > 1) {
          throw new Error('not implemented');
        }
      }
      return o.importExpr(Identifiers.inject).callFn([ctx.importExpr(token)]);
    });
  }

  _factoryFor(injectable: CompileInjectableMetadata, ctx: OutputContext): o.Expression {
    let retValue: o.Expression;
    if (injectable.useExisting !== undefined) {
      retValue = o
        .importExpr(Identifiers.inject)
        .callFn([ctx.importExpr(injectable.useExisting)]);
    } else if (injectable.useFactory !== undefined) {
      const deps = injectable.deps || [];
      if (deps.length > 0) {
        retValue = ctx.importExpr(injectable.useFactory).callFn(this._depsArray(deps, ctx));
      } else {
        return ctx.importExpr(injectable.useFactory);
      }
    } else if (injectable.useValue !== undefined) {
      retValue = convertValueToOutputAst(ctx, injectable.useValue);
    } else {
      const clazz = injectable.useClass || injectable.symbol;
      const depArgs = this._depsArray(this.reflector.parameters(clazz), ctx);
      retValue = new o.InstantiateExpr(ctx.importExpr(clazz), depArgs);
    }
    return o.fn([], [new o.ReturnStatement(retValue)], undefined, undefined,
        injectable.symbol.name + '_Factory');
  }

  injectableDef(injectable: CompileInjectableMetadata, ctx: OutputContext): o.Expression {
    const def: MapLiteral = [
      mapEntry('factory', this._factoryFor(injectable, ctx)),
      mapEntry('token', ctx.importExpr(injectable.type.reference)),
      mapEntry('scope', ctx.importExpr(injectable.module!)),
    ];
    return o.importExpr(Identifiers.defineInjectable).callFn([o.literalMap(def)]);
  }

  compile(injectable: CompileInjectableMetadata, ctx: OutputContext): void {
    if (injectable.module !== undefined) {
      const className = identifierName(injectable.type) !;
      const clazz = new o.ClassStmt(
        className,
        null,
        [
          new o.ClassField('ngInjectableDef', o.INFERRED_TYPE, [o.StmtModifier.Static],
              this.injectableDef(injectable, ctx)),
        ],
        [],
        new o.ClassMethod(null, [], []),
        []
      );
      ctx.statements.push(clazz);
    }
  }
}