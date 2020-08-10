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


export type Selector = string|Array<string|number>;
export type ElementAttrs = Array<string|number|Selector>;

export class ElementBase extends ir.CreateNode implements ir.CreateSlotAspect {
  readonly[ir.CreateSlotAspect] = true;

  refs: ir.Reference[]|number|null = null;
  attrs: ElementAttrs|number|null = null;
  slot: ir.DataSlot|null = null;

  constructor(
      readonly id: ir.Id, public tag: string, public readonly sourceSpan: ParseSourceSpan|null) {
    super();
  }

  allocateExtraSlots(allocate: () => ir.DataSlot): void {
    if (this.refs !== null) {
      for (const ref of this.refs) {
        ref.slot = allocate();
      }
    }
  }
}

export class ElementStart extends ElementBase {
  toSelfClosingElement(): Element {
    const element = new Element(this.id, this.tag, this.sourceSpan);
    element.refs = this.refs;
    element.attrs = this.attrs;
    element.slot = this.slot;
    return element.withPrevAndNext(this.prev, this.next);
  }
}

export class Element extends ElementBase {}

export class ElementEnd extends ir.CreateNode {
  constructor(readonly id: ir.Id) {
    super();
  }
}

export class ElementEmitter implements ir.CreateEmitter {
  emit(node: ir.CreateNode): o.Statement|null {
    if (node instanceof ElementStart || node instanceof Element) {
      const instruction = node instanceof Element ? R3.element : R3.elementStart;
      return o.importExpr(instruction).callFn(produceElementParams(node), node.sourceSpan).toStmt();
    } else if (node instanceof ElementEnd) {
      return o.importExpr(R3.elementEnd).callFn([]).toStmt();
    } else {
      return null;
    }
  }
}

function produceElementParams(node: Element|ElementStart): o.Expression[] {
  const p0 = o.literal(node.slot!);
  const p1 = o.literal(node.tag);
  let p2: o.Expression = o.NULL_EXPR;
  let p3: o.Expression = o.NULL_EXPR;
  if (node.attrs !== null && typeof node.attrs === 'number') {
    p2 = o.literal(node.attrs);
  }
  if (node.refs !== null && typeof node.refs === 'number') {
    p3 = o.literal(node.refs);
  }

  if (p3 !== o.NULL_EXPR) {
    return [p0, p1, p2, p3];
  } else if (p2 !== o.NULL_EXPR) {
    return [p0, p1, p2];
  } else {
    return [p0, p1];
  }
}
