import {Element, BoundText, Reference, Node, Template, Variable, Visitor} from '../r3_ast';
import {AST, BindingPipe} from '../../expression_parser/ast';
import {SelectorMatcher} from '../../selector';
import * as o from '../../output/output_ast';

export interface Directive<D> {
  directive: D;
  name: string;
  isPrimary: boolean;
  inputs: Set<string>;
  outputs: Set<string>;
  exportAs: string|null;
}

export interface Target {
  template?: Node[];
}

export interface TargetBinder<D> {
  bind(target: Target): BoundTarget<D>;
}

export interface TargetStructuralAnalyzer {
  analyze(target: BoundTarget<any>): StructurallyAnalyzedTarget;
}

export interface BoundTarget<D> {
  readonly target: Target;

  getDirectivesOfNode(node: Element|Template): Directive<D>[]|null;

  getReferenceTarget(ref: Reference): Directive<D>|Element|Template|null;

  getExpressionTarget(expr: AST): Directive<D>|Reference|Variable|null;

  getTemplateOfSymbol(symbol: Reference|Variable): Template|null;

  getNestingLevel(template: Template): number;
}

export interface StructurallyAnalyzedTarget {
  readonly consts: number;
  readonly interpolations: number;

  getConstIndex(value: Element|BoundText|BindingPipe): number;
}

export interface CompiledTarget {
  compiledTemplate?: o.Expression;

  consts: number;
  vars: number;
}
