/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Injector, signal, WritableSignal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {
  applyEach,
  createMetadataKey,
  FieldContext,
  form,
  metadata,
  SchemaPath,
  SchemaPathTree,
  validate,
} from '../../public_api';

function testContext<T>(
  s: WritableSignal<T>,
  callback: (ctx: FieldContext<T>, p: SchemaPathTree<T>) => void,
) {
  const isCalled = jasmine.createSpy();

  TestBed.runInInjectionContext(() => {
    const f = form<T>(s, (p) => {
      validate(p as SchemaPath<T>, (ctx) => {
        callback(ctx, p);
        isCalled();
        return undefined;
      });
    });

    f().errors();
  });

  expect(isCalled).toHaveBeenCalled();
}

describe('Field Context', () => {
  it('value', () => {
    const cat = signal({name: 'pirojok-the-cat', age: 5});
    testContext(cat, (ctx) => {
      expect(ctx.value().name).toEqual('pirojok-the-cat');
    });
  });

  it('state', () => {
    const cat = signal({name: 'pirojok-the-cat', age: 5});
    testContext(cat, (ctx) => {
      expect(ctx.state.value().name).toEqual('pirojok-the-cat');
    });
  });

  it('field', () => {
    const cat = signal({name: 'pirojok-the-cat', age: 5});
    testContext(cat, (ctx) => {
      expect(ctx.field.name().value()).toEqual('pirojok-the-cat');
      expect(ctx.field.age().value()).toEqual(5);
    });
  });

  it('pathKeys', () => {
    const KEYS = createMetadataKey({
      reduce: (_: readonly string[], n: readonly string[]) => n,
      getInitial: () => [],
    });
    const f = form(
      signal({x: [1]}),
      (p) => {
        metadata(p, KEYS, ({pathKeys}) => pathKeys());
        metadata(p.x, KEYS, ({pathKeys}) => pathKeys());
        applyEach(p.x, (it) => {
          metadata(it, KEYS, ({pathKeys}) => pathKeys());
        });
      },
      {injector: TestBed.inject(Injector)},
    );
    expect(f().metadata(KEYS)?.()).toEqual([]);
    expect(f.x().metadata(KEYS)?.()).toEqual(['x']);
    expect(f.x[0]().metadata(KEYS)?.()).toEqual(['x', '0']);
  });

  it('valueOf', () => {
    const cat = signal({name: 'pirojok-the-cat', age: 5});
    testContext(cat, (ctx, p) => {
      expect(ctx.valueOf(p.name)).toEqual('pirojok-the-cat');
      expect(ctx.valueOf(p.age)).toEqual(5);
    });
  });

  it('stateOf', () => {
    const cat = signal({name: 'pirojok-the-cat', age: 5});
    testContext(cat, (ctx, p) => {
      expect(ctx.stateOf(p.name).value()).toEqual('pirojok-the-cat');
      expect(ctx.stateOf(p.age).value()).toEqual(5);
    });
  });

  it('fieldTreeOf', () => {
    const cat = signal({name: 'pirojok-the-cat', age: 5});
    testContext(cat, (ctx, p) => {
      expect(ctx.fieldTreeOf(p.name)().value()).toEqual('pirojok-the-cat');
      expect(ctx.fieldTreeOf(p.age)().value()).toEqual(5);
    });
  });
});
