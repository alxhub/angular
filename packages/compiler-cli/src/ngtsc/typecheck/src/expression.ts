/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Element, Node, Visitor, BoundAttribute, Template, BoundEvent} from '@angular/compiler/src/render3/r3_ast';

import {AstVisitor, Binary, Chain, Conditional, FunctionCall, ImplicitReceiver, Interpolation, KeyedRead, KeyedWrite, LiteralArray, LiteralMap, LiteralPrimitive, MethodCall, PrefixNot, NonNullAssert, PropertyRead, PropertyWrite, Quote, SafeMethodCall, SafePropertyRead, AST, BindingPipe} from '@angular/compiler/src/expression_parser/ast';

export class ExpressionAstTransform implements AstVisitor {
  constructor(private pipeFunctions: Map<string, string>) {}

  visitBinary(ast: Binary, context: any): string {
    const left = this.visit(ast.left, context);
    const right = this.visit(ast.right, context);
    return `(${left} ${ast.operation} ${right})`;
  }

  visitChain(ast: Chain, context: any): string {
    const results = ast.expressions.map(expr => this.visit(expr, context));
    return `(${results.join(', ')})`;
  }

  visitConditional(ast: Conditional, context: any): string {
    const cond = this.visit(ast.condition, context);
    const trueExpr = this.visit(ast.trueExp, context);
    const falseExpr = this.visit(ast.falseExp, context);
    return `(${cond} ? ${trueExpr} : ${falseExpr})`;
  }

  visitFunctionCall(ast: FunctionCall, context: any): string {
    if (ast.target === null) {
      return `(undefined as never)`;
    }
    const target = this.visit(ast.target, context);
    const args = ast.args.map(arg => this.visit(arg, context));
    return `${target}(${args.join(', ')})`;
  }

  visitImplicitReceiver(ast: ImplicitReceiver, context: any): string {
    return 'this';
  }

  visitInterpolation(ast: Interpolation, context: any): string {
    const parts: string[] = [];
    ast.expressions.forEach((expr: AST, index) => {
      parts.push(ast.strings[index]);
      parts.push(this.visit(expr, context));
    });
    parts.push(ast.strings[ast.strings.length - 1]);
    return this._string(parts.join(''));
  }

  visitKeyedRead(ast: KeyedRead, context: any): string {
    const obj = this.visit(ast.obj, context);
    const key = this.visit(ast.key, context);
    return `${obj}[${key}]`;
  }

  visitKeyedWrite(ast: KeyedWrite, context: any): string {
    const obj = this.visit(ast.obj, context);
    const key = this.visit(ast.key, context);
    const value = this.visit(ast.value, context);
    return `(${obj}[${key}] = ${value})`;
  }

  visitLiteralArray(ast: LiteralArray, context: any): string {
    const expressions = ast.expressions.map(expr => this.visit(expr, context));
    return `[${expressions.join(',')}]`;
  }

  visitLiteralMap(ast: LiteralMap, context: any): string {
    const keyValuePairs = ast.keys.map((key, index) => {
      const value = this.visit(ast.values[index], context);
      const keyStr = key.quoted ? this._string(key.key) : key.key;
      return `${keyStr}: ${value}`;
    });
    return `{${keyValuePairs.join(', ')}}`;
  }

  visitLiteralPrimitive(ast: LiteralPrimitive, context: any): string {
    if (typeof ast.value === 'string') {
      return this._string(ast.value);
    } else {
      return `${ast.value}`;
    }
  }

  visitMethodCall(ast: MethodCall, context: any): string {
    const receiver = this.visit(ast.receiver, context);
    const args = ast.args.map(arg => this.visit(arg, context));
    return `${receiver}.${ast.name}(${args.join(', ')})`;
  }

  visitPipe(ast: BindingPipe, context: any): string {
    if (!this.pipeFunctions.has(ast.name)) {
      throw new Error(`Unknown pipe: ${ast.name}`);
    }
    const fn = this.pipeFunctions.get(ast.name)!;
    const expr = this.visit(ast.exp, context);
    const args = ast.args.map(arg => this.visit(arg, context));
    const argSuffix = args.length > 0 ? `, ${args.join(', ')}` : '';
    return `${fn}(${expr}${argSuffix})`;
  }

  visitPrefixNot(ast: PrefixNot, context: any): string {
    const expr = this.visit(ast.expression, context);
    return `!${expr}`;
  }

  visitNonNullAssert(ast: NonNullAssert, context: any): string {
    const expr = this.visit(ast.expression, context);
    return `${expr}!`;
  }

  visitPropertyRead(ast: PropertyRead, context: any): string {
    const receiver = this.visit(ast.receiver, context);
    return `${receiver}.${ast.name}`;
  }

  visitPropertyWrite(ast: PropertyWrite, context: any): string {
    const receiver = this.visit(ast.receiver, context);
    const value = this.visit(ast.value, context);
    return `(${receiver}.${ast.name} = ${value}`;
  }

  visitQuote(ast: Quote, context: any): string {
    throw new Error(`Quote isn't handled`);
  }

  visitSafeMethodCall(ast: SafeMethodCall, context: any): string {
    const receiver = this.visit(ast.receiver, context);
    const args = ast.args.map(arg => this.visit(arg, context));
    return `(${receiver} != null ? ${receiver}.${ast.name}(${args.join(', ')}) : ${receiver})`;
  }

  visitSafePropertyRead(ast: SafePropertyRead, context: any): string {
    const receiver = this.visit(ast.receiver, context);
    return `(${receiver} != null ? ${receiver}.${ast.name} : ${receiver})`;
  }

  visit(ast: any, context?: any): string {
    if (ast instanceof AST) {
      return ast.visit(this, context);
    } else if (typeof ast === 'string') {
      return this._string(ast);
    } else {
      return `${ast}`;
    }
  }

  private _string(value: string): string {
    const strValue = value.replace(/\n/g, "\\n").replace(/"/g, '\\"');
    return `"${strValue}"`;
  }
}
