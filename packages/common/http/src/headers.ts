/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/**
 * Immutable set of Http headers, with lazy parsing.
 * @experimental
 */
export class HttpHeaders {
  /**
   * Internal map of header names to values. Keyed from names
   * (cased according to the case map) to values.
   *
   * @internal
   */
  headers: Map<string, string[]>;


  /**
   * Internal map of lowercased header names to the normalized
   * form of the name (the form seen first). Headers in the `headers`
   * map are keyed by the values in this map.
   *
   * @internal
   */
  normalizedNames: Map<string, string> = new Map();

  /**
   * Complete the lazy initialization of this object (needed before reading).
   */
  lazyInit: Function|null;

  constructor(headers?: string | {[name: string]: string|string[]}) {
    if (!headers) {
      this.headers = new Map<string, string[]>();
    } else if (typeof headers === 'string') {
      this.lazyInit = () => {
        this.headers = new Map<string, string[]>();
        headers.split('\n').forEach(line => {
          const index = line.indexOf(':');
          if (index > 0) {
            const key = this.keyFor(line.slice(0, index));
            const value = line.slice(index + 1).trim();
            if (this.headers.has(key)) {
              this.headers.get(key)!.push(value);
            } else {
              this.headers.set(key, [value]);
            }
          }
        });
      };
    } else {
      this.lazyInit = () => {
        this.headers = new Map<string, string[]>();
        Object.keys(headers).forEach(name => {
          const key = this.keyFor(name);
          const values = headers[key];
          if (typeof values === 'string') {
            this.headers.set(key, [values]);
          } else {
            this.headers.set(key, values);
          }
        });
      };
    }
  }

  private normalizeNames() {
    const names = this.headers.forEach((_, key) => {
      this.normalizedNames.set(key.toLowerCase(), key);
    });
  }

  private keyFor(name: string): string {
    const lcName = name.toLowerCase();
    const normalized = this.normalizedNames.get(lcName);
    if (normalized === undefined) {
      this.normalizedNames.set(lcName, name);
      return name;
    }
    return normalized;
  }

  private normalize(name: string): string|null {
    if (!!this.lazyInit) {
      this.lazyInit();
      this.lazyInit = null;
    }
    return this.normalizedNames.get(name) || null;
  }

  /**
   * Returns first header that matches given name.
   */
  get(name: string): string|null {
    if (!!this.lazyInit) {
      this.lazyInit();
      this.lazyInit = null;
    }
    const normalized = this.normalizedNames.get(name);
    if (!normalized || !this.headers.has(name)) {
      return null;
    }

    const values = this.headers.get(normalized)!;
    return values.length > 0 ? values[0] : null;
  }

  /**
   * Checks for existence of header by given name.
   */
  has(name: string): boolean {
  }

  /**
   * Returns the names of the headers
   */
  keys(): string[] { return Array.from(this._normalizedNames.values()); }

  /**
   * Sets or overrides header value for given name.
   */
  set(name: string, value: string|string[]): void {
    if (Array.isArray(value)) {
      if (value.length) {
        this._headers.set(name.toLowerCase(), [value.join(',')]);
      }
    } else {
      this._headers.set(name.toLowerCase(), [value]);
    }
    this.mayBeSetNormalizedName(name);
  }

  /**
   * Returns values of all headers.
   */
  values(): string[][] { return Array.from(this._headers.values()); }

  /**
   * Returns string of all headers.
   */
  // TODO(vicb): returns {[name: string]: string[]}
  toJSON(): {[name: string]: any} {
    const serialized: {[name: string]: string[]} = {};

    this._headers.forEach((values: string[], name: string) => {
      const split: string[] = [];
      values.forEach(v => split.push(...v.split(',')));
      serialized[this._normalizedNames.get(name) !] = split;
    });

    return serialized;
  }

  /**
   * Returns list of header values for a given name.
   */
  getAll(name: string): string[]|null {
    return this.has(name) ? this._headers.get(name.toLowerCase()) || null : null;
  }

  /**
   * This method is not implemented.
   */
  entries() { throw new Error('"entries" method is not implemented on Headers class'); }

  private mayBeSetNormalizedName(name: string): void {
    const lcName = name.toLowerCase();

    if (!this._normalizedNames.has(lcName)) {
      this._normalizedNames.set(lcName, name);
    }
  }
}
