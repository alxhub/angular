/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {TmplAstReference, TmplAstVariable} from '@angular/compiler';

import * as ts from 'typescript';

import {DirectiveInScope} from './in_scope';
import {ShimLocation} from './symbols';

export interface GlobalCompletion {
  componentContext: ShimLocation;
  templateContext: Map<string, ReferenceCompletion|VariableCompletion>;
}

export enum CompletionKind {
  Input,
  Output,
  Selector,
  Reference,
  Variable,
}

export interface ReferenceCompletion {
  kind: CompletionKind.Reference;
  node: TmplAstReference;
}

export interface VariableCompletion {
  kind: CompletionKind.Variable;
  node: TmplAstVariable;
}

export interface InputCompletion {
  kind: CompletionKind.Input;
  name: string;
  directive: DirectiveInScope;
  field: ts.Symbol|null;
  bananaInABox: boolean;
}

export interface OutputCompletion {
  kind: CompletionKind.Output;
  name: string;
  directive: DirectiveInScope;
  field: ts.Symbol|null;
}

export type BindingCompletion = InputCompletion|OutputCompletion;
export type BindingCompletionMap = Map<string, BindingCompletion>;