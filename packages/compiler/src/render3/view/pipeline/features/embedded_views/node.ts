/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {ConstantPool} from '../../../../../constant_pool';
import * as o from '../../../../../output/output_ast';
import {Identifiers as R3Identifiers} from '../../../../r3_identifiers';
import * as ir from '../../ir';
import {produceBodyStatements, produceTemplateFunctionParams} from '../../output/util';

export class Template extends ir.CreateNode implements ir.CreateSlotAspect {
  readonly[ir.CreateSlotAspect] = true;

  functionName: string|null = null;
  refs: ir.Reference[]|null = null;

  create = new ir.CreateList();
  update = new ir.UpdateList();

  decls: number|null = null;
  vars: number|null = null;

  slot: ir.DataSlot|null = null;

  constructor(readonly id: ir.Id, public tagName: string|null) {
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

export class TemplateEmitter implements ir.CreateEmitter {
  constructor(
      private _createEmitters: ir.CreateEmitter[], private _updateEmitters: ir.UpdateEmitter[],
      private constantPool: ConstantPool) {}

  emit(node: ir.CreateNode): o.Statement|null {
    if (!(node instanceof Template)) {
      return null;
    }

    const templateFn = o.fn(
        produceTemplateFunctionParams(),
        produceBodyStatements(node, this._createEmitters, this._updateEmitters));

    if (node.functionName === null) {
      throw new Error(`AssertionError: expected function name to be set`);
    }

    const name = `${node.functionName}_Template`;

    this.constantPool.statements.push(templateFn.toDeclStmt(name));

    return o.importExpr(R3Identifiers.templateCreate)
        .callFn([
          o.literal(node.slot!), o.variable(name), o.literal(node.decls!), o.literal(node.vars!)
        ])
        .toStmt();
  }
}
