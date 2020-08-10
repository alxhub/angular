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

import {countBindings} from './util';

export class ClassProp extends ir.UpdateNode implements ir.BindingSlotConsumerAspect,
                                                        ir.UpdateSlotAspect {
  readonly[ir.BindingSlotConsumerAspect] = true;
  readonly[ir.UpdateSlotAspect] = true;

  slot: ir.DataSlot|null = null;

  constructor(
      readonly id: ir.Id, public name: string, public expression: o.Expression,
      public readonly sourceSpan: ParseSourceSpan|null) {
    super();
  }

  visitExpressions(visitor: o.ExpressionVisitor, ctx: any): void {
    this.expression.visitExpression(visitor, ctx);
  }

  countUpdateBindingsUsed(): number {
    return countBindings(this.expression);
  }
}

export class ClassMap extends ir.UpdateNode implements ir.BindingSlotConsumerAspect,
                                                       ir.UpdateSlotAspect {
  readonly[ir.BindingSlotConsumerAspect] = true;
  readonly[ir.UpdateSlotAspect] = true;

  slot: ir.DataSlot|null = null;

  constructor(
      readonly id: ir.Id, public expression: o.Expression,
      public readonly sourceSpan: ParseSourceSpan|null) {
    super();
  }

  visitExpressions(visitor: o.ExpressionVisitor, ctx: any): void {
    this.expression.visitExpression(visitor, ctx);
  }

  countUpdateBindingsUsed(): number {
    return countBindings(this.expression);
  }
}

export class ClassEmitter implements ir.UpdateEmitter {
  emit(node: ir.UpdateNode): o.Statement|null {
    if (node instanceof ClassProp) {
      // ɵɵclassProp()
      return o.importExpr(R3.classProp)
          .callFn(
              [
                o.literal(node.name),
                node.expression,
              ],
              node.sourceSpan)
          .toStmt();

    } else if (node instanceof ClassMap) {
      // ɵɵclassMap()
      if (node.expression instanceof InterpolationExpr) {
        return emitInterpolationExpr(
            node.expression, CLASS_MAP_INTERPOLATION_CONFIG, [], node.sourceSpan);
      } else {
        return o.importExpr(R3.classMap)
            .callFn(
                [
                  node.expression,
                ],
                node.sourceSpan)
            .toStmt();
      }
    }
    return null;
  }
}

const CLASS_MAP_INTERPOLATION_CONFIG: InterpolationConfig = {
  name: 'classMapInterpolate',
  expressionCountSpecificInstruction: [
    R3.classMap,
    R3.classMapInterpolate1,
    R3.classMapInterpolate2,
    R3.classMapInterpolate3,
    R3.classMapInterpolate4,
    R3.classMapInterpolate5,
    R3.classMapInterpolate6,
    R3.classMapInterpolate7,
    R3.classMapInterpolate8,
  ],
  varExpressionCountInstruction: R3.classMapInterpolateV,
};
