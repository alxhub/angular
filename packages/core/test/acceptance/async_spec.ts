import {Component, EnvironmentInjector} from '@angular/core';
import {ComponentRef} from '@angular/core/src/render3';
import {createComponentAsync} from '@angular/core/src/render3/component';
import {TestBed} from '@angular/core/testing';

describe('async rendering', () => {
  fit('should render a component async', () => {
    @Component({
      standalone: true,
      selector: 'grandchild-cmp',
      template: '1 + 1 = <span>{{ 1 + 1}}</span>',
      imports: [],
    })
    class GrandchildCmp {}

    @Component({
      standalone: true,
      selector: 'child-cmp',
      template: '<p>Child</p><grandchild-cmp /><grandchild-cmp />',
      imports: [GrandchildCmp],
    })
    class ChildCmp {}

    @Component({
      standalone: true,
      selector: 'root-cmp',
      template: '<child-cmp /><child-cmp /><child-cmp />',
      imports: [ChildCmp],
    })
    class RootCmp {}

    const inj = TestBed.inject(EnvironmentInjector);

    const host = document.createElement('div');

    const iter = createComponentAsync(RootCmp, {environmentInjector: inj, hostElement: host});
    console.log(host.innerHTML);

    let step = iter.next();
    while (!step.done) {
      console.log(host.innerHTML);
      console.log();
      step = iter.next();
    }

    const ref = step.value;
    expect(ref).toBeInstanceOf(ComponentRef);

    console.log('=== start CD ===\n\n');

    // ref.changeDetectorRef.detectChanges();
    const iter2 = ref.changeDetectorRef.detectChangesAsync();
    let step2 = iter2.next();
    while (!step2.done) {
      console.log(host.innerHTML);
      console.log();
      step2 = iter2.next();
    }

    console.log(host.innerHTML);
  });
});
