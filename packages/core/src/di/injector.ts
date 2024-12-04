/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import type {Type} from '../interface/type';
import {InjectorMarkers} from './injector_marker';
import {INJECTOR} from './injector_token';
import {convertToBitFlags, InjectFlags} from './flags';
import {
  EnvironmentProviders,
  InternalEnvironmentProviders,
  isEnvironmentProviders,
  Provider,
  StaticProvider,
  TypeProvider,
} from './provider';
import type {ProviderToken} from './provider_token';
import {INJECTOR_SCOPE, InjectorScope} from './scope';
import {
  emitInstanceCreatedByInjectorEvent,
  emitProviderConfiguredEvent,
  InjectorProfilerContext,
  runInInjectorProfilerContext,
  setInjectorProfilerContext,
} from '../render3/debug/injector_profiler';
import {setCurrentInjector} from './inject';
import {getInjectableDef, ɵɵInjectableDeclaration} from './defs';
import {NG_ENV_ID} from '../render3/fields';
import {
  catchInjectorError,
  NG_TEMP_TOKEN_PATH,
  throwCyclicDependencyError,
  throwMixedMultiProviderError,
} from './error';
import {stringify} from '../util/stringify';
import {setActiveConsumer} from '@angular/core/primitives/signals';
import {ENVIRONMENT_INITIALIZER} from './initializer_token';
import {EMPTY_ARRAY} from '../util/empty';
import {RuntimeError, RuntimeErrorCode} from '../errors';
import type {InjectOptions} from './options';
import {resolveForwardRef} from '../forward_ref';
import {
  importProvidersFrom,
  isTypeProvider,
  isValueProvider,
  SingleProvider,
} from './provider_collection';
import {injectArgs} from './inject_args';
import {INJECTOR_DEF_TYPES} from './internal_tokens';
import {OnDestroy} from '../metadata';
import {InjectionToken} from './injection_token';
import {factoryForToken, providerToFactory} from './factory';

export class NullInjector implements Injector {
  get(token: any, notFoundValue: any = Injector.THROW_IF_NOT_FOUND): any {
    if (notFoundValue === Injector.THROW_IF_NOT_FOUND) {
      const error = new Error(`NullInjectorError: No provider for ${stringify(token)}!`);
      error.name = 'NullInjectorError';
      throw error;
    }
    return notFoundValue;
  }
}

/**
 * Concrete injectors implement this interface. Injectors are configured
 * with [providers](guide/di/dependency-injection-providers) that associate
 * dependencies of various types with [injection tokens](guide/di/dependency-injection-providers).
 *
 * @see [DI Providers](guide/di/dependency-injection-providers).
 * @see {@link StaticProvider}
 *
 * @usageNotes
 *
 *  The following example creates a service injector instance.
 *
 * {@example core/di/ts/provider_spec.ts region='ConstructorProvider'}
 *
 * ### Usage example
 *
 * {@example core/di/ts/injector_spec.ts region='Injector'}
 *
 * `Injector` returns itself when given `Injector` as a token:
 *
 * {@example core/di/ts/injector_spec.ts region='injectInjector'}
 *
 * @publicApi
 */
export abstract class Injector {
  static THROW_IF_NOT_FOUND: unknown = {};
  static NULL: Injector = /* @__PURE__ */ new NullInjector();

  /**
   * Internal note on the `options?: InjectOptions|InjectFlags` override of the `get`
   * method: consider dropping the `InjectFlags` part in one of the major versions.
   * It can **not** be done in minor/patch, since it's breaking for custom injectors
   * that only implement the old `InjectorFlags` interface.
   */

  /**
   * Retrieves an instance from the injector based on the provided token.
   * @returns The instance from the injector if defined, otherwise the `notFoundValue`.
   * @throws When the `notFoundValue` is `undefined` or `Injector.THROW_IF_NOT_FOUND`.
   */
  abstract get<T>(
    token: ProviderToken<T>,
    notFoundValue: undefined,
    options: InjectOptions & {
      optional?: false;
    },
  ): T;
  /**
   * Retrieves an instance from the injector based on the provided token.
   * @returns The instance from the injector if defined, otherwise the `notFoundValue`.
   * @throws When the `notFoundValue` is `undefined` or `Injector.THROW_IF_NOT_FOUND`.
   */
  abstract get<T>(
    token: ProviderToken<T>,
    notFoundValue: null | undefined,
    options: InjectOptions,
  ): T | null;
  /**
   * Retrieves an instance from the injector based on the provided token.
   * @returns The instance from the injector if defined, otherwise the `notFoundValue`.
   * @throws When the `notFoundValue` is `undefined` or `Injector.THROW_IF_NOT_FOUND`.
   */
  abstract get<T>(
    token: ProviderToken<T>,
    notFoundValue?: T,
    options?: InjectOptions | InjectFlags,
  ): T;
  /**
   * Retrieves an instance from the injector based on the provided token.
   * @returns The instance from the injector if defined, otherwise the `notFoundValue`.
   * @throws When the `notFoundValue` is `undefined` or `Injector.THROW_IF_NOT_FOUND`.
   * @deprecated use object-based flags (`InjectOptions`) instead.
   */
  abstract get<T>(token: ProviderToken<T>, notFoundValue?: T, flags?: InjectFlags): T;
  /**
   * @deprecated from v4.0.0 use ProviderToken<T>
   * @suppress {duplicate}
   */
  abstract get(token: any, notFoundValue?: any): any;

  /**
   * @deprecated from v5 use the new signature Injector.create(options)
   */
  static create(providers: StaticProvider[], parent?: Injector): Injector;

  /**
   * Creates a new injector instance that provides one or more dependencies,
   * according to a given type or types of `StaticProvider`.
   *
   * @param options An object with the following properties:
   * * `providers`: An array of providers of the [StaticProvider type](api/core/StaticProvider).
   * * `parent`: (optional) A parent injector.
   * * `name`: (optional) A developer-defined identifying name for the new injector.
   *
   * @returns The new injector instance.
   *
   */
  static create(options: {
    providers: Array<Provider | StaticProvider>;
    parent?: Injector;
    name?: string;
  }): Injector;

  static create(
    options:
      | StaticProvider[]
      | {providers: Array<Provider | StaticProvider>; parent?: Injector; name?: string},
    parent?: Injector,
  ): Injector {
    if (Array.isArray(options)) {
      return createInjector({name: ''}, parent, options, '');
    } else {
      const name = options.name ?? '';
      return createInjector({name}, options.parent, options.providers, name);
    }
  }

  /**
   * @internal
   * @nocollapse
   */
  static __NG_ELEMENT_ID__ = InjectorMarkers.Injector;
}

/**
 * An `Injector` that's part of the environment injector hierarchy, which exists outside of the
 * component tree.
 */
export abstract class EnvironmentInjector extends Injector {
  /**
   * Runs the given function in the context of this `EnvironmentInjector`.
   *
   * Within the function's stack frame, [`inject`](api/core/inject) can be used to inject
   * dependencies from this injector. Note that `inject` is only usable synchronously, and cannot be
   * used in any asynchronous callbacks or after any `await` points.
   *
   * @param fn the closure to be run in the context of this injector
   * @returns the return value of the function, if any
   * @deprecated use the standalone function `runInInjectionContext` instead
   */
  abstract runInContext<ReturnT>(fn: () => ReturnT): ReturnT;

  abstract destroy(): void;

  /**
   * @internal
   */
  abstract onDestroy(callback: () => void): () => void;
}

export class InjectorImpl extends EnvironmentInjector {
  /**
   * Map of tokens to records which contain the instances of those tokens.
   * - `null` value implies that we don't have the record. Used by tree-shakable injectors
   * to prevent further searches.
   */
  private records = new Map<ProviderToken<any>, ProviderRecord<any> | null>();

  /**
   * Set of values instantiated by this injector which contain `ngOnDestroy` lifecycle hooks.
   */
  private _ngOnDestroyHooks = new Set<OnDestroy>();

  private _onDestroyHooks: Array<() => void> = [];

  /**
   * Flag indicating that this injector was previously destroyed.
   */
  get destroyed(): boolean {
    return this._destroyed;
  }
  private _destroyed = false;

  private injectorDefTypes: Set<Type<unknown>>;

  constructor(
    providers: Array<Provider | EnvironmentProviders>,
    readonly parent: Injector,
    readonly source: string | null,
    readonly scopes: Set<InjectorScope>,
  ) {
    super();
    // Start off by creating Records for every provider.
    forEachSingleProvider(providers as Array<Provider | InternalEnvironmentProviders>, (provider) =>
      this.processProvider(provider),
    );

    // Make sure the Injector & INJECTOR tokens provide this injector.
    this.records.set(Injector, makeRecord(undefined, this));
    this.records.set(INJECTOR, makeRecord(undefined, this));

    // And `EnvironmentInjector` if the current injector is supposed to be env-scoped.
    if (scopes.has('environment')) {
      this.records.set(EnvironmentInjector, makeRecord(undefined, this));
    }

    // Detect whether this injector has the APP_ROOT_SCOPE token and thus should provide
    // any injectable scoped to APP_ROOT_SCOPE.
    const record = this.records.get(INJECTOR_SCOPE) as ProviderRecord<InjectorScope | null>;
    if (record != null && typeof record.value === 'string') {
      this.scopes.add(record.value as InjectorScope);
    }

    this.injectorDefTypes = new Set(this.get(INJECTOR_DEF_TYPES, EMPTY_ARRAY, InjectFlags.Self));
  }

  /**
   * Destroy the injector and release references to every instance or provider associated with it.
   *
   * Also calls the `OnDestroy` lifecycle hooks of every instance that was created for which a
   * hook was found.
   */
  override destroy(): void {
    assertNotDestroyed(this);

    // Set destroyed = true first, in case lifecycle hooks re-enter destroy().
    this._destroyed = true;
    const prevConsumer = setActiveConsumer(null);
    try {
      // Call all the lifecycle hooks.
      for (const service of this._ngOnDestroyHooks) {
        service.ngOnDestroy();
      }
      const onDestroyHooks = this._onDestroyHooks;
      // Reset the _onDestroyHooks array before iterating over it to prevent hooks that unregister
      // themselves from mutating the array during iteration.
      this._onDestroyHooks = [];
      for (const hook of onDestroyHooks) {
        hook();
      }
    } finally {
      // Release all references.
      this.records.clear();
      this._ngOnDestroyHooks.clear();
      this.injectorDefTypes.clear();
      setActiveConsumer(prevConsumer);
    }
  }

  override onDestroy(callback: () => void): () => void {
    assertNotDestroyed(this);
    this._onDestroyHooks.push(callback);
    return () => this.removeOnDestroy(callback);
  }

  override runInContext<ReturnT>(fn: () => ReturnT): ReturnT {
    assertNotDestroyed(this);

    const previousInjector = setCurrentInjector(this);
    let prevInjectContext: InjectorProfilerContext | undefined;
    if (ngDevMode) {
      prevInjectContext = setInjectorProfilerContext({injector: this, token: null});
    }

    try {
      return fn();
    } finally {
      setCurrentInjector(previousInjector);
      ngDevMode && setInjectorProfilerContext(prevInjectContext!);
    }
  }

  override get<T>(
    token: ProviderToken<T>,
    notFoundValue: any = Injector.THROW_IF_NOT_FOUND,
    flags: InjectFlags | InjectOptions = InjectFlags.Default,
  ): T {
    assertNotDestroyed(this);

    if (token.hasOwnProperty(NG_ENV_ID)) {
      return (token as any)[NG_ENV_ID](this);
    }

    flags = convertToBitFlags(flags) as InjectFlags;

    // Set the injection context.
    let prevInjectContext: InjectorProfilerContext;
    if (ngDevMode) {
      prevInjectContext = setInjectorProfilerContext({injector: this, token: token as Type<T>});
    }
    const prevInjector = setCurrentInjector(this);
    try {
      // Check for the SkipSelf flag.
      if (!(flags & InjectFlags.SkipSelf)) {
        // SkipSelf isn't set, check if the record belongs to this injector.
        let record: ProviderRecord<T> | undefined | null = this.records.get(token);
        if (record === undefined) {
          // No record, but maybe the token is scoped to this injector. Look for an injectable
          // def with a scope matching this injector.
          const def = couldBeInjectableType(token) && getInjectableDef(token);
          if (def && this.injectableDefInScope(def)) {
            // Found an injectable def and it's scoped to this injector. Pretend as if it was here
            // all along.

            if (ngDevMode) {
              runInInjectorProfilerContext(this, token as Type<T>, () => {
                emitProviderConfiguredEvent(token as TypeProvider);
              });
            }

            record = makeRecord<T>(factoryForToken(token), NOT_YET);
          } else {
            record = null;
          }
          this.records.set(token, record);
        }
        // If a record was found, get the instance for it and return it.
        if (record != null /* NOT null || undefined */) {
          return this.hydrate(token, record);
        }
      }

      // Select the next injector based on the Self flag - if self is set, the next injector is
      // the NullInjector, otherwise it's the parent.
      const nextInjector = !(flags & InjectFlags.Self) ? this.parent : Injector.NULL;
      // Set the notFoundValue based on the Optional flag - if optional is set and notFoundValue
      // is undefined, the value is null, otherwise it's the notFoundValue.
      notFoundValue =
        flags & InjectFlags.Optional && notFoundValue === Injector.THROW_IF_NOT_FOUND
          ? null
          : notFoundValue;
      return nextInjector.get(token, notFoundValue);
    } catch (e: any) {
      if (e.name === 'NullInjectorError') {
        const path: any[] = (e[NG_TEMP_TOKEN_PATH] = e[NG_TEMP_TOKEN_PATH] || []);
        path.unshift(stringify(token));
        if (prevInjector) {
          // We still have a parent injector, keep throwing
          throw e;
        } else {
          // Format & throw the final error message when we don't have any previous injector
          return catchInjectorError(e, token, 'InjectorError', this.source);
        }
      } else {
        throw e;
      }
    } finally {
      // Lastly, restore the previous injection context.
      setCurrentInjector(prevInjector);
      ngDevMode && setInjectorProfilerContext(prevInjectContext!);
    }
  }

  /** @internal */
  resolveInjectorInitializers() {
    const prevConsumer = setActiveConsumer(null);
    const previousInjector = setCurrentInjector(this);
    let prevInjectContext: InjectorProfilerContext | undefined;
    if (ngDevMode) {
      prevInjectContext = setInjectorProfilerContext({injector: this, token: null});
    }

    try {
      const initializers = this.get(ENVIRONMENT_INITIALIZER, EMPTY_ARRAY, InjectFlags.Self);
      if (ngDevMode && !Array.isArray(initializers)) {
        throw new RuntimeError(
          RuntimeErrorCode.INVALID_MULTI_PROVIDER,
          'Unexpected type of the `ENVIRONMENT_INITIALIZER` token value ' +
            `(expected an array, but got ${typeof initializers}). ` +
            'Please check that the `ENVIRONMENT_INITIALIZER` token is configured as a ' +
            '`multi: true` provider.',
        );
      }
      for (const initializer of initializers) {
        initializer();
      }
    } finally {
      setCurrentInjector(previousInjector);
      ngDevMode && setInjectorProfilerContext(prevInjectContext!);
      setActiveConsumer(prevConsumer);
    }
  }

  override toString() {
    const tokens: string[] = [];
    const records = this.records;
    for (const token of records.keys()) {
      tokens.push(stringify(token));
    }
    return `Injector[${tokens.join(', ')}]`;
  }

  /**
   * Process a `SingleProvider` and add it.
   */
  private processProvider(provider: SingleProvider): void {
    // Determine the token from the provider. Either it's its own token, or has a {provide: ...}
    // property.
    provider = resolveForwardRef(provider);
    let token: any = isTypeProvider(provider)
      ? provider
      : resolveForwardRef(provider && provider.provide);

    // Construct a `Record` for the provider.
    const record = providerToRecord(provider);
    if (ngDevMode) {
      runInInjectorProfilerContext(this, token, () => {
        // Emit InjectorProfilerEventType.Create if provider is a value provider because
        // these are the only providers that do not go through the value hydration logic
        // where this event would normally be emitted from.
        if (isValueProvider(provider)) {
          emitInstanceCreatedByInjectorEvent(provider.useValue);
        }

        emitProviderConfiguredEvent(provider);
      });
    }

    if (!isTypeProvider(provider) && provider.multi === true) {
      // If the provider indicates that it's a multi-provider, process it specially.
      // First check whether it's been defined already.
      let multiRecord = this.records.get(token);
      if (multiRecord) {
        // It has. Throw a nice error if
        if (ngDevMode && multiRecord.multi === undefined) {
          throwMixedMultiProviderError();
        }
      } else {
        multiRecord = makeRecord(undefined, NOT_YET, true);
        multiRecord.factory = () => injectArgs(multiRecord!.multi!);
        this.records.set(token, multiRecord);
      }
      token = provider;
      multiRecord.multi!.push(provider);
    } else {
      if (ngDevMode) {
        const existing = this.records.get(token);
        if (existing && existing.multi !== undefined) {
          throwMixedMultiProviderError();
        }
      }
    }
    this.records.set(token, record);
  }

  private hydrate<T>(token: ProviderToken<T>, record: ProviderRecord<T>): T {
    const prevConsumer = setActiveConsumer(null);
    try {
      if (ngDevMode && record.value === CIRCULAR) {
        throwCyclicDependencyError(stringify(token));
      } else if (record.value === NOT_YET) {
        record.value = CIRCULAR;

        if (ngDevMode) {
          runInInjectorProfilerContext(this, token as Type<T>, () => {
            record.value = record.factory!();
            emitInstanceCreatedByInjectorEvent(record.value);
          });
        } else {
          record.value = record.factory!();
        }
      }
      if (typeof record.value === 'object' && record.value && hasOnDestroy(record.value)) {
        this._ngOnDestroyHooks.add(record.value);
      }
      return record.value as T;
    } finally {
      setActiveConsumer(prevConsumer);
    }
  }

  private injectableDefInScope(def: ɵɵInjectableDeclaration<any>): boolean {
    if (!def.providedIn) {
      return false;
    }
    const providedIn = resolveForwardRef(def.providedIn);
    if (typeof providedIn === 'string') {
      return providedIn === 'any' || this.scopes.has(providedIn);
    } else {
      return this.injectorDefTypes.has(providedIn);
    }
  }

  private removeOnDestroy(callback: () => void): void {
    const destroyCBIdx = this._onDestroyHooks.indexOf(callback);
    if (destroyCBIdx !== -1) {
      this._onDestroyHooks.splice(destroyCBIdx, 1);
    }
  }
}

/**
 * Create a new `Injector` which is configured using a `defType` of `InjectorType<any>`s.
 */
export function createInjector(
  defType: /* InjectorType<any> */ any,
  parent: Injector | null = null,
  additionalProviders: Array<Provider | StaticProvider> | null = null,
  name?: string,
): Injector {
  const injector = createInjectorWithoutInjectorInstances(
    defType,
    parent,
    additionalProviders,
    name,
  );
  injector.resolveInjectorInitializers();
  return injector;
}

/**
 * Creates a new injector without eagerly resolving its injector types. Can be used in places
 * where resolving the injector types immediately can lead to an infinite loop. The injector types
 * should be resolved at a later point by calling `_resolveInjectorDefTypes`.
 */
export function createInjectorWithoutInjectorInstances(
  defType: /* InjectorType<any> */ any,
  parent: Injector | null = null,
  additionalProviders: Array<Provider | StaticProvider> | null = null,
  name?: string,
  scopes = new Set<InjectorScope>(),
): InjectorImpl {
  const providers = [additionalProviders || EMPTY_ARRAY, importProvidersFrom(defType)];
  name = name || (typeof defType === 'object' ? undefined : stringify(defType));

  return new InjectorImpl(providers, parent || Injector.NULL, name || null, scopes);
}

/**
 * An entry in the injector which tracks information about the given token, including a possible
 * current value.
 */
interface ProviderRecord<T> {
  factory: (() => T) | undefined;
  value: T | {};
  multi: any[] | undefined;
}

/**
 * Marker which indicates that a value has not yet been created from the factory function.
 */
const NOT_YET = {};

/**
 * Marker which indicates that the factory function for a token is in the process of being called.
 *
 * If the injector is asked to inject a token with its value set to CIRCULAR, that indicates
 * injection of a dependency has recursively attempted to inject the original token, and there is
 * a circular dependency among the providers.
 */
const CIRCULAR = {};

function providerToRecord(provider: SingleProvider): ProviderRecord<any> {
  if (isValueProvider(provider)) {
    return makeRecord(undefined, provider.useValue);
  } else {
    const factory: (() => any) | undefined = providerToFactory(provider);
    return makeRecord(factory, NOT_YET);
  }
}

export function assertNotDestroyed(injector: InjectorImpl): void {
  if (injector.destroyed) {
    throw new RuntimeError(
      RuntimeErrorCode.INJECTOR_ALREADY_DESTROYED,
      ngDevMode && 'Injector has already been destroyed.',
    );
  }
}

function makeRecord<T>(
  factory: (() => T) | undefined,
  value: T | {},
  multi: boolean = false,
): ProviderRecord<T> {
  return {
    factory: factory,
    value: value,
    multi: multi ? [] : undefined,
  };
}

function hasOnDestroy(value: any): value is OnDestroy {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as OnDestroy).ngOnDestroy === 'function'
  );
}

function couldBeInjectableType(value: any): value is ProviderToken<any> {
  return (
    typeof value === 'function' || (typeof value === 'object' && value instanceof InjectionToken)
  );
}

function forEachSingleProvider(
  providers: Array<Provider | EnvironmentProviders>,
  fn: (provider: SingleProvider) => void,
): void {
  for (const provider of providers) {
    if (Array.isArray(provider)) {
      forEachSingleProvider(provider, fn);
    } else if (provider && isEnvironmentProviders(provider)) {
      forEachSingleProvider(provider.ɵproviders, fn);
    } else {
      fn(provider as SingleProvider);
    }
  }
}
