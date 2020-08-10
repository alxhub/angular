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

export class Pipe extends ir.CreateNode implements ir.CreateSlotAspect {
  readonly[ir.CreateSlotAspect] = true;

  slot: ir.DataSlot|null = null;

  constructor(readonly id: ir.Id, readonly name: string) {
    super();
  }

  allocateExtraSlots(): void {}
}

export class PipeEmitter implements ir.CreateEmitter {
  emit(node: ir.CreateNode): o.Statement|null {
    if (!(node instanceof Pipe)) {
      return null;
    }

    if (node.slot === null) {
      throw new Error(`Slot should have been allocated`);
    }
    return o.importExpr(R3.pipe).callFn([o.literal(node.slot), o.literal(node.name)]).toStmt();
  }
}
