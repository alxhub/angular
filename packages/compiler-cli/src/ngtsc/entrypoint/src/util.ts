import * as ts from 'typescript';

export function resolveAliasedSymbol(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Symbol {
  if (symbol.flags & ts.SymbolFlags.Alias) {
    return checker.getAliasedSymbol(symbol);
  } else {
    return symbol;
  }
}
