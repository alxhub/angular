/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {AST} from '../../expression_parser/ast';
import {Element, Node, Reference, Template, Variable} from '../r3_ast';


/*
 * t2 is the replacement for the `TemplateDefinitionBuilder`. It handles the operations of
 * analyzing Angular templates, extracting semantic info, and ultimately producing a template
 * definition function which renders the template using Ivy instructions.
 *
 * t2 data is also utilized by the template type-checking facilities to understand a template enough
 * to generate type-checking code for it.
 */

/**
 * A logical target for analysis, which could contain a template or other types of bindings.
 */
export interface Target { template?: Node[]; }

/**
 * Metadata regarding a directive that's needed to match it against template elements. This is
 * provided by a consumer of the t2 APIs.
 *
 * TODO: maybe rename this interface
 *
 * @param D additional information to pass through the matching APIs.
 */
export interface Directive<D> {
  /**
   * Additional opaque information provided by the consumer which is passed through the matching
   * APIs.
   *
   * TODO: refactor this away and extend from this interface instead.
   */
  directive: D;

  /**
   * Name of the directive class (used for debugging).
   */
  name: string;

  /**
   * Whether the directive is a "primary" directive.
   */
  isPrimary: boolean;

  /**
   * `Set` of inputs which this directive claims.
   *
   * TODO: replace with {[property: string]: any}.
   */
  inputs: Set<string>;

  /**
   * `Set` of outputs which this directive claims.
   *
   * TODO: replace with {[property: string]: any}.
   */
  outputs: Set<string>;

  /**
   * Name under which the directive is exported, if any (exportAs in Angular).
   */
  exportAs: string|null;
}

/**
 * The binding API.
 */
export interface TargetBinder<D> { bind(target: Target): BoundTarget<D>; }

export interface BoundTarget<D> {
  readonly target: Target;

  getDirectivesOfNode(node: Element|Template): Directive<D>[]|null;

  getReferenceTarget(ref: Reference): Directive<D>|Element|Template|null;

  getExpressionTarget(expr: AST): Directive<D>|Reference|Variable|null;

  getTemplateOfSymbol(symbol: Reference|Variable): Template|null;

  getNestingLevel(template: Template): number;

  getUsedDirectives(): Directive<D>[];
}
