import * as ts from 'typescript';
import {AST, ASTWithSource, PropertyRead, Interpolation} from '@angular/compiler';

export function astToTypescript(ast: AST, maybeResolve: (ast: AST) => ts.Expression|null): ts.Expression {
  if (ast instanceof ASTWithSource) {
    return astToTypescript(ast.ast, maybeResolve);
  } else if (ast instanceof PropertyRead) {
    const expr = maybeResolve(ast);
    if (expr !== null) {
      return expr;
    }
    const receiver = astToTypescript(ast.receiver, maybeResolve);
    return ts.createPropertyAccess(receiver, ast.name);
  } else if (ast instanceof Interpolation) {
    if (ast.expressions.length < 2) {
      return astToTypescript(ast.expressions[0], maybeResolve);
    } else {
      return astsToBinaryExpression([...ast.expressions], maybeResolve);
    }
  } else {
    throw new Error(`Unknown node type: ${Object.getPrototypeOf(ast).constructor}`);
  }
}

function astsToBinaryExpression(ast: AST[], maybeResolve: (ast: AST) => ts.Expression|null): ts.BinaryExpression {
  let lhs: ts.Expression;
  const rhs = astToTypescript(ast.pop()!, maybeResolve);
  if (ast.length === 2) {
    lhs = astsToBinaryExpression(ast, maybeResolve);
  } else {
    lhs = astToTypescript(ast[0], maybeResolve);
  }
  return ts.createBinary(lhs, ts.SyntaxKind.CommaToken, rhs);
}
