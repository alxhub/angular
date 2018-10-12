import {Expression, ExternalExpr, ExternalReference, WrappedNodeExpr} from '@angular/compiler';
import * as ts from 'typescript';

import {ImportMode, Reference} from './api';
import {pickIdentifier} from './util';


/**
 * A reference to a node which has a `ts.Identifer` and an expected absolute module name.
 *
 * An `AbsoluteReference` can be resolved to an `Expression`, and if that expression is an import
 * the module specifier will be an absolute module name, not a relative path.
 */
export class AbsoluteReference<T extends ts.Node> extends Reference<T> {
  private identifiers: ts.Identifier[] = [];
  private _publicSymbolName: string|null = null;
  constructor(
      node: T, private primaryIdentifier: ts.Identifier, readonly moduleName: string,
      readonly declaredSymbolName: string) {
    super(node);
  }

  get publicSymbolName(): string|null {
    return this._publicSymbolName;
  }

  setPublicSymbolName(value: string): void {
    if (this._publicSymbolName !== null) {
      throw new Error(`The public symbol name for ${this.declaredSymbolName} has already been set`);
    }
    this._publicSymbolName = value;
  }

  get symbolName(): string {
    return this._publicSymbolName !== null ? this._publicSymbolName : this.declaredSymbolName;
  }

  readonly expressable = true;

  toExpression(context: ts.SourceFile, importMode: ImportMode = ImportMode.UseExistingImport):
      Expression {
    const localIdentifier =
        pickIdentifier(context, this.primaryIdentifier, this.identifiers, importMode);
    if (localIdentifier !== null) {
      return new WrappedNodeExpr(localIdentifier);
    } else {
      return new ExternalExpr(new ExternalReference(this.moduleName, this.symbolName));
    }
  }

  addIdentifier(identifier: ts.Identifier): void { this.identifiers.push(identifier); }
}
