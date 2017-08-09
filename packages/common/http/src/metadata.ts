/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {SharedImmutableMap} from './shared';

export class HttpMetadataKey<T> {
  constructor(public desc: string) {}
}  

export class HttpMetadata extends SharedImmutableMap<HttpMetadataKey<any>, any, HttpMetadata> {
  constructor() {
    super(null);
  }

  protected newContainer(): HttpMetadata {
    return new HttpMetadata();
  }

  get<T>(key: HttpMetadataKey<T>): T;
  get(key: HttpMetadataKey<any>): any;
  get(key: HttpMetadataKey<any>): any {
    return super.get(key);
  }
}