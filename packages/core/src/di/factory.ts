/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {getInheritedInjectableDef, getInjectableDef, InjectorType} from './defs';
import {throwInvalidProviderError} from './error';
import {
  ClassProvider,
  ConstructorProvider,
  isEnvironmentProviders,
  StaticClassProvider,
} from './provider';
import {
  isExistingProvider,
  isFactoryProvider,
  isTypeProvider,
  isValueProvider,
  SingleProvider,
} from './provider_collection';
import {resolveForwardRef} from '../forward_ref';
import {FactoryFn, getFactoryDef} from '../render3/definition_factory';
import {Type} from '../interface/type';
import {injectArgs} from './inject_args';
import {inject} from './inject';
import {ProviderToken} from './provider_token';
import {InjectionToken} from './injection_token';
import {RuntimeError, RuntimeErrorCode} from '../errors';
import {stringify} from '../util/stringify';
import {newArray} from '../util/array_utils';

/**
 * Converts a `SingleProvider` into a factory function.
 *
 * @param provider provider to convert to factory
 */
export function providerToFactory(
  provider: SingleProvider,
  ngModuleType?: InjectorType<any>,
  providers?: any[],
): () => any {
  let factory: (() => any) | undefined = undefined;
  if (ngDevMode && isEnvironmentProviders(provider)) {
    throwInvalidProviderError(undefined, providers, provider);
  }

  if (isTypeProvider(provider)) {
    const unwrappedProvider = resolveForwardRef(provider);
    return getFactoryDef(unwrappedProvider) || factoryForToken(unwrappedProvider);
  } else {
    if (isValueProvider(provider)) {
      factory = () => resolveForwardRef(provider.useValue);
    } else if (isFactoryProvider(provider)) {
      factory = () => provider.useFactory(...injectArgs(provider.deps || []));
    } else if (isExistingProvider(provider)) {
      factory = () => inject(resolveForwardRef(provider.useExisting));
    } else {
      const classRef = resolveForwardRef(
        provider &&
          ((provider as StaticClassProvider | ClassProvider).useClass || provider.provide),
      );
      if (ngDevMode && !classRef) {
        throwInvalidProviderError(ngModuleType, providers, provider);
      }
      if (hasDeps(provider)) {
        factory = () => new classRef(...injectArgs(provider.deps));
      } else {
        return getFactoryDef(classRef) || factoryForToken(classRef);
      }
    }
  }
  return factory;
}

export function factoryForToken(token: ProviderToken<any>): FactoryFn<any> {
  // Most tokens will have an injectable def directly on them, which specifies a factory directly.
  const injectableDef = getInjectableDef(token);
  const factory = injectableDef !== null ? injectableDef.factory : getFactoryDef(token);

  if (factory !== null) {
    return factory;
  }

  // InjectionTokens should have an injectable def (ɵprov) and thus should be handled above.
  // If it's missing that, it's an error.
  if (token instanceof InjectionToken) {
    throw new RuntimeError(
      RuntimeErrorCode.INVALID_INJECTION_TOKEN,
      ngDevMode && `Token ${stringify(token)} is missing a ɵprov definition.`,
    );
  }

  // Undecorated types can sometimes be created if they have no constructor arguments.
  if (token instanceof Function) {
    return getUndecoratedInjectableFactory(token);
  }

  // There was no way to resolve a factory for this token.
  throw new RuntimeError(RuntimeErrorCode.INVALID_INJECTION_TOKEN, ngDevMode && 'unreachable');
}

function getUndecoratedInjectableFactory(token: Function) {
  // If the token has parameters then it has dependencies that we cannot resolve implicitly.
  const paramLength = token.length;
  if (paramLength > 0) {
    throw new RuntimeError(
      RuntimeErrorCode.INVALID_INJECTION_TOKEN,
      ngDevMode &&
        `Can't resolve all parameters for ${stringify(token)}: (${newArray(paramLength, '?').join(
          ', ',
        )}).`,
    );
  }

  // The constructor function appears to have no parameters.
  // This might be because it inherits from a super-class. In which case, use an injectable
  // def from an ancestor if there is one.
  // Otherwise this really is a simple class with no dependencies, so return a factory that
  // just instantiates the zero-arg constructor.
  const inheritedInjectableDef = getInheritedInjectableDef(token);
  if (inheritedInjectableDef !== null) {
    return () => inheritedInjectableDef.factory(token as Type<any>);
  } else {
    return () => new (token as Type<any>)();
  }
}

function hasDeps(
  value: ClassProvider | ConstructorProvider | StaticClassProvider,
): value is ClassProvider & {deps: any[]} {
  return !!(value as any).deps;
}
