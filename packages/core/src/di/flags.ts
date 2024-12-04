/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {InjectOptions} from './options';

/**
 * This enum is a copy of the `InjectFlags` enum above, but the difference is that this is a
 * const enum, so actual enum values would be inlined in generated code. The `InjectFlags` enum can
 * be turned into a const enum when ViewEngine is removed (see TODO at the `InjectFlags` enum
 * above). The benefit of inlining is that we can use these flags at the top level without affecting
 * tree-shaking (see "no-toplevel-property-access" tslint rule for more info).
 * Keep this enum in sync with `InjectFlags` enum above.
 */
export const enum InternalInjectFlags {
  /** Check self and check parent injector if needed */
  Default = 0b0000,

  /**
   * Specifies that an injector should retrieve a dependency from any injector until reaching the
   * host element of the current component. (Only used with Element Injector)
   */
  Host = 0b0001,

  /** Don't ascend to ancestors of the node requesting injection. */
  Self = 0b0010,

  /** Skip the node that is requesting injection. */
  SkipSelf = 0b0100,

  /** Inject `defaultValue` instead if token not found. */
  Optional = 0b1000,

  /**
   * This token is being injected into a pipe.
   *
   * This flag is intentionally not in the public facing `InjectFlags` because it is only added by
   * the compiler and is not a developer applicable flag.
   */
  ForPipe = 0b10000,
}

/**
 * Injection flags for DI.
 *
 * @publicApi
 * @deprecated use an options object for [`inject`](api/core/inject) instead.
 */
export enum InjectFlags {
  /** Check self and check parent injector if needed */
  // tslint:disable-next-line: no-toplevel-property-access
  Default = InternalInjectFlags.Default,

  /**
   * Specifies that an injector should retrieve a dependency from any injector until reaching the
   * host element of the current component. (Only used with Element Injector)
   */
  // tslint:disable-next-line: no-toplevel-property-access
  Host = InternalInjectFlags.Host,

  /** Don't ascend to ancestors of the node requesting injection. */
  // tslint:disable-next-line: no-toplevel-property-access
  Self = InternalInjectFlags.Self,

  /** Skip the node that is requesting injection. */
  // tslint:disable-next-line: no-toplevel-property-access
  SkipSelf = InternalInjectFlags.SkipSelf,

  /** Inject `defaultValue` instead if token not found. */
  // tslint:disable-next-line: no-toplevel-property-access
  Optional = InternalInjectFlags.Optional,
}

/**
 * Special flag indicating that a decorator is of type `Inject`. It's used to make `Inject`
 * decorator tree-shakable (so we don't have to rely on the `instanceof` checks).
 * Note: this flag is not included into the `InjectFlags` since it's an internal-only API.
 */
export const enum DecoratorFlags {
  Inject = -1,
}

// Converts object-based DI flags (`InjectOptions`) to bit flags (`InjectFlags`).
export function convertToBitFlags(flags: InjectOptions | InjectFlags): InjectFlags {
  if (typeof flags === 'number') {
    return flags;
  }

  // While TypeScript doesn't accept it without a cast, bitwise OR with false-y values in
  // JavaScript is a no-op. We can use that for a very codesize-efficient conversion from
  // `InjectOptions` to `InjectFlags`.
  return (InjectFlags.Default | // comment to force a line break in the formatter
    ((flags.optional && InjectFlags.Optional) as number) |
    ((flags.host && InjectFlags.Host) as number) |
    ((flags.self && InjectFlags.Self) as number) |
    ((flags.skipSelf && InjectFlags.SkipSelf) as number)) as InjectFlags;
}
