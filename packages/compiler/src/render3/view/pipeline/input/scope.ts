/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ir from '../ir';

const ROOT_CONTEXT: ir.RootContext = {
  kind: ir.TargetKind.RootContext,
};

/**
 * Tracks named entities in the nested structure of a template.
 *
 * A `Scope` represents a given view (either a root template or an embedded view) and tracks any
 * references or variables declared in/for that view, plus the `Scope`s of any child views.
 */
export class Scope implements ir.Scope {
  /**
   * Map of names declared in this scope to metadata about the named entity.
   *
   * This is left readable for consumers to iterate over all such entities.
   */
  readonly targets = new Map<string, ir.Target>();

  /**
   * Map of child embedded view `ir.Id`s to the `Scope`s for those views.
   */
  private children = new Map<ir.Id, Scope>();

  private constructor(private idGen: IdGenerator, readonly parent: Scope|null) {}

  static root(): Scope {
    return new Scope(new IdGenerator(), /* parent */ null);
  }

  /**
   * Allocate a new `ir.Id`.
   *
   * All `Scope`s nested within the same `ir.RootTemplate` share their ID namespace, so it does not
   * matter at which level `allocateId()` is called.
   */
  allocateId(): ir.Id {
    return this.idGen.next();
  }

  /**
   * Record `name` as a reference declared within this `Scope`.
   */
  recordReference(name: string, toElementId: ir.Id, value: string): ir.Reference {
    const ref: ir.Reference = {
      kind: ir.TargetKind.Reference,
      slot: null,
      element: toElementId,
      name,
      value,
    };

    this.targets.set(name, ref);
    return ref;
  }

  /**
   *  Record `
   */
  recordVariable(name: string, templateId: ir.Id, value: string): void {
    this.targets.set(name, {
      kind: ir.TargetKind.Variable,
      template: templateId,
      value,
    });
  }

  lookup(name: string): ir.Target {
    if (this.targets.has(name)) {
      return this.targets.get(name)!;
    } else if (this.parent !== null) {
      return this.parent.lookup(name);
    } else {
      return ROOT_CONTEXT;
    }
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
