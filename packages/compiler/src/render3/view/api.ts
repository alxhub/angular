/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as o from '../../output/output_ast';
import {IvyDependencyMetadata} from '../r3_factory';


export interface IvyDirectiveMetadata {
  name: string;
  type: o.Expression;
  deps: IvyDependencyMetadata[];
  selector: string|null;
  queries: IvyQueryMetadata[];
  host: {
    attributes: {[key: string]: string};
    listeners: {[key: string]: string};
    properties: {[key: string]: string};
  };
  inputs: {[prop: string]: string};
  outputs: {[prop: string]: string};
}

export interface IvyComponentMetadata extends IvyDirectiveMetadata {
  template: string;
  viewQueries: IvyQueryMetadata[];
}

export interface IvyQueryMetadata {
  propertyName: string;
  first: boolean;
  selectors: o.Expression|string[];
  descendants: boolean;
  read: o.Expression|null;
}

export interface DirectiveDef {
  expression: o.Expression;
  type: o.Type;
}

export interface ComponentDef {
  expression: o.Expression;
  type: o.Type;
}
