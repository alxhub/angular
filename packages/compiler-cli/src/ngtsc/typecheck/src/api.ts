import * as ts from 'typescript';
import {Directive, Node} from '@angular/compiler';

import {Reference} from '../../metadata';

export interface DirectiveTypecheckData {
  ref: Reference<ts.ClassDeclaration>;
}

export interface ComponentTcbRequest {
  nodes: Node[];
  directives: Directive<DirectiveTypecheckData>;
}

export interface ComponentTcbResponse {
  checkFn: ts.FunctionDeclaration;
}

export interface TypeCtorMetadata {
  fnName: string;
  fields: {
    inputs: string[];
    outputs: string[];
    queries: string[];
  };
}