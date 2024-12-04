/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Type} from '../interface/type';
import {RuntimeError, RuntimeErrorCode} from '../errors';
import {resolveForwardRef} from '../forward_ref';
import {ProviderToken} from './provider_token';
import {inject} from './inject';
import {DecoratorFlags, InjectFlags} from './flags';

export function injectArgs(types: (ProviderToken<any> | any[])[]): any[] {
  const args: any[] = [];
  for (let i = 0; i < types.length; i++) {
    const arg = resolveForwardRef(types[i]);
    let flags = InjectFlags.Default;
    let type: Type<any> = arg as unknown as Type<any>;
    if (Array.isArray(arg)) {
      if (arg.length === 0) {
        throw new RuntimeError(
          RuntimeErrorCode.INVALID_DIFFER_INPUT,
          ngDevMode && 'Arguments array must have arguments.',
        );
      }

      for (let j = 0; j < arg.length; j++) {
        const meta = arg[j];
        const flag = getInjectFlag(meta);
        if (typeof flag === 'number') {
          // Special case when we handle @Inject decorator.
          if (flag === DecoratorFlags.Inject) {
            type = meta.token;
          } else {
            flags |= flag;
          }
        } else {
          type = meta;
        }
      }
    }
    args.push(inject(type, flags));
  }
  return args;
}

/*
 * Name of a property (that we patch onto DI decorator), which is used as an annotation of which
 * InjectFlag this decorator represents. This allows to avoid direct references to the DI decorators
 * in the code, thus making them tree-shakable.
 */
const DI_DECORATOR_FLAG = '__NG_DI_FLAG__';

/**
 * Reads monkey-patched property that contains InjectFlag attached to a decorator.
 *
 * @param token Token that may contain monkey-patched DI flags property.
 */
function getInjectFlag(token: any): number | undefined {
  return token[DI_DECORATOR_FLAG];
}

/**
 * Attaches a given InjectFlag to a given decorator using monkey-patching.
 * Since DI decorators can be used in providers `deps` array (when provider is configured using
 * `useFactory`) without initialization (e.g. `Host`) and as an instance (e.g. `new Host()`), we
 * attach the flag to make it available both as a static property and as a field on decorator
 * instance.
 *
 * @param decorator Provided DI decorator.
 * @param flag InjectFlag that should be applied.
 */
export function attachInjectFlag(decorator: any, flag: InjectFlags | DecoratorFlags): any {
  decorator[DI_DECORATOR_FLAG] = flag;
  decorator.prototype[DI_DECORATOR_FLAG] = flag;
  return decorator;
}
