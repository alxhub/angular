/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * @module
 * @description
 * The `di` module provides dependency injection container services.
 */

export {
  Host,
  HostDecorator,
  Inject,
  InjectDecorator,
  Optional,
  OptionalDecorator,
  Self,
  SelfDecorator,
  SkipSelf,
  SkipSelfDecorator,
} from './metadata';
export {assertInInjectionContext, runInInjectionContext} from './contextual';
export {InjectFlags} from './flags';
export {InjectOptions} from './options';
export {
  ɵɵdefineInjectable,
  defineInjectable,
  ɵɵdefineInjector,
  InjectableType,
  InjectorType,
} from './defs';
export {forwardRef, resolveForwardRef, ForwardRefFn} from '../forward_ref';
export {inject} from './inject';
export {Injectable, InjectableDecorator, InjectableProvider} from './injectable';
export {Injector, EnvironmentInjector} from './injector';
export {
  importProvidersFrom,
  ImportProvidersSource,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from './provider_collection';
export {ENVIRONMENT_INITIALIZER} from './initializer_token';
export {ProviderToken} from './provider_token';
export {INJECTOR} from './injector_token';
export {
  ClassProvider,
  ModuleWithProviders,
  ClassSansProvider,
  ImportedNgModuleProviders,
  ConstructorProvider,
  EnvironmentProviders,
  ConstructorSansProvider,
  ExistingProvider,
  ExistingSansProvider,
  FactoryProvider,
  FactorySansProvider,
  Provider,
  StaticClassProvider,
  StaticClassSansProvider,
  StaticProvider,
  TypeProvider,
  ValueProvider,
  ValueSansProvider,
} from './provider';
export {InjectionToken} from './injection_token';
export {HostAttributeToken} from './host_attribute_token';
export {HOST_TAG_NAME} from './host_tag_name_token';
