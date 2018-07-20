import {AST, Parser, Lexer} from "@angular/compiler";

import {ExpressionAstTransform} from '../src/transform';

/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

describe('typecheck', () => {
  describe('expression transformer', () => {
    const parser = new Parser(new Lexer());
    const xform = new ExpressionAstTransform(new Map<string, string>([['pipe', 'testPipe']]));

    function parse(input: string): AST {
      return parser.parseBinding(input, null);
    }

    it('should transform basic expr to TS', () => {
      const expr = parse('test');
      expect(xform.visit(expr)).toBe('this.test');
    });

    it('should transform an expression with calls and reads to TS', () => {
      const expr = parse('test(foo, 3, "inline")?.read.value');
      expect(xform.visit(expr)).toBe(`(this.test(this.foo, 3, "inline") != null ? this.test(this.foo, 3, "inline").read : this.test(this.foo, 3, "inline")).value`);
    });

    it('should transform a pipe expr to TS', () => {
      const expr = parse('test | pipe');
      expect(xform.visit(expr)).toBe('testPipe(this.test)');
    });
  });
});
