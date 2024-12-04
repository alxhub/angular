/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * Type of the options argument to [`inject`](api/core/inject).
 *
 * @publicApi
 */
export interface InjectOptions {
  /**
   * Use optional injection, and return `null` if the requested token is not found.
   */
  optional?: boolean;

  /**
   * Start injection at the parent of the current injector.
   */
  skipSelf?: boolean;

  /**
   * Only query the current injector for the token, and don't fall back to the parent injector if
   * it's not found.
   */
  self?: boolean;

  /**
   * Stop injection at the host component's injector. Only relevant when injecting from an element
   * injector, and a no-op for environment injectors.
   */
  host?: boolean;
}
