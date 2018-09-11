import {Element, BoundText, Reference, Template, Variable, Visitor} from '../r3_ast';
import {AST, BindingPipe} from '../../expression_parser/ast';
import {SelectorMatcher} from '../../selector';
import * as o from '../../output/output_ast';

export interface Target {
  template?: Template;
  directiveMatcher?: SelectorMatcher;
}

export interface MatchedDirective<I> {
  info: I;
}

export interface TargetBinder {
  bind(target: Target): BoundTarget;
}

export interface TargetStructuralAnalyzer {
  analyze(target: BoundTarget): StructurallyAnalyzedTarget;
}

export interface BoundTarget {
  readonly target: Target;

  getDirectivesOfElement(el: Element): MatchedDirective<any>[]|null;
  getExpressionTarget(expr: AST): MatchedDirective<any>|Reference|Variable|null;
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