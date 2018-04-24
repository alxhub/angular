/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {InjectFlags} from '../core';

import * as o from '../output/output_ast';
import {Identifiers} from '../identifiers';
import {Identifiers as R3} from '../render3/r3_identifiers';

export interface IvyFactoryMetadata {
  name: string;
  fnOrClass: o.Expression;
  deps: IvyDependencyMetadata[];
  
  useNew: boolean;
  injectFn: o.ExternalReference;

  extraResults?: o.Expression[];
}

export enum IvyResolvedDependency {
  Token = 0,
  Attribute = 1,
  Injector = 2,
  ElementRef = 3,
  TemplateRef = 4,
  ViewContainerRef = 5,
}

export interface IvyDependencyMetadata {
  token: o.Expression;
  resolved: IvyResolvedDependency;
  host: boolean;
  optional: boolean;
  self: boolean;
  skipSelf: boolean;
}

export function compileIvyFactoryFunction(meta: IvyFactoryMetadata): o.Expression {
  const args = meta.deps.map(dep => injectDep(dep, meta.injectFn));
  const expr = meta.useNew ? new o.InstantiateExpr(meta.fnOrClass, args) : new o.InvokeFunctionExpr(meta.fnOrClass, args);
  const retExpr = meta.extraResults === undefined ? expr : o.literalArr([expr, ...meta.extraResults]);
  return o.fn([], [new o.ReturnStatement(retExpr)], o.INFERRED_TYPE, undefined, `${meta.name}_Factory`);
}

function injectDep(dep: IvyDependencyMetadata, inject: o.ExternalReference): o.Expression {
  switch (dep.resolved) {
    case IvyResolvedDependency.Token:
    case IvyResolvedDependency.Injector: {
      const defaultValue = dep.optional ? o.NULL_EXPR : o.literal(undefined);
      const flags = o.literal(
        InjectFlags.Default | (dep.self && InjectFlags.Self || 0) |
        (dep.skipSelf && InjectFlags.SkipSelf || 0) |
        (dep.host && InjectFlags.Host || 0));
      let token: o.Expression = dep.token;
      if (dep.resolved === IvyResolvedDependency.Injector) {
        token = o.importExpr(Identifiers.INJECTOR);
      }
      const injectArgs = [dep.token];
      if (flags.value !== InjectFlags.Default) {
        injectArgs.push(defaultValue, flags);
      }
      return o.importExpr(inject).callFn(injectArgs);
    }
    case IvyResolvedDependency.Attribute:
      return o.importExpr(R3.injectAttribute).callFn([dep.token]);
    case IvyResolvedDependency.ElementRef:
      return o.importExpr(R3.injectElementRef).callFn([]);
    case IvyResolvedDependency.TemplateRef:
      return o.importExpr(R3.injectTemplateRef).callFn([]);
    case IvyResolvedDependency.ViewContainerRef:
      return o.importExpr(R3.injectViewContainerRef).callFn([]);
    default:
      throw new Error(`Unknown IvyResolvedDependency: ${IvyResolvedDependency[dep.resolved]}`);
  }
}
