import {Component, computed, model, signal} from '@angular/core';
import {Field, form, FormValueControl} from '../../public_api';
import {TestBed} from '@angular/core/testing';

describe('control errors', () => {
  fit('should not suck', () => {
    @Component({
      selector: 'custom-control',
      template: ``,
    })
    class CustomControl implements FormValueControl<string | null> {
      readonly value = model.required<string | null>();

      readonly controlErrors = computed(() => (this.value() === null ? [{kind: 'error'}] : []));
    }

    @Component({
      imports: [CustomControl, Field],
      template: `<custom-control [field]="f" />`,
    })
    class TestCmp {
      state = signal<string | null>('');
      f = form(this.state);
    }

    const cmp = act(() => TestBed.createComponent(TestCmp).componentInstance);
    expect(cmp.f().errors().length).toBe(0);

    act(() => cmp.state.set(null));
    expect(cmp.f().controlErrors().length).toBe(1);
    expect(cmp.f().errors().length).toBe(1);
  });
});

function act<T>(fn: () => T): T {
  try {
    return fn();
  } finally {
    TestBed.tick();
  }
}
