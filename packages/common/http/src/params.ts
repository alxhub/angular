/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {SharedImmutableMap} from './shared';

/**
 * A codec for encoding and decoding parameters in URLs.
 *
 * Used by `HttpParams`.
 *
 *  @experimental
 **/
export interface HttpParameterCodec {
  encodeKey(key: string): string;
  encodeValue(value: string): string;

  decodeKey(key: string): string;
  decodeValue(value: string): string;
}

/**
 * A `HttpParameterCodec` that uses `encodeURIComponent` and `decodeURIComponent` to
 * serialize and parse URL parameter keys and values.
 *
 * @experimental
 */
export class HttpUrlEncodingCodec implements HttpParameterCodec {
  encodeKey(k: string): string { return standardEncoding(k); }

  encodeValue(v: string): string { return standardEncoding(v); }

  decodeKey(k: string): string { return decodeURIComponent(k); }

  decodeValue(v: string) { return decodeURIComponent(v); }
}


function paramParser(rawParams: string, codec: HttpParameterCodec): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (rawParams.length > 0) {
    const params: string[] = rawParams.split('&');
    params.forEach((param: string) => {
      const eqIdx = param.indexOf('=');
      const [key, val]: string[] = eqIdx == -1 ?
          [codec.decodeKey(param), ''] :
          [codec.decodeKey(param.slice(0, eqIdx)), codec.decodeValue(param.slice(eqIdx + 1))];
      const list = map.get(key) || [];
      list.push(val);
      map.set(key, list);
    });
  }
  return map;
}
function standardEncoding(v: string): string {
  return encodeURIComponent(v)
      .replace(/%40/gi, '@')
      .replace(/%3A/gi, ':')
      .replace(/%24/gi, '$')
      .replace(/%2C/gi, ',')
      .replace(/%3B/gi, ';')
      .replace(/%2B/gi, '+')
      .replace(/%3D/gi, '=')
      .replace(/%3F/gi, '?')
      .replace(/%2F/gi, '/');
}

/**
 * An HTTP request/response body that represents serialized parameters,
 * per the MIME type `application/x-www-form-urlencoded`.
 *
 * This class is immuatable - all mutation operations return a new instance.
 *
 * @experimental
 */
export class HttpParams extends SharedImmutableMap<string, string, HttpParams> {
  private encoder: HttpParameterCodec;

  constructor(options: {
    fromString?: string,
    fromObject?: {[param: string]: string | string[]},
    encoder?: HttpParameterCodec,
  } = {}) {
    let lazyInit: Function|null = null;
    if (!!options.fromString) {
      if (!!options.fromObject) {
        throw new Error(`Cannot specify both fromString and fromObject.`);
      }
      lazyInit = () => {
        const map = paramParser(options.fromString!, this.encoder);
        Array.from(map.keys()).forEach(key => this.maybeSetNormalKey(key, key));
        return map;
      };
    } else if (!!options.fromObject) {

      Object.keys(options.fromObject).forEach(key => {
        const value = (options.fromObject as any)[key];
        this._set(key, Array.isArray(value) ? value : [value]);
      });
    }
    super(lazyInit);
    this.encoder = options.encoder || new HttpUrlEncodingCodec();
  }

  /**
   * Serialize the body to an encoded string, where key-value pairs (separated by `=`) are
   * separated by `&`s.
   */
  toString(): string {
    this.init();
    return this.keys()
        .map(key => {
          const eKey = this.encoder.encodeKey(key);
          return this.map !.get(key) !.map(value => eKey + '=' + this.encoder.encodeValue(value))
              .join('&');
        })
        .join('&');
  }

  newContainer(): HttpParams {
    return new HttpParams();
  }
}
