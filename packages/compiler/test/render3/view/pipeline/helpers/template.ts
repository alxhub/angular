/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {ConstantPool, parseTemplate} from '../../../../../src/compiler';
import * as o from '../../../../../src/output/output_ast';
import {TemplateEmitter} from '../../../../../src/render3/view/pipeline/features/embedded_views';
import {templateToIr as parseNodes} from '../../../../../src/render3/view/pipeline/input/template';
import * as ir from '../../../../../src/render3/view/pipeline/ir';
import {produceBodyStatements} from '../../../../../src/render3/view/pipeline/output/util';

import {AssertionCursor, InstructionCursor, StatementCursor, TestableInstruction} from './cursor';

export function parse(template: string): ir.RootTemplate {
  const {nodes, errors} = parseTemplate(template, 'ng://test', {
    preserveWhitespaces: true,
    leadingTriviaChars: [],
  });
  if (errors !== undefined && errors.length > 0) {
    throw new Error('Template parse errors: ' + errors.map(e => e.msg).join(', '));
  }

  return parseNodes(nodes, 'Test_Template');
}

export class TestPipeline {
  private constantPool = new ConstantPool();

  private constructor(
      private stages: ir.TemplateStage[], private createEmitters: ir.CreateEmitter[],
      private updateEmitters: ir.UpdateEmitter[]) {
    this.createEmitters.push(
        new TemplateEmitter(createEmitters, this.updateEmitters, this.constantPool));
  }

  fromHtml(tmpl: string): TestableTemplateFn {
    return this.fromRootTemplate(parse(tmpl));
  }

  fromRootTemplate(tmpl: ir.RootTemplate): TestableTemplateFn {
    for (const stage of this.stages) {
      tmpl.transform(stage);
    }

    // Emit create and update blocks.

    const statements = produceBodyStatements(tmpl, this.createEmitters, this.updateEmitters);

    const createBlock = findBlock(statements, 1);
    const updateBlock = findBlock(statements, 2);

    return new TestableTemplateFn(createBlock, updateBlock);
  }

  static setup(
      stages: ir.TemplateStage[], createEmitters: ir.CreateEmitter[],
      updateEmitters: ir.UpdateEmitter[]): TestPipeline {
    return new TestPipeline(stages, createEmitters, updateEmitters);
  }
}

function findBlock(statements: o.Statement[], rf: number): o.Statement[] {
  for (const stmt of statements) {
    if (!(stmt instanceof o.IfStmt)) {
      continue;
    }
    if (!(stmt.condition instanceof o.BinaryOperatorExpr) ||
        stmt.condition.operator !== o.BinaryOperator.BitwiseAnd) {
      continue;
    }

    if (!(stmt.condition.rhs instanceof o.LiteralExpr) || stmt.condition.rhs.value !== rf) {
      continue;
    }
    return stmt.trueCase;
  }
  return [];
}

export class TestableTemplateFn {
  readonly create: AssertionCursor<TestableInstruction, TestableTemplateFn>;
  readonly update: AssertionCursor<TestableInstruction, TestableTemplateFn>;

  constructor(readonly createBlock: o.Statement[], readonly updateBlock: o.Statement[]) {
    this.create =
        new AssertionCursor(new InstructionCursor(new StatementCursor(createBlock)), this);
    this.update =
        new AssertionCursor(new InstructionCursor(new StatementCursor(updateBlock)), this);
  }
}
