/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

export interface SelectorScopeDef<D extends DirectiveInScope<string, any>[], P extends PipeInScope<string, any>[]> {
  directives: D;
  pipes: P;
}

export interface DirectiveInScope<S extends string, D> {
  selector: S;
  directive: D;
}

export interface PipeInScope<N extends string, P> {
  name: N;
  pipe: P;
}
