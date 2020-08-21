/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ast from '../../../../expression_parser/ast';
import * as o from '../../../../output/output_ast';
import {InterpolationExpr} from '../features/binding/interpolation';
import {UnresolvedExpr} from '../features/expressions';
import {PipeBindExpr} from '../features/pipes/expression';
import * as ir from '../ir';

const BINARY_OPERATORS = new Map<string, o.BinaryOperator>([
  ['&&', o.BinaryOperator.And],
  ['||', o.BinaryOperator.Or],
  ['==', o.BinaryOperator.Equals],
  ['!=', o.BinaryOperator.NotEquals],
  ['===', o.BinaryOperator.Identical],
  ['!==', o.BinaryOperator.NotIdentical],
]);

/**
 * Converts expressions within templates from the template AST (`ast.AST` nodes) which represent
 * Angular template expressions, to the code generation AST (`o.Expression` nodes) which represents
 * TS/JS code that can be generated.
 *
 * Some structures within the template AST are converted to various `ir.Expression` types, and will
 * require further processing before being emittable. In general, the `TemplateExpressionConverter`
 * tries to do as little of this kind of conversion as possible, preferring to defer such specific
 * operations for a template stage.
 */
export class TemplateExpressionConverter implements ast.AstVisitor {
  constructor(private scope: {allocateId(): ir.Id}) {}

  convert(value: ast.AST): o.Expression {
    return value.visit(this);
  }

  visitASTWithSource(node: ast.ASTWithSource): o.Expression {
    return node.ast.visit(this);
  }

  visitPropertyRead(node: ast.PropertyRead): o.Expression {
    if (node.receiver instanceof ast.ImplicitReceiver) {
      // This is a top-level read of a property. There's no way to know what this points to in
      // isolation, it will have to be resolved later.
      return new UnresolvedExpr(node.name);
    } else {
      const receiver = node.receiver.visit(this);
      return new o.ReadPropExpr(receiver, node.name);
    }
  }

  visitBinary(node: ast.Binary): o.BinaryOperatorExpr {
    if (!BINARY_OPERATORS.has(node.operation)) {
      throw new Error(`AssertionError: unsupported binary operation '${node.operation}'`);
    }
    const op = BINARY_OPERATORS.get(node.operation)!;
    return new o.BinaryOperatorExpr(op, node.left.visit(this), node.right.visit(this));
  }

  visitChain(node: ast.Chain) {
    throw new Error('Method not implemented.');
  }

  visitConditional(node: ast.Conditional): o.ConditionalExpr {
    return new o.ConditionalExpr(
        node.condition.visit(this), node.trueExp.visit(this), node.falseExp.visit(this));
  }

  visitFunctionCall(node: ast.FunctionCall) {
    throw new Error('Method not implemented.');
  }
  visitImplicitReceiver(node: ast.ImplicitReceiver) {
    throw new Error('AssertionError: ImplicitReceiver should have been handled before this point.');
  }

  visitInterpolation(node: ast.Interpolation) {
    return new InterpolationExpr(node.expressions.map(expr => expr.visit(this)), node.strings);
  }

  visitKeyedRead(node: ast.KeyedRead) {
    throw new Error('Method not implemented.');
  }

  visitKeyedWrite(node: ast.KeyedWrite) {
    throw new Error('Method not implemented.');
  }

  visitLiteralArray(node: ast.LiteralArray) {
    return new o.LiteralArrayExpr(node.expressions.map(expr => expr.visit(this)));
  }

  visitLiteralMap(node: ast.LiteralMap): o.Expression {
    return new o.LiteralMapExpr(node.values.map(
        (value, i) =>
            new o.LiteralMapEntry(node.keys[i].key, value.visit(this), node.keys[i].quoted)));
  }

  visitLiteralPrimitive(node: ast.LiteralPrimitive) {
    if (node.value == null || typeof node.value === 'string' || typeof node.value === 'boolean' ||
        typeof node.value === 'number') {
      return o.literal(node.value);
    } else {
      throw new Error(`visitLiteralPrimitive not implemented for ${node.value}`);
    }
  }

  visitMethodCall(node: ast.MethodCall): o.Expression {
    const args = node.args.map(arg => arg.visit(this));
    if (node.receiver instanceof ast.ImplicitReceiver) {
      const target = new UnresolvedExpr(node.name);
      return new o.InvokeFunctionExpr(target, args);
    } else {
      return new o.InvokeMethodExpr(node.receiver.visit(this), node.name, args);
    }
  }

  visitPipe(node: ast.BindingPipe): o.Expression {
    return new PipeBindExpr(
        this.scope.allocateId(), node.name, node.exp.visit(this),
        node.args.map(arg => arg.visit(this)));
  }

  visitPrefixNot(node: ast.PrefixNot) {
    throw new Error('Method not implemented.');
  }

  visitNonNullAssert(node: ast.NonNullAssert) {
    throw new Error('Method not implemented.');
  }

  visitPropertyWrite(node: ast.PropertyWrite) {
    throw new Error('Method not implemented.');
  }

  visitQuote(node: ast.Quote) {
    throw new Error('Method not implemented.');
  }

  visitSafeMethodCall(node: ast.SafeMethodCall) {
    throw new Error('Method not implemented.');
  }

  visitSafePropertyRead(node: ast.SafePropertyRead) {
    throw new Error('Method not implemented.');
  }
}
