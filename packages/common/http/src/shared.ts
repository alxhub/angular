/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

export interface SharedImmutableUpdate<K, V> {
  key: K;
  value?: V|V[];
  op: 'a' | 's' | 'd';
}

/**
 * @experimental
 */
export abstract class SharedImmutableMap<K, V, C extends SharedImmutableMap<K, V, C>> {
  protected map: Map<K, V[]> | null = null;
  private normalKeys: Map<K, K> | null = null;
  private lazyUpdate: SharedImmutableUpdate<K, V>[] | null = null;

  constructor(private lazyInit: SharedImmutableMap<K, V, C> | Function | null) {
    if (this.lazyInit !== null) {
    }
  }

  has(key: K): boolean {
    return this.get(key) !== null;
  }

  get(key: K): V|null {
    this.init();
    const values = this.map!.get(this.normalizeKey(key));
    return values && values.length > 0 ? values[0] : null;
  }

  getAll(key: K): V[]|null {
    this.init();
    return this.map!.get(this.normalizeKey(key)) || null;
  }

  append(key: K, value: V|V[]): C {
    return this.clone({key, value, op: 'a'});
  }

  set(key: K, value: V|V[]): C {
    return this.clone({key, value, op: 's'});
  }

  delete(key: K, value?: V|V[]): C {
    return this.clone({key, value, op: 'd'});
  }

  keys(): K[] {
    this.init();
    return Array.from(this.normalKeys!.values());
  }

  protected init(): void {
    if (this.map !== null) {
      return;
    }
    this.normalKeys = new Map<K, K>();
    if (typeof this.lazyInit === 'function') {
      this.map = this.lazyInit();
    } else if (this.lazyInit !== null) {
      this.map = new Map<K, V[]>();
      this.copyFrom(this.lazyInit);
      if (this.lazyUpdate !== null) {
        this.lazyUpdate.forEach(update => this.applyUpdate(update));
      }
    } else {
      this.map = new Map<K, V[]>();
    }
    this.lazyInit = null;
    this.lazyUpdate = null;
  }

  protected _set(key: K, value: V[], normalKey?: K): void {
    // Safe to reenter since this.map is already set.
    this.init();
    normalKey = normalKey || this.normalizeKey(key);
    this.map!.set(normalKey, value);
    this.maybeSetNormalKey(normalKey, key);
  }

  private applyUpdate(update: SharedImmutableUpdate<K, V>): void {
    const normalKey = this.normalizeKey(update.key);
    switch (update.op) {
      case 'a':
      case 's':
        let value: V|V[] = update.value!;
        if (!Array.isArray(value)) {
          value = [value];
        }
        if (value.length === 0) {
          return;
        }
        const base = (update.op === 'a' ? this.map!.get(normalKey) : undefined) || [];
        base.push(...value);
        this._set(update.key, base, normalKey);
        break;
      case 'd':
        const toDelete = update.value as V | undefined;
        if (!toDelete) {
          this.map!.delete(normalKey);
          this.normalKeys!.delete(normalKey);
        } else {
          let existing = this.map!.get(normalKey);
          if (!existing) {
            return;
          }
          existing = existing.filter(value => value !== toDelete);
          if (existing.length === 0) {
            this.map!.delete(normalKey);
            this.normalKeys!.delete(normalKey);
          } else {
            this.map!.set(normalKey, existing);
          }
        }
        break;
    }
  }

  private copyFrom(other: SharedImmutableMap<K, V, C>): void {
    other.init();
    Array.from(other.normalKeys!.keys()).forEach(normalKey => {
      const key = other.normalKeys!.get(normalKey)!;
      this.map!.set(normalKey, other.map!.get(normalKey)!);
      this.normalKeys!.set(normalKey, key);
    });
  }
  private clone(update: SharedImmutableUpdate<K, V>): C {
    const clone = this.newContainer();
    clone.lazyInit = (this.lazyInit !== null && this.lazyInit instanceof SharedImmutableMap) ? this.lazyInit : this;
    clone.lazyUpdate = (this.lazyUpdate || []).concat([update]);
    return clone;
  }

  protected normalizeKey(key: K): K {
    return key;
  }

  protected abstract newContainer(): C;

  protected maybeSetNormalKey(normalKey: K, key: K): void {
    if (!this.normalKeys!.has(normalKey)) {
      this.normalKeys!.set(normalKey, key);
    }
  }

  /**
   * @internal
   */
  forEach(fn: (name: K, values: V[]) => void) {
    this.init();
    Array.from(this.normalKeys!.keys())
        .forEach(key => fn(this.normalKeys!.get(key) !, this.map!.get(key) !));
  }
}
