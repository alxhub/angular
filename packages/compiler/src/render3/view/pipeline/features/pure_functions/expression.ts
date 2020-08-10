/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as o from '../../../../../output/output_ast';
import {Identifiers as R3} from '../../../../r3_identifiers';
import * as ir from '../../ir';

export class PureFunctionExpr extends ir.Expression implements ir.BindingSlotOffsetAspect {
  readonly[ir.BindingSlotConsumerAspect] = true;
  readonly[ir.BindingSlotOffsetAspect] = true;

  readonly kind = 'PureFunctionExpr';
  slotOffset: number|null = null;

  constructor(public fn: o.Expression, public args: o.Expression[]) {
    super();
  }

  visitChildren(visitor: ir.ExpressionVisitor, ctx: any): void {
    for (let i = 0; i < this.args.length; i++) {
      this.args[i] = this.args[i].visitExpression(visitor, ctx);
    }
  }

  toFinalExpression(): o.Expression {
    if (this.slotOffset === null) {
      throw new Error('AssertionError: slot offset should have been set for PureFunctionExpr');
    }
    const startingArgs = [o.literal(this.slotOffset), this.fn];
    if (this.args.length < PURE_FUNCTION_INSTRUCTION.length) {
      return o.importExpr(PURE_FUNCTION_INSTRUCTION[this.args.length]).callFn([
        ...startingArgs,
        ...this.args,
      ]);
    } else {
      return o.importExpr(R3.pureFunctionV).callFn([
        ...startingArgs,
        o.literalArr(this.args),
      ]);
    }
  }

  countUpdateBindingsUsed(): number {
    return 1 + this.args.length;
  }
}

const PURE_FUNCTION_INSTRUCTION = [
  R3.pureFunction0,
  R3.pureFunction1,
  R3.pureFunction2,
  R3.pureFunction3,
  R3.pureFunction4,
  R3.pureFunction5,
  R3.pureFunction6,
  R3.pureFunction7,
  R3.pureFunction8,
];
