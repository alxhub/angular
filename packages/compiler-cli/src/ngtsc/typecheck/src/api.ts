/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Directive, Node} from '@angular/compiler';
import * as ts from 'typescript';

import {Reference} from '../../metadata';

export interface DirectiveTypecheckData { ref: Reference<ts.ClassDeclaration>; }

export interface ComponentTcbRequest {
  nodes: Node[];
  directives: Directive<DirectiveTypecheckData>;
}

export interface ComponentTcbResponse { checkFn: ts.FunctionDeclaration; }

export interface TypeCtorMetadata {
  fnName: string;
  body: boolean;
  fields: {inputs: string[]; outputs: string[]; queries: string[];};
}