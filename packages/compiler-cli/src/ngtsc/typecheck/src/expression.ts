import * as ts from 'typescript';
import {AST, ASTWithSource, PropertyRead, Interpolation} from '@angular/compiler';

export function astToTypescript(ast: AST, mapReceiver: (ast: AST) => ts.Identifier|null): ts.Expression {
  if (ast instanceof ASTWithSource) {
    return astToTypescript(ast.ast, mapReceiver);
  } else if (ast instanceof PropertyRead) {
    const receiver = mapReceiver(ast) || astToTypescript(ast.receiver, mapReceiver);
    return ts.createPropertyAccess(receiver, ast.name);
  } else if (ast instanceof Interpolation) {
    if (ast.expressions.length < 2) {
      return astToTypescript(ast.expressions[0], mapReceiver);
    } else {
      return astsToBinaryExpression([...ast.expressions], mapReceiver);
    }
  } else {
    throw new Error(`Unknown node type: ${Object.getPrototypeOf(ast).constructor}`);
  }
}

function astsToBinaryExpression(ast: AST[], mapSpecial: (ast: AST) => ts.Identifier|null): ts.BinaryExpression {
  let lhs: ts.Expression;
  const rhs = astToTypescript(ast.pop()!, mapSpecial);
  if (ast.length === 2) {
    lhs = astsToBinaryExpression(ast, mapSpecial);
  } else {
    lhs = astToTypescript(ast[0], mapSpecial);
  }
  return ts.createBinary(lhs, ts.SyntaxKind.CommaToken, rhs);
}
