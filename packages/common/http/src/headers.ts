/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {SharedImmutableMap} from './shared';

/**
 * Immutable set of Http headers, with lazy parsing.
 * @experimental
 */
export class HttpHeaders extends SharedImmutableMap<string, string, HttpHeaders> {

  constructor(headers?: string|{[name: string]: string | string[]}) {
    let lazyInit: Function|null = null;
    if (typeof headers === 'string') {
      lazyInit = () => {
        const map = new Map<string, string[]>();
        headers.split('\n').forEach(line => {
          const index = line.indexOf(':');
          if (index > 0) {
            const name = line.slice(0, index);
            const key = name.toLowerCase();
            const value = line.slice(index + 1).trim();
            this.maybeSetNormalKey(name, key);
            if (map.has(key)) {
              map.get(key) !.push(value);
            } else {
              map.set(key, [value]);
            }
          }
        });
        return map;
      };
    } else if (headers !== undefined) {
      lazyInit = () => {
        const map = new Map<string, string[]>();
        Object.keys(headers).forEach(name => {
          let values: string|string[] = headers[name];
          const key = name.toLowerCase();
          if (typeof values === 'string') {
            values = [values];
          }
          if (values.length > 0) {
            map.set(key, values);
            this.maybeSetNormalKey(key, name);
          }
        });
        return map;
      };
    }
    super(lazyInit);
  }

  protected normalizeKey(key: string): string {
    return key.toLowerCase();
  }

  protected newContainer(): HttpHeaders {
    return new HttpHeaders();
  }
}
