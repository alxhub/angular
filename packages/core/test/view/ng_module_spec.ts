import {createNgModuleRef} from '@angular/core/src/view/refs';
import {resolveNgModuleDep, moduleDef, moduleProvideDef} from '@angular/core/src/view/ng_module';
import {Injector, inject} from '@angular/core/src/di/injector';
import { NodeFlags, NgModuleProviderDef, NgModuleDefinition, InjectableDef } from '@angular/core/src/view';
import { tokenKey } from '@angular/core/src/view/util';
import { NgModuleRef } from '@angular/core';

class Foo {}

class MyModule {}

class NotMyModule {}

class Bar {
  static ngInjectableDef: InjectableDef = {
    factory: () => new Bar(),
    scope: MyModule,
  };
}

class Baz {
  static ngInjectableDef: InjectableDef = {
    factory: () => new Baz(),
    scope: NotMyModule,
  }
}

class HasNormalDep {
  constructor(public foo: Foo) {}

  static ngInjectableDef: InjectableDef = {
    factory: () => new HasNormalDep(inject(Foo)),
    scope: MyModule,
  }
}

class HasDefinedDep {
  constructor(public bar: Bar) {}

  static ngInjectableDef: InjectableDef = {
    factory: () => new HasDefinedDep(inject(Bar)),
    scope: MyModule,
  }
}

function makeProviders(classes: any[], modules: any[]): NgModuleDefinition {
  const providers = classes.map((token, index) => ({
    index,
    deps: [],
    flags: NodeFlags.TypeClassProvider | NodeFlags.LazyProvider,
    token,
    value: token,
  }));
  const providersByKey: {[key: string]: NgModuleProviderDef} = {};
  providers.forEach(provider => providersByKey[tokenKey(provider.token)] = provider);
  return {
    factory: null,
    providers,
    providersByKey,
    modules
  };
}

describe('NgModuleRef_ injector', () => {
  let ref: NgModuleRef<any>;
  beforeEach(() => {
    ref = createNgModuleRef(MyModule, Injector.NULL, [], makeProviders([
      MyModule,
      Foo
    ], [MyModule]));
  })

  it('injects a provided value', () => {
    expect(ref.injector.get(Foo) instanceof Foo).toBeTruthy();
  });

  it('injects an InjectableDef value', () => {
    expect(ref.injector.get(Bar) instanceof Bar).toBeTruthy();
  });

  it('caches InjectableDef values', () => {
    expect(ref.injector.get(Bar)).toBe(ref.injector.get(Bar));
  });

  it('injects provided deps properly', () => {
    const instance = ref.injector.get(HasNormalDep);
    expect(instance instanceof HasNormalDep).toBeTruthy();
    expect(instance.foo).toBe(ref.injector.get(Foo));
  });

  it('injects defined deps properly', () => {
    const instance = ref.injector.get(HasDefinedDep);
    expect(instance instanceof HasDefinedDep).toBeTruthy();
    expect(instance.bar).toBe(ref.injector.get(Bar));
  });

  it('does not inject something not scoped to the module', () => {
    expect(ref.injector.get(Baz, null)).toBeNull();
  });
});