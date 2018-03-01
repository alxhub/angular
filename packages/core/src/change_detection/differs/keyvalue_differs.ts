/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {APP_ROOT_SCOPE, inject, Injectable, Optional, SkipSelf, StaticProvider} from '../../di';

import {looseIdentical, stringify} from '../../util';
import {isJsObject} from '../change_detection_util';

/**
 * A differ that tracks changes made to an object over time.
 *
 * @stable
 */
export interface KeyValueDiffer<K, V> {
  /**
   * Compute a difference between the previous state and the new `object` state.
   *
   * @param object containing the new value.
   * @returns an object describing the difference. The return value is only valid until the next
   * `diff()` invocation.
   */
  diff(object: Map<K, V>): KeyValueChanges<K, V>;

  /**
   * Compute a difference between the previous state and the new `object` state.
   *
   * @param object containing the new value.
   * @returns an object describing the difference. The return value is only valid until the next
   * `diff()` invocation.
   */
  diff(object: {[key: string]: V}): KeyValueChanges<string, V>;
  // TODO(TS2.1): diff<KP extends string>(this: KeyValueDiffer<KP, V>, object: Record<KP, V>):
  // KeyValueDiffer<KP, V>;
}

/**
 * An object describing the changes in the `Map` or `{[k:string]: string}` since last time
 * `KeyValueDiffer#diff()` was invoked.
 *
 * @stable
 */
export interface KeyValueChanges<K, V> {
  /**
   * Iterate over all changes. `KeyValueChangeRecord` will contain information about changes
   * to each item.
   */
  forEachItem(fn: (r: KeyValueChangeRecord<K, V>) => void): void;

  /**
   * Iterate over changes in the order of original Map showing where the original items
   * have moved.
   */
  forEachPreviousItem(fn: (r: KeyValueChangeRecord<K, V>) => void): void;

  /**
   * Iterate over all keys for which values have changed.
   */
  forEachChangedItem(fn: (r: KeyValueChangeRecord<K, V>) => void): void;

  /**
   * Iterate over all added items.
   */
  forEachAddedItem(fn: (r: KeyValueChangeRecord<K, V>) => void): void;

  /**
   * Iterate over all removed items.
   */
  forEachRemovedItem(fn: (r: KeyValueChangeRecord<K, V>) => void): void;
}

/**
 * Record representing the item change information.
 *
 * @stable
 */
export interface KeyValueChangeRecord<K, V> {
  /**
   * Current key in the Map.
   */
  readonly key: K;

  /**
   * Current value for the key or `null` if removed.
   */
  readonly currentValue: V|null;

  /**
   * Previous value for the key or `null` if added.
   */
  readonly previousValue: V|null;
}

/**
 * Provides a factory for {@link KeyValueDiffer}.
 *
 * @stable
 */
export interface KeyValueDifferFactory {
  /**
   * Test to see if the differ knows how to diff this kind of object.
   */
  supports(objects: any): boolean;

  /**
   * Create a `KeyValueDiffer`.
   */
  create<K, V>(): KeyValueDiffer<K, V>;
}

/**
 * A repository of different Map diffing strategies used by NgClass, NgStyle, and others.
 * @stable
 */
@Injectable({
  scope: APP_ROOT_SCOPE,
  useFactory: () => new KeyValueDiffers([inject(DefaultKeyValueDifferFactory)]),
  deps: [],
})
export class KeyValueDiffers {
  /**
   * @deprecated v4.0.0 - Should be private.
   */
  factories: KeyValueDifferFactory[];

  constructor(factories: KeyValueDifferFactory[]) { this.factories = factories; }

  static create<S>(factories: KeyValueDifferFactory[], parent?: KeyValueDiffers): KeyValueDiffers {
    if (parent) {
      const copied = parent.factories.slice();
      factories = factories.concat(copied);
    }
    return new KeyValueDiffers(factories);
  }

  /**
   * Takes an array of {@link KeyValueDifferFactory} and returns a provider used to extend the
   * inherited {@link KeyValueDiffers} instance with the provided factories and return a new
   * {@link KeyValueDiffers} instance.
   *
   * The following example shows how to extend an existing list of factories,
   * which will only be applied to the injector for this component and its children.
   * This step is all that's required to make a new {@link KeyValueDiffer} available.
   *
   * ### Example
   *
   * ```
   * @Component({
   *   viewProviders: [
   *     KeyValueDiffers.extend([new ImmutableMapDiffer()])
   *   ]
   * })
   * ```
   */
  static extend<S>(factories: KeyValueDifferFactory[]): StaticProvider {
    return {
      provide: KeyValueDiffers,
      useFactory: (parent: KeyValueDiffers) => {
        if (!parent) {
          // Typically would occur when calling KeyValueDiffers.extend inside of dependencies passed
          // to bootstrap(), which would override default pipes instead of extending them.
          throw new Error('Cannot extend KeyValueDiffers without a parent injector');
        }
        return KeyValueDiffers.create(factories, parent);
      },
      // Dependency technically isn't optional, but we can provide a better error message this way.
      deps: [[KeyValueDiffers, new SkipSelf(), new Optional()]]
    };
  }

  find(kv: any): KeyValueDifferFactory {
    const factory = this.factories.find(f => f.supports(kv));
    if (factory) {
      return factory;
    }
    throw new Error(`Cannot find a differ supporting object '${kv}'`);
  }
}


@Injectable({
  scope: APP_ROOT_SCOPE,
})
export class DefaultKeyValueDifferFactory<K, V> implements KeyValueDifferFactory {
  constructor() {}
  supports(obj: any): boolean { return obj instanceof Map || isJsObject(obj); }

  create<K, V>(): KeyValueDiffer<K, V> { return new DefaultKeyValueDiffer<K, V>(); }
}

export class DefaultKeyValueDiffer<K, V> implements KeyValueDiffer<K, V>, KeyValueChanges<K, V> {
  private _records = new Map<K, KeyValueChangeRecord_<K, V>>();
  private _mapHead: KeyValueChangeRecord_<K, V>|null = null;
  // _appendAfter is used in the check loop
  private _appendAfter: KeyValueChangeRecord_<K, V>|null = null;
  private _previousMapHead: KeyValueChangeRecord_<K, V>|null = null;
  private _changesHead: KeyValueChangeRecord_<K, V>|null = null;
  private _changesTail: KeyValueChangeRecord_<K, V>|null = null;
  private _additionsHead: KeyValueChangeRecord_<K, V>|null = null;
  private _additionsTail: KeyValueChangeRecord_<K, V>|null = null;
  private _removalsHead: KeyValueChangeRecord_<K, V>|null = null;
  private _removalsTail: KeyValueChangeRecord_<K, V>|null = null;

  get isDirty(): boolean {
    return this._additionsHead !== null || this._changesHead !== null ||
        this._removalsHead !== null;
  }

  forEachItem(fn: (r: KeyValueChangeRecord<K, V>) => void) {
    let record: KeyValueChangeRecord_<K, V>|null;
    for (record = this._mapHead; record !== null; record = record._next) {
      fn(record);
    }
  }

  forEachPreviousItem(fn: (r: KeyValueChangeRecord<K, V>) => void) {
    let record: KeyValueChangeRecord_<K, V>|null;
    for (record = this._previousMapHead; record !== null; record = record._nextPrevious) {
      fn(record);
    }
  }

  forEachChangedItem(fn: (r: KeyValueChangeRecord<K, V>) => void) {
    let record: KeyValueChangeRecord_<K, V>|null;
    for (record = this._changesHead; record !== null; record = record._nextChanged) {
      fn(record);
    }
  }

  forEachAddedItem(fn: (r: KeyValueChangeRecord<K, V>) => void) {
    let record: KeyValueChangeRecord_<K, V>|null;
    for (record = this._additionsHead; record !== null; record = record._nextAdded) {
      fn(record);
    }
  }

  forEachRemovedItem(fn: (r: KeyValueChangeRecord<K, V>) => void) {
    let record: KeyValueChangeRecord_<K, V>|null;
    for (record = this._removalsHead; record !== null; record = record._nextRemoved) {
      fn(record);
    }
  }

  diff(map?: Map<any, any>|{[k: string]: any}|null): any {
    if (!map) {
      map = new Map();
    } else if (!(map instanceof Map || isJsObject(map))) {
      throw new Error(
          `Error trying to diff '${stringify(map)}'. Only maps and objects are allowed`);
    }

    return this.check(map) ? this : null;
  }

  onDestroy() {}

  /**
   * Check the current state of the map vs the previous.
   * The algorithm is optimised for when the keys do no change.
   */
  check(map: Map<any, any>|{[k: string]: any}): boolean {
    this._reset();

    let insertBefore = this._mapHead;
    this._appendAfter = null;

    this._forEach(map, (value: any, key: any) => {
      if (insertBefore && insertBefore.key === key) {
        this._maybeAddToChanges(insertBefore, value);
        this._appendAfter = insertBefore;
        insertBefore = insertBefore._next;
      } else {
        const record = this._getOrCreateRecordForKey(key, value);
        insertBefore = this._insertBeforeOrAppend(insertBefore, record);
      }
    });

    // Items remaining at the end of the list have been deleted
    if (insertBefore) {
      if (insertBefore._prev) {
        insertBefore._prev._next = null;
      }

      this._removalsHead = insertBefore;

      for (let record: KeyValueChangeRecord_<K, V>|null = insertBefore; record !== null;
           record = record._nextRemoved) {
        if (record === this._mapHead) {
          this._mapHead = null;
        }
        this._records.delete(record.key);
        record._nextRemoved = record._next;
        record.previousValue = record.currentValue;
        record.currentValue = null;
        record._prev = null;
        record._next = null;
      }
    }

    // Make sure tails have no next records from previous runs
    if (this._changesTail) this._changesTail._nextChanged = null;
    if (this._additionsTail) this._additionsTail._nextAdded = null;

    return this.isDirty;
  }

  /**
   * Inserts a record before `before` or append at the end of the list when `before` is null.
   *
   * Notes:
   * - This method appends at `this._appendAfter`,
   * - This method updates `this._appendAfter`,
   * - The return value is the new value for the insertion pointer.
   */
  private _insertBeforeOrAppend(
      before: KeyValueChangeRecord_<K, V>|null,
      record: KeyValueChangeRecord_<K, V>): KeyValueChangeRecord_<K, V>|null {
    if (before) {
      const prev = before._prev;
      record._next = before;
      record._prev = prev;
      before._prev = record;
      if (prev) {
        prev._next = record;
      }
      if (before === this._mapHead) {
        this._mapHead = record;
      }

      this._appendAfter = before;
      return before;
    }

    if (this._appendAfter) {
      this._appendAfter._next = record;
      record._prev = this._appendAfter;
    } else {
      this._mapHead = record;
    }

    this._appendAfter = record;
    return null;
  }

  private _getOrCreateRecordForKey(key: K, value: V): KeyValueChangeRecord_<K, V> {
    if (this._records.has(key)) {
      const record = this._records.get(key) !;
      this._maybeAddToChanges(record, value);
      const prev = record._prev;
      const next = record._next;
      if (prev) {
        prev._next = next;
      }
      if (next) {
        next._prev = prev;
      }
      record._next = null;
      record._prev = null;

      return record;
    }

    const record = new KeyValueChangeRecord_<K, V>(key);
    this._records.set(key, record);
    record.currentValue = value;
    this._addToAdditions(record);
    return record;
  }

  /** @internal */
  _reset() {
    if (this.isDirty) {
      let record: KeyValueChangeRecord_<K, V>|null;
      // let `_previousMapHead` contain the state of the map before the changes
      this._previousMapHead = this._mapHead;
      for (record = this._previousMapHead; record !== null; record = record._next) {
        record._nextPrevious = record._next;
      }

      // Update `record.previousValue` with the value of the item before the changes
      // We need to update all changed items (that's those which have been added and changed)
      for (record = this._changesHead; record !== null; record = record._nextChanged) {
        record.previousValue = record.currentValue;
      }
      for (record = this._additionsHead; record != null; record = record._nextAdded) {
        record.previousValue = record.currentValue;
      }

      this._changesHead = this._changesTail = null;
      this._additionsHead = this._additionsTail = null;
      this._removalsHead = null;
    }
  }

  // Add the record or a given key to the list of changes only when the value has actually changed
  private _maybeAddToChanges(record: KeyValueChangeRecord_<K, V>, newValue: any): void {
    if (!looseIdentical(newValue, record.currentValue)) {
      record.previousValue = record.currentValue;
      record.currentValue = newValue;
      this._addToChanges(record);
    }
  }

  private _addToAdditions(record: KeyValueChangeRecord_<K, V>) {
    if (this._additionsHead === null) {
      this._additionsHead = this._additionsTail = record;
    } else {
      this._additionsTail !._nextAdded = record;
      this._additionsTail = record;
    }
  }

  private _addToChanges(record: KeyValueChangeRecord_<K, V>) {
    if (this._changesHead === null) {
      this._changesHead = this._changesTail = record;
    } else {
      this._changesTail !._nextChanged = record;
      this._changesTail = record;
    }
  }

  /** @internal */
  private _forEach<K, V>(obj: Map<K, V>|{[k: string]: V}, fn: (v: V, k: any) => void) {
    if (obj instanceof Map) {
      obj.forEach(fn);
    } else {
      Object.keys(obj).forEach(k => fn(obj[k], k));
    }
  }
}


/**
 * @stable
 */
class KeyValueChangeRecord_<K, V> implements KeyValueChangeRecord<K, V> {
  previousValue: V|null = null;
  currentValue: V|null = null;

  /** @internal */
  _nextPrevious: KeyValueChangeRecord_<K, V>|null = null;
  /** @internal */
  _next: KeyValueChangeRecord_<K, V>|null = null;
  /** @internal */
  _prev: KeyValueChangeRecord_<K, V>|null = null;
  /** @internal */
  _nextAdded: KeyValueChangeRecord_<K, V>|null = null;
  /** @internal */
  _nextRemoved: KeyValueChangeRecord_<K, V>|null = null;
  /** @internal */
  _nextChanged: KeyValueChangeRecord_<K, V>|null = null;

  constructor(public key: K) {}
}
