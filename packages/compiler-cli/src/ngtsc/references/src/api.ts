import {Expression} from '@angular/compiler';

import * as ts from 'typescript';

export enum ImportMode {
  UseExistingImport,
  ForceNewImport,
}

/**
 * A reference to a `ts.Node`.
 *
 * For example, if an expression evaluates to a function or class definition, it will be returned
 * as a `Reference` (assuming references are allowed in evaluation).
 */
export abstract class Reference<T extends ts.Node = ts.Node> {
  constructor(readonly node: T) {}

  /**
   * Whether an `Expression` can be generated which references the node.
   */
  // TODO(issue/24571): remove '!'.
  readonly expressable !: boolean;

  /**
   * Generate an `Expression` representing this type, in the context of the given SourceFile.
   *
   * This could be a local variable reference, if the symbol is imported, or it could be a new
   * import if needed.
   */
  abstract toExpression(context: ts.SourceFile, importMode?: ImportMode): Expression|null;

  abstract addIdentifier(identifier: ts.Identifier): void;
}
