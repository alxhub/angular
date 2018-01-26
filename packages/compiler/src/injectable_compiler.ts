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
import {componentFactoryResolverProviderDef, depDef, providerDef} from './view_compiler/provider_compiler';

export class InjectableCompiler {
   
  constructor(private reflector: CompileReflector) {}

  injectableDef(injectable: CompileInjectableMetadata, ctx: OutputContext): o.Expression {
    const fn = {};
    return ctx.importExpr(Identifiers.defineInjectable).callFn([]);
  }
}