/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ir from '../ir';

export enum TargetKind {
  Reference,
  Variable,
  RootContext,
}

export interface Reference extends ir.Reference {
  kind: TargetKind.Reference;
  element: ir.Id;
}

export interface Variable {
  kind: TargetKind.Variable;
  template: ir.Id;
  value: string;
}

export interface RootContext {
  kind: TargetKind.RootContext;
}
const ROOT_CONTEXT: RootContext = {
  kind: TargetKind.RootContext,
};

export type Target = Reference|Variable|RootContext;


export class Scope implements ir.Scope {
  readonly targets = new Map<string, Target>();
  private children = new Map<ir.Id, Scope>();

  constructor(private idGen: IdGenerator, readonly parent: Scope|null) {}

  allocateId(): ir.Id {
    return this.idGen.next();
  }

  recordReference(name: string, toElementId: ir.Id, value: string): Reference {
    const ref: Reference = {
      kind: TargetKind.Reference,
      slot: null,
      element: toElementId,
      name,
      value,
    };

    this.targets.set(name, ref);
    return ref;
  }

  recordVariable(name: string, templateId: ir.Id, value: string): void {
    this.targets.set(name, {
      kind: TargetKind.Variable,
      template: templateId,
      value,
    });
  }

  lookup(name: string): Target {
    if (this.targets.has(name)) {
      return this.targets.get(name)!;
    } else if (this.parent !== null) {
      return this.parent.lookup(name);
    } else {
      return ROOT_CONTEXT;
    }
  }

  static root(): Scope {
    return new Scope(new IdGenerator(), /* parent */ null);
  }

  child(id: ir.Id): Scope {
    const childScope = new Scope(this.idGen, this);
    this.children.set(id, childScope);
    return childScope;
  }

  getChild(id: ir.Id): Scope {
    if (!this.children.has(id)) {
      throw new Error(`AssertionError: unknown child scope for CirId(${id})`);
    }
    return this.children.get(id)!;
  }
}

class IdGenerator {
  private id = 0;

  next(): ir.Id {
    return this.id++ as ir.Id;
  }
}
