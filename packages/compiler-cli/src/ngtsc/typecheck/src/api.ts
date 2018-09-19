import * as ts from 'typescript';
import {Directive, Node, BoundTarget} from '@angular/compiler';

import {Reference} from '../../metadata';

export interface DirectiveTypecheckData {
  ref: Reference<ts.ClassDeclaration>;
  fields: {
    inputs: string[];
    outputs: string[];
    queries: string[];
  };
}

export interface TypeCheckBlockMetadata {
  boundTarget: BoundTarget<DirectiveTypecheckData>;
  fnName: string;
}

export interface TypeCtorMetadata {
  fnName: string;
  body: boolean;
  fields: {
    inputs: string[];
    outputs: string[];
    queries: string[];
  };
}
