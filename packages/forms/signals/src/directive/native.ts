/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {type Renderer2, untracked} from '@angular/core';
import {NativeInputParseError, WithoutFieldTree} from '../api/rules';
import type {ParseResult} from '../api/transformed_value';

/**
 * Supported native control element types.
 *
 * The `type` property of a {@link HTMLTextAreaElement} should always be 'textarea', but the
 * TypeScript DOM API type definition lacks this detail, so we include it here.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/type
 */
export type NativeFormControl =
  | HTMLInputElement
  | HTMLSelectElement
  | (HTMLTextAreaElement & {type: 'textarea'});

export function isNativeFormElement(element: HTMLElement): element is NativeFormControl {
  return (
    element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA'
  );
}

export function isNumericFormElement(element: HTMLElement): boolean {
  if (element.tagName !== 'INPUT') {
    return false;
  }

  const type = (element as HTMLInputElement).type;
  return (
    type === 'date' ||
    type === 'datetime-local' ||
    type === 'month' ||
    type === 'number' ||
    type === 'range' ||
    type === 'time' ||
    type === 'week'
  );
}

export function isTextualFormElement(element: HTMLElement): boolean {
  return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';
}

/**
 * Returns the value from a native control element.
 *
 * @param element The native control element.
 * @param currentValue A function that returns the current value from the control's corresponding
 *   field state.
 * @param inputType The element's type, cached to avoid repeated DOM reads.
 *
 * The type of the returned value depends on the `type` property of the control, and will attempt to
 * match the current value's type. For example, the value of `<input type="number">` can be read as
 * a `string` or a `number`. If the current value is a `number`, then this will return a `number`.
 * Otherwise, this will return the value as a `string`.
 */
export function getNativeControlValue(
  element: NativeFormControl,
  currentValue: () => unknown,
  inputType: string,
): ParseResult<unknown> {
  let modelValue: unknown;

  // We intentionally bypass `validity.badInput` for date-related and number inputs because a partial value
  // triggers `badInput` but we want to map those smoothly to `null` rather than a parse error.
  const isBypassedInput =
    inputType === 'number' ||
    inputType === 'range' ||
    inputType === 'date' ||
    inputType === 'month' ||
    inputType === 'time' ||
    inputType === 'week';

  if (!isBypassedInput && element.validity.badInput) {
    return {
      error: new NativeInputParseError() as WithoutFieldTree<NativeInputParseError>,
    };
  }

  // Special cases for specific input types.
  switch (inputType) {
    case 'checkbox':
      return {value: (element as HTMLInputElement).checked};
    case 'number':
    case 'range':
    case 'datetime-local':
      // We can read a `number` or a `string` from this input type. Prefer whichever is consistent
      // with the current type.
      modelValue = untracked(currentValue);
      if (typeof modelValue === 'number' || modelValue === null) {
        if (element.value === '') {
          return {value: null};
        }
        const num = (element as HTMLInputElement).valueAsNumber;
        return {value: Number.isNaN(num) ? null : num};
      }
      break;
    case 'date':
    case 'month':
    case 'time':
    case 'week':
      // We can read a `Date | null`, `number`, or `string` from this input type. Prefer whichever
      // is consistent with the current type.
      modelValue = untracked(currentValue);
      if (modelValue === null || modelValue instanceof Date) {
        return {value: (element as HTMLInputElement).valueAsDate};
      } else if (typeof modelValue === 'number') {
        return {value: (element as HTMLInputElement).valueAsNumber};
      }
      break;
  }

  // Default to reading the value as a string.
  return {value: element.value};
}

/**
 * Sets a native control element's value.
 *
 * @param element The native control element.
 * @param value The new value to set.
 * @param inputType The element's type, cached to avoid repeated DOM reads.
 */
export function setNativeControlValue(
  element: NativeFormControl,
  value: unknown,
  inputType: string,
) {
  // Special cases for specific input types.
  switch (inputType) {
    case 'checkbox':
      (element as HTMLInputElement).checked = value as boolean;
      return;
    case 'radio':
      // Although HTML behavior is to clear the input already, we do this just in case. It seems
      // like it might be necessary in certain environments (e.g. Domino).
      (element as HTMLInputElement).checked = value === element.value;
      return;
    case 'number':
    case 'range':
      if (value === null || value === '') {
        // If the control thinks it is already empty (which happens during partial input),
        // skip writing to the DOM to avoid clobbering what the user is typing.
        if (!Number.isNaN((element as HTMLInputElement).valueAsNumber)) {
          element.value = '';
        }
        return;
      }
      setNativeNumberControlValue(element as HTMLInputElement, value as number);
      return;
    case 'datetime-local':
      // This input type can receive a `number` or a `string`.
      if (typeof value === 'number') {
        setNativeNumberControlValue(element as HTMLInputElement, value);
        return;
      } else if (value === null) {
        element.value = '';
        return;
      }
      break;
    case 'date':
    case 'month':
    case 'time':
    case 'week':
      // This input type can receive a `Date | null` or a `number` or a `string`.
      if (value === null || value === '') {
        // If the control thinks it is already empty (which happens during partial input),
        // skip writing to the DOM to avoid clobbering what the user is typing.
        if ((element as HTMLInputElement).valueAsDate !== null) {
          element.value = '';
        }
        return;
      }
      if (value instanceof Date) {
        (element as HTMLInputElement).valueAsDate = value;
        return;
      } else if (typeof value === 'number') {
        setNativeNumberControlValue(element as HTMLInputElement, value);
        return;
      }
      break;
  }

  // Default to setting the value as a string.
  element.value = value as string;
}

/** Writes a value to a native <input type="number">. */
export function setNativeNumberControlValue(element: HTMLInputElement, value: number) {
  // Writing `NaN` causes a warning in the console, so we instead write `''`.
  // This allows the user to safely use `NaN` as a number value that means "clear the input".
  if (isNaN(value)) {
    if (!Number.isNaN(element.valueAsNumber)) {
      element.value = '';
    }
  } else {
    element.valueAsNumber = value;
  }
}

/**
 * Updates the native DOM property on the given node.
 *
 * @param key The control binding key (identifies the property type, e.g. disabled, required).
 * @param name The DOM attribute/property name.
 * @param value The new value for the property.
 */
export function setNativeDomProperty(
  renderer: Renderer2,
  element: NativeFormControl,
  name: 'name' | 'disabled' | 'required' | 'readonly' | 'min' | 'max' | 'minLength' | 'maxLength',
  value: string | number | undefined,
) {
  switch (name) {
    case 'name':
      renderer.setAttribute(element, name, value as string);
      break;
    case 'disabled':
    case 'readonly':
    case 'required':
      if (value) {
        renderer.setAttribute(element, name, '');
      } else {
        renderer.removeAttribute(element, name);
      }
      break;
    case 'max':
    case 'min':
    case 'minLength':
    case 'maxLength':
      if (value !== undefined) {
        renderer.setAttribute(element, name, value.toString());
      } else {
        renderer.removeAttribute(element, name);
      }
      break;
  }
}
