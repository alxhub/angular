import {Component, EnvironmentInjector} from '@angular/core';
import {ComponentRef} from '@angular/core/src/render3';
import {createComponentAsync} from '@angular/core/src/render3/component';
import {TestBed} from '@angular/core/testing';

describe('async rendering', () => {
  fit('should render a component async', () => {
    @Component({
      standalone: true,
      selector: 'child-cmp',
      template: 'Child!',
      imports: [],
    })
    class ChildCmp {}

    @Component({
      standalone: true,
      selector: 'root-cmp',
      template: '<child-cmp /><child-cmp />',
      imports: [ChildCmp],
    })
    class RootCmp {}

    const inj = TestBed.inject(EnvironmentInjector);

    const gen = createComponentAsync(RootCmp, {environmentInjector: inj});
    console.log('finished cca');

    expect(gen.next().done).toBeFalse();
    expect(gen.next().done).toBeFalse();
    expect(gen.next().done).toBeFalse();
    expect(gen.next().done).toBeFalse();
    const next = gen.next();
    expect(next.done).toBeTrue();
    expect(next.value).toBeInstanceOf(ComponentRef);
  });
});
