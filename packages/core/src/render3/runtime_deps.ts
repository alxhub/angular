/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import type {Type} from '../interface/type';
import type {NgModuleType} from '../metadata/ng_module_def';
import {flatten} from '../util/array_utils';
import type {ComponentType, DependencyTypeList} from './interfaces/definition';
import {transitiveScopesFor, transitiveScopesForNgModule} from './jit/module';
import {getComponentDef, ɵɵsetComponentScope} from './definition';

export function ɵɵmakeRuntimeResolverFn(importedTypes: Type<any>[]): () => DependencyTypeList {
  return () => {
    const list: DependencyTypeList = [];
    for (const imported of importedTypes) {
      const scope = transitiveScopesFor(imported);
      list.push(...scope.exported.directives, ...scope.exported.pipes);
    }
    return list;
  };
}


export function ɵɵpropagateNgModuleToDeclarations(moduleType: NgModuleType<any>): void {
  let declarations = moduleType.ɵmod.declarations;
  if (typeof declarations === 'function') {
    declarations = declarations();
  }
  const scope = transitiveScopesForNgModule(moduleType);
  const directives = Array.from(scope.exported.directives);
  const pipes = Array.from(scope.exported.pipes);
  for (const declaration of flatten(declarations) as Type<any>[]) {
    const def = getComponentDef(declaration);
    if (def !== undefined) {
      ɵɵsetComponentScope(declaration as ComponentType<any>, directives, pipes);
    }
  }
}
