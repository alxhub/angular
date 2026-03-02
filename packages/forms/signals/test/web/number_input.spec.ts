/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Component, signal, viewChildren} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {FormField, form} from '../../public_api';

describe('numeric inputs', () => {
  describe('parsing logic', () => {
    it('should not change the model when user enters un-parsable input', () => {
      @Component({
        imports: [FormField],
        template: `<input type="number" [formField]="f" />`,
      })
      class TestCmp {
        readonly data = signal<number>(42);
        readonly f = form(this.data);
      }

      const fixture = act(() => TestBed.createComponent(TestCmp));
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      const patch = patchNumberInput(input);

      expect(input.value).toBe('42');

      act(() => {
        patch.simulateType('42e', true);
      });

      expect(fixture.componentInstance.f().value()).toBeNull();
      expect(fixture.componentInstance.f().errors()).toEqual([]);

      act(() => {
        patch.simulateType('42e1', false);
      });

      expect(fixture.componentInstance.f().value()).toBe(420);
      expect(fixture.componentInstance.f().errors()).toEqual([]);
    });

    it('should clear parse errors on one control when another control for the same field updates the model', () => {
      @Component({
        imports: [FormField],
        template: `
          <input id="input1" type="number" [formField]="f" />
          <input id="input2" type="number" [formField]="f" />
        `,
      })
      class TestCmp {
        readonly data = signal<number>(5);
        readonly f = form(this.data);
        readonly bindings = viewChildren(FormField);
      }

      const fixture = act(() => TestBed.createComponent(TestCmp));
      const input1 = fixture.nativeElement.querySelector('#input1') as HTMLInputElement;
      const input2 = fixture.nativeElement.querySelector('#input2') as HTMLInputElement;
      const patch1 = patchNumberInput(input1);
      const patch2 = patchNumberInput(input2);

      expect(input1.value).toBe('5');
      expect(input2.value).toBe('5');

      // Trigger NaN (invalid typed value) on input1
      act(() => {
        patch1.simulateType('5e', true);
      });

      // The field maps the NaN to null, which emits no errors
      expect(fixture.componentInstance.bindings()[0].errors()).toEqual([]);
      expect(fixture.componentInstance.data()).toBeNull();

      // Update model via input2
      act(() => {
        patch2.simulateType('42', false);
      });

      expect(fixture.componentInstance.bindings()[0].errors()).toEqual([]);
      expect(fixture.componentInstance.data()).toBe(42);
      expect(input1.value).toBe('42');
      expect(input2.value).toBe('42');
    });
  });

  describe('nullability', () => {
    it('should initialize with null', () => {
      @Component({
        imports: [FormField],
        template: `<input type="number" [formField]="f" />`,
      })
      class TestCmp {
        readonly data = signal<number | null>(null);
        readonly f = form(this.data);
      }

      const fixture = act(() => TestBed.createComponent(TestCmp));
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

      expect(input.value).toBe('');
      expect(fixture.componentInstance.f().value()).toBeNull();
      expect(fixture.componentInstance.f().errors()).toEqual([]);
    });

    it('should initialize with NaN', () => {
      @Component({
        imports: [FormField],
        template: `<input type="number" [formField]="f" />`,
      })
      class TestCmp {
        readonly data = signal<number | null>(NaN);
        readonly f = form(this.data);
      }

      const fixture = act(() => TestBed.createComponent(TestCmp));
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

      expect(input.value).toBe('');
      expect(fixture.componentInstance.f().value()).toEqual(NaN);
      // No parse errors if its `NaN` from the model
      expect(fixture.componentInstance.f().errors()).toEqual([]);
    });

    it('should update model to null when user clears input', () => {
      @Component({
        imports: [FormField],
        template: `<input type="number" [formField]="f" />`,
      })
      class TestCmp {
        readonly data = signal<number | null>(NaN);
        readonly f = form(this.data);
      }

      const fixture = act(() => TestBed.createComponent(TestCmp));
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      const patch = patchNumberInput(input);

      act(() => {
        patch.simulateType('4', false);
      });

      expect(fixture.componentInstance.f().value()).toBe(4);

      act(() => {
        patch.simulateType('', false);
      });

      expect(fixture.componentInstance.f().value()).toBeNull();
    });

    it('should ignore sync clobbering when native control has partial input (badInput)', () => {
      @Component({
        imports: [FormField],
        template: `<input type="number" [formField]="f" />`,
      })
      class TestCmp {
        readonly data = signal<number | null>(4);
        readonly f = form(this.data);
      }

      const fixture = act(() => TestBed.createComponent(TestCmp));
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      const patch = patchNumberInput(input);

      expect(fixture.componentInstance.f().value()).toBe(4);

      // Simulate partial input clearing the value on the DOM (e.g. typing "4-")
      act(() => {
        patch.simulateType('4-', true);
      });

      expect(fixture.componentInstance.f().value()).toBeNull();
      expect(fixture.componentInstance.f().errors()).toEqual([]);

      // The invalid input should not be wiped away by sync
      expect(patch.getTypedValue()).toBe('4-');
    });
  });
});

function act<T>(fn: () => T): T {
  try {
    return fn();
  } finally {
    TestBed.tick();
  }
}

/**
 * Patch a number input to simulate the browser's native validity capabilities when a user
 * types an incomplete or un-parseable numeric string (e.g., '4-' or '42e').
 *
 * Browsers do not expose raw keystrokes in `.value` for number inputs if the text cannot be
 * parsed into a number; instead, they flip `.validity.badInput` to `true`, return `NaN`
 * for `.valueAsNumber` and `""` for `.value`.
 *
 * Automated Karma tests running in a JS context cannot simulate real browser OS-level keyboard
 * interactions. Setting `input.value = '4-'` programmatically is rejected by the DOM
 * spec and does not throw `badInput`. Thus, this utility overrides the property getters to
 * manually mock browser typing behavior, allowing tests to accurately assert framework logic
 * during partial user entry without relying on an actual browser engine validating the DOM element.
 */
function patchNumberInput(input: HTMLInputElement) {
  let typedValue = input.value;
  let isBadInput = false;

  Object.defineProperties(input, {
    value: {
      set: (v) => {
        typedValue = v;
        isBadInput = false;
      },
      get: () => {
        return isBadInput ? '' : typedValue;
      },
    },
    valueAsNumber: {
      get: () => (isBadInput ? NaN : Number(typedValue)),
      set: (v) => {
        typedValue = String(v);
        isBadInput = false;
      },
    },
  });
  Object.defineProperties(input.validity, {
    badInput: {get: () => isBadInput},
  });

  return {
    simulateType: (text: string, bad: boolean) => {
      typedValue = text;
      isBadInput = bad;
      input.dispatchEvent(new Event('input'));
    },
    getTypedValue: () => typedValue,
  };
}
