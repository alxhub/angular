/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {CreateList, CreateNode, Id, UpdateList} from '../node';
import {RootTemplate} from '../root';

export const TemplateAspect = Symbol('TemplateAspect');
export const TemplateWithIdAspect = Symbol('TemplateWithIdAspect');

/**
 * Indicates that an entity represents a template definition (either a top-level component template
 * or an embedded view).
 *
 * This aspect abstracts over a template definition, allowing nested template structures to be
 * processed without depending on the specific `CreateNode` type(s) which represent embedded views.
 */
export interface TemplateAspect {
  [TemplateAspect]: true;

  /**
   * The list of `CreateNode`s for this template.
   */
  create: CreateList;

  /**
   * The list of `UpdateNode`s for this template.
   */
  update: UpdateList;

  /**
   * Number of `DataSlot`s used by this template (see `CreateSlotAspect`).
   */
  decls: number|null;

  /**
   * Number of update binding slots used by this template (see `BindingSlotConsumerAspect`).
   */
  vars: number|null;
}

/**
 * Indicates that a `CreateNode`, in addition to having `TemplateAspect` fields for the template
 * definition, also have an `Id`.
 */
export interface TemplateWithIdAspect extends TemplateAspect {
  [TemplateWithIdAspect]: true;

  /**
   * `Id` of the `CreateNode` which defines this embedded view.
   */
  id: Id;
}

export function hasTemplateAspect(node: RootTemplate): node is RootTemplate&TemplateAspect;
export function hasTemplateAspect<T extends CreateNode>(node: T): node is T&TemplateWithIdAspect;
/**
 * Whether the given `entity` represents a template definition.
 *
 * Embedded views are `CreateNode`s and thus have `TemplateWithIdAspect`. The root template does not
 * have an ID, and is only a `TemplateAspect`.
 */
export function hasTemplateAspect(node: CreateNode|RootTemplate): boolean {
  if (node instanceof RootTemplate) {
    return (node as any)[TemplateAspect] === true;
  } else {
    return (node as any)[TemplateWithIdAspect] === true;
  }
}
