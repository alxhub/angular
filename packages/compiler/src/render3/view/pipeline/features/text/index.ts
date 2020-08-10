/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as o from '../../../../../output/output_ast';
import {ParseSourceSpan} from '../../../../../parse_util';
import {Identifiers as R3} from '../../../../r3_identifiers';
import * as ir from '../../ir';
import {emitInterpolationExpr, InterpolationConfig, InterpolationExpr} from '../binding/interpolation';

export class Text extends ir.CreateNode implements ir.CreateSlotAspect {
  readonly[ir.CreateSlotAspect] = true;

  slot: ir.DataSlot|null = null;

  constructor(
      readonly id: ir.Id, public value: string|null = null,
      public readonly sourceSpan: ParseSourceSpan) {
    super();
  }

  allocateExtraSlots(): void {}
}

export class TextInterpolate extends ir.UpdateNode implements ir.BindingSlotConsumerAspect {
  readonly[ir.BindingSlotConsumerAspect] = true;

  constructor(
      readonly id: ir.Id, public expression: InterpolationExpr,
      public readonly sourceSpan: ParseSourceSpan) {
    super();
  }

  countUpdateBindingsUsed(): number {
    return this.expression.expressions.length;
  }

  visitExpressions(visitor: o.ExpressionVisitor, ctx: any): void {
    this.expression.visitExpression(visitor, ctx);
  }
}

export class TextCreateEmitter implements ir.CreateEmitter {
  emit(node: ir.CreateNode): o.Statement|null {
    if (!(node instanceof Text)) {
      return null;
    }
    const args: o.Expression[] = [o.literal(node.slot!)];
    if (node.value !== null) {
      args.push(o.literal(node.value));
    }
    return o.importExpr(R3.text).callFn(args, node.sourceSpan).toStmt();
  }
}

export class TextUpdateEmitter implements ir.UpdateEmitter {
  emit(node: ir.UpdateNode): o.Statement|null {
    if (!(node instanceof TextInterpolate)) {
      return null;
    }
    return emitInterpolationExpr(node.expression, TEXT_INTERPOLATE_CONFIG, [], node.sourceSpan);
  }
}

const TEXT_INTERPOLATE_CONFIG: InterpolationConfig = {
  name: 'textInterpolate',
  expressionCountSpecificInstruction: [
    R3.textInterpolate,
    R3.textInterpolate1,
    R3.textInterpolate2,
    R3.textInterpolate3,
    R3.textInterpolate4,
    R3.textInterpolate5,
    R3.textInterpolate6,
    R3.textInterpolate7,
    R3.textInterpolate8,
  ],
  varExpressionCountInstruction: R3.textInterpolateV,
};
