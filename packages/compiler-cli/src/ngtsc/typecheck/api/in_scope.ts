import * as ts from 'typescript';

export interface DirectiveInScope {
  /** The `ts.Symbol` for the class declaration. */
  tsSymbol: ts.Symbol;

  /** The selector for the `Directive` / `Component`. */
  selector: string;

  /** `true` if this `DirectiveSymbol` is for a @Component. */
  isComponent: boolean;

  /**
   * `true` if this `DirectiveSymbol` is for a structural directive.
   */
  isStructural: boolean;
}

export interface PipeInScope {
  /** The `ts.Symbol` for the class declaration. */
  tsSymbol: ts.Symbol;

  name: string;
}