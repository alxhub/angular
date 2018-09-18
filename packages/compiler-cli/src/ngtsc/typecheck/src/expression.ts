import * as ts from 'typescript';
import {AST, ASTWithSource, PropertyRead} from '@angular/compiler';

export function astToTypescript(ast: AST): ts.Node {
  if (ast instanceof ASTWithSource) {
    return astToTypescript(ast.ast);
  } else if (ast instanceof PropertyRead) {
    const receiver = astToTypescript(ast.receiver) as ts.Expression;
    return ts.createPropertyAccess(receiver, ast.name);
  } else {
    throw new Error(`Unknown node type: ${Object.getPrototypeOf(ast).constructor}`);
  }
}
