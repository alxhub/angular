/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {defaultEquals, ValueEqualityFn} from './equality';
import {throwInvalidWriteToSignalError} from './errors';
import {producerAccessed, producerNotifyConsumers, producerUpdatesAllowed, REACTIVE_NODE, ReactiveNode, SIGNAL} from './graph';

/**
 * If set, called after `WritableSignal`s are updated.
 *
 * This hook can be used to achieve various effects, such as running effects synchronously as part
 * of setting a signal.
 */
let postSignalSetFn: (() => void)|null = null;

export interface SignalNode<T> extends ReactiveNode {
  value: T;
  equal: ValueEqualityFn<T>;
  [SIGNAL]: this;
}

export type SignalGetter<T> = (() => T)&{
  [SIGNAL]: SignalNode<T>;
};

export type SignalGetterOrNode<T> = SignalGetter<T>|SignalNode<T>;

/**
 * Create a `Signal` that can be set or updated directly.
 */
export function createSignal<T>(initialValue: T): SignalGetter<T> {
  const node: SignalNode<T> = Object.create(SIGNAL_NODE);
  node.value = initialValue;
  const getter = (() => {
                   producerAccessed(node);
                   return node.value;
                 }) as SignalGetter<T>;
  getter[SIGNAL] = node;
  return getter;
}

export function setPostSignalSetFn(fn: (() => void)|null): (() => void)|null {
  const prev = postSignalSetFn;
  postSignalSetFn = fn;
  return prev;
}

export function signalGetFn<T>(this: SignalNode<T>): T {
  producerAccessed(this);
  return this.value;
}

export function signalSetFn<T>(this: SignalGetter<T>, newValue: T) {
  const node = this[SIGNAL];
  if (!producerUpdatesAllowed()) {
    throwInvalidWriteToSignalError();
  }

  if (!node.equal(node.value, newValue)) {
    node.value = newValue;
    signalValueChanged(node);
  }
}

export function signalUpdateFn<T>(this: SignalGetterOrNode<T>, updater: (value: T) => T): void {
  if (!producerUpdatesAllowed()) {
    throwInvalidWriteToSignalError();
  }

  signalSetFn.call(this as any, updater(this[SIGNAL].value) as any);
}

export function signalMutateFn<T>(this: SignalGetterOrNode<T>, mutator: (value: T) => void): void {
  const node = this[SIGNAL];
  if (!producerUpdatesAllowed()) {
    throwInvalidWriteToSignalError();
  }
  // Mutate bypasses equality checks as it's by definition changing the value.
  mutator(node.value);
  signalValueChanged(node);
}

// Note: Using an IIFE here to ensure that the spread assignment is not considered
// a side-effect, ending up preserving `COMPUTED_NODE` and `REACTIVE_NODE`.
// TODO: remove when https://github.com/evanw/esbuild/issues/3392 is resolved.
const SIGNAL_NODE: object = /* @__PURE__ */ (() => {
  const node = {
    ...REACTIVE_NODE,
    equal: defaultEquals,
    value: undefined,
  };
  // We're using `Object.defineProperty` instead of a getter because Closure can't handle getters on
  // object literals.
  Object.defineProperty(node, SIGNAL, {
    get: function(this: SignalNode<unknown>): SignalNode<unknown> {
      return this;
    },
  });
  return node;
})();

function signalValueChanged<T>(node: SignalNode<T>): void {
  node.version++;
  producerNotifyConsumers(node);
  postSignalSetFn?.();
}
