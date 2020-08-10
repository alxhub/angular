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

export class PipeBindExpr extends ir.Expression implements ir.BindingSlotOffsetAspect {
  readonly[ir.BindingSlotConsumerAspect] = true;
  readonly[ir.BindingSlotOffsetAspect] = true;

  readonly kind = 'pipeBind';

  slot: ir.DataSlot|null = null;
  slotOffset: number|null = null;

  constructor(
      readonly id: ir.Id, readonly name: string, public value: o.Expression,
      readonly args: o.Expression[]) {
    super();
  }

  visitChildren(visitor: o.ExpressionVisitor, ctx: unknown): void {
    this.value = this.value.visitExpression(visitor, ctx);
    for (let i = 0; i < this.args.length; i++) {
      this.args[i] = this.args[i].visitExpression(visitor, ctx);
    }
  }

  countUpdateBindingsUsed(): number {
    return 2 + this.args.length;
  }

  get requiresPipeBindV(): boolean {
    return this.args.length >= PIPE_BIND_VARIANTS.length;
  }

  asPipeBindVExpr(): PipeBindVExpr {
    const res = new PipeBindVExpr(this.id, this.name, this.value, this.args);
    res.slot = this.slot;
    res.slotOffset = this.slotOffset;
    return res;
  }

  toFinalExpression(): o.Expression {
    if (this.slot === null || this.slotOffset === null) {
      throw new Error(
          `AssertionError: missing slot or binding offset: ${this.slot} / ${this.slotOffset}`);
    } else if (this.args.length >= PIPE_BIND_VARIANTS.length) {
      throw new Error(`AssertionError: too many arguments to pipe: ${this.args.length}`);
    }

    const variant = PIPE_BIND_VARIANTS[this.args.length];
    return o.importExpr(variant).callFn(
        [o.literal(this.slot), o.literal(this.slotOffset), this.value, ...this.args]);
  }
}

export class PipeBindVExpr extends ir.Expression implements ir.BindingSlotOffsetAspect {
  readonly[ir.BindingSlotConsumerAspect] = true;
  readonly[ir.BindingSlotOffsetAspect] = true;

  readonly kind = 'pipeBindV';

  slot: ir.DataSlot|null = null;
  slotOffset: number|null = null;

  arg: o.Expression;
  private bindingsUsed: number;

  constructor(
      readonly id: ir.Id, readonly name: string, value: o.Expression, args: o.Expression[]) {
    super();
    this.arg = new o.LiteralArrayExpr([value, ...args]);
    this.bindingsUsed = 2 + args.length;
  }

  visitChildren(visitor: o.ExpressionVisitor, ctx: unknown): void {
    this.arg = this.arg.visitExpression(visitor, ctx);
  }

  countUpdateBindingsUsed(): number {
    return this.bindingsUsed;
  }

  toFinalExpression(): o.Expression {
    if (this.slot === null || this.slotOffset === null) {
      throw new Error(`AssertionError: missing slot or binding offset`);
    }
    return o.importExpr(R3.pipeBindV).callFn([
      o.literal(this.slot), o.literal(this.slotOffset), this.arg
    ]);
  }
}

const PIPE_BIND_VARIANTS = [
  R3.pipeBind1,
  R3.pipeBind2,
  R3.pipeBind3,
  R3.pipeBind4,
];
