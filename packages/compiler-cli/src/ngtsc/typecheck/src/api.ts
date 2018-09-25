/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {BoundTarget} from '@angular/compiler';
import * as ts from 'typescript';

import {Reference} from '../../metadata';

export interface DirectiveTypecheckData {
  ref: Reference<ts.ClassDeclaration>;
  fields:
      {inputs: {[field: string]: string}; outputs: {[field: string]: string}; queries: string[];};
  ngTemplateGuards: string[];
  hasNgTemplateContextGuard: boolean;
}

export interface TypeCheckBlockMetadata {
  boundTarget: BoundTarget<DirectiveTypecheckData>;
  fnName: string;
}

export interface TypeCtorMetadata {
  fnName: string;
  body: boolean;
  fields: {inputs: string[]; outputs: string[]; queries: string[];};
}
