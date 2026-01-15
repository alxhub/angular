/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  InjectionToken,
  Injector,
  input,
  Renderer2,
  type ɵControlDirectiveHost as ControlDirectiveHost,
  afterRenderEffect,
  type Signal,
  ɵRuntimeError as RuntimeError,
  signal,
} from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR, NgControl } from '@angular/forms';
import { InteropNgControl } from '../controls/interop_ng_control';
import { SignalFormsErrorCode } from '../errors';
import { SIGNAL_FORMS_CONFIG } from '../field/di';
import type { FieldNode } from '../field/node';
import type { FieldState, FieldTree } from '../api/types';
import {
  isNativeFormElement,
  isNumericFormElement,
  isTextualFormElement,
  type NativeFormControl,
} from './native';
import { bindingUpdated, type ControlBindingKey, createBindings } from './bindings';
import { cvaControlCreate } from './control_cva';
import { customControlCreate } from './control_custom';
import { nativeControlCreate } from './control_native';
import { NgValidationError, type ValidationError } from '../api/rules';

export interface FormFieldBindingOptions {
  /**
   * Focuses the binding.
   *
   * If not specified, Signal Forms will attempt to focus the host element of the `FormField` when
   * asked to focus this binding.
   */
  readonly focus?: (focusOptions?: FocusOptions) => void;

  readonly parseErrors?: Signal<ValidationError.WithoutFieldTree[]>;
}

/**
 * Lightweight DI token provided by the {@link FormField} directive.
 *
 * @category control
 * @experimental 21.0.0
 */
export const FORM_FIELD = new InjectionToken<FormField<unknown>>(
  typeof ngDevMode !== 'undefined' && ngDevMode ? 'FORM_FIELD' : '',
);

/**
 * Binds a form `FieldTree` to a UI control that edits it. A UI control can be one of several things:
 * 1. A native HTML input or textarea
 * 2. A signal forms custom control that implements `FormValueControl` or `FormCheckboxControl`
 * 3. A component that provides a `ControlValueAccessor`. This should only be used for backwards
 *    compatibility with reactive forms. Prefer options (1) and (2).
 *
 * This directive has several responsibilities:
 * 1. Two-way binds the field state's value with the UI control's value
 * 2. Binds additional forms related state on the field state to the UI control (disabled, required, etc.)
 * 3. Relays relevant events on the control to the field state (e.g. marks touched on blur)
 * 4. Provides a fake `NgControl` that implements a subset of the features available on the
 *    reactive forms `NgControl`. This is provided to improve interoperability with controls
 *    designed to work with reactive forms. It should not be used by controls written for signal
 *    forms.
 *
 * @category control
 * @experimental 21.0.0
 */
@Directive({
  selector: '[formField]',
  exportAs: 'formField',
  providers: [
    { provide: FORM_FIELD, useExisting: FormField },
    { provide: NgControl, useFactory: () => inject(FormField).getOrCreateNgControl() },
  ],
})
// This directive should `implements ɵFormFieldDirective<T>`, but actually adding that breaks people's
// builds because part of the public API is marked `@internal` and stripped.
// Instead we have an type check below that enforces this in a non-breaking way.
export class FormField<T> {
  readonly formField = input.required<FieldTree<T>>();
  readonly state = computed(() => this.formField()());
  readonly injector = inject(Injector);
  readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private focuser = (options?: FocusOptions) => this.element.focus(options);
  private readonly elementIsNativeFormElement = isNativeFormElement(this.element);
  private readonly elementAcceptsNumericValues = isNumericFormElement(this.element);
  private readonly elementAcceptsTextualValues = isTextualFormElement(this.element);
  protected readonly nativeFormElement: NativeFormControl = (this.elementIsNativeFormElement
    ? this.element
    : undefined) as NativeFormControl;

  /** Any `ControlValueAccessor` instances provided on the host element. */
  private readonly controlValueAccessors = inject(NG_VALUE_ACCESSOR, { optional: true, self: true });

  protected readonly renderer = inject(Renderer2);
  protected readonly destroyRef = inject(DestroyRef);
  private readonly config = inject(SIGNAL_FORMS_CONFIG, { optional: true });
  private readonly classes = Object.entries(this.config?.classes ?? {}).map(
    ([className, computation]) =>
      [className, computed(() => computation(this as FormField<unknown>))] as const,
  );

  private readonly parseErrorsSource = signal<Signal<ValidationError.WithoutFieldTree[]> | undefined>(undefined);

  /** @internal */
  readonly parseErrors = computed<ValidationError.WithFormField[]>(
    () =>
      this.parseErrorsSource()?.()
        .map((err) => ({
          ...err,
          fieldTree: this.formField(),
          formField: this as FormField<unknown>,
        })) ?? [],
  );

  /** Errors associated with this form field. */
  readonly errors = computed(() =>
    this.state()
      .errors()
      .filter((err) => !err.formField || err.formField === this),
  );

  /** A lazily instantiated fake `NgControl`. */
  private interopNgControl: InteropNgControl | undefined;

  /** Whether this `FormField` has been registered as a binding on its associated `FieldState`. */
  private isFieldBinding = false;

  /**
   * A `ControlValueAccessor`, if configured, for the host component.
   *
   * @internal
   */
  private get controlValueAccessor(): ControlValueAccessor | undefined {
    return this.controlValueAccessors?.[0] ?? this.interopNgControl?.valueAccessor ?? undefined;
  }

  private installClassBindingEffect(): void {
    // If we have class bindings to apply, set up an afterRenderEffect to apply them.
    if (Object.keys(this.classes).length > 0) {
      const bindings = createBindings<string>();
      afterRenderEffect(
        {
          write: () => {
            for (const [className, computation] of this.classes) {
              const active = computation();
              if (bindingUpdated(bindings, className, active)) {
                if (active) {
                  this.renderer.addClass(this.element, className);
                } else {
                  this.renderer.removeClass(this.element, className);
                }
              }
            }
          },
        },
        { injector: this.injector },
      );
    }
  }

  focus(options?: FocusOptions) {
    this.focuser(options);
  }

  /** Lazily instantiates a fake `NgControl` for this form field. */
  protected getOrCreateNgControl(): InteropNgControl {
    return (this.interopNgControl ??= new InteropNgControl(this.state));
  }

  /**
   * Registers this `FormField` as a binding on its associated `FieldState`.
   *
   * This method should be called at most once for a given `FormField`. A `FormField` placed on a
   * custom control (`FormUiControl`) automatically registers that custom control as a binding.
   */
  registerAsBinding(bindingOptions?: FormFieldBindingOptions): void {
    if (this.isFieldBinding) {
      throw new RuntimeError(
        SignalFormsErrorCode.BINDING_ALREADY_REGISTERED,
        ngDevMode && 'FormField already registered as a binding',
      );
    }
    this.isFieldBinding = true;

    this.installClassBindingEffect();

    if (bindingOptions?.focus) {
      this.focuser = bindingOptions.focus;
    }

    if (bindingOptions?.parseErrors) {
      this.parseErrorsSource.set(bindingOptions.parseErrors);
    }

    // Register this control on the field state it is currently bound to. We do this at the end of
    // initialization so that it only runs if we are actually syncing with this control
    // (as opposed to just passing the field state through to its `formField` input).
    effect(
      (onCleanup) => {
        const fieldNode = this.state() as unknown as FieldNode;
        fieldNode.nodeState.formFieldBindings.update((controls) => [
          ...controls,
          this as FormField<unknown>,
        ]);
        onCleanup(() => {
          fieldNode.nodeState.formFieldBindings.update((controls) =>
            controls.filter((c) => c !== this),
          );
        });
      },
      { injector: this.injector },
    );
  }

  private updateFn: (() => void) | undefined;

  ɵngControlCreate(host: ControlDirectiveHost<'formField'>): void {
    const privateThis = this as unknown as PrivateFormField;
    if (host.hasPassThrough) {
      return;
    }

    if (this.controlValueAccessor) {
      this.updateFn = cvaControlCreate(host, privateThis);
    } else if (host.customControl) {
      this.updateFn = customControlCreate(host, privateThis);
    } else if (this.elementIsNativeFormElement) {
      this.updateFn = nativeControlCreate(host, privateThis);
    } else {
      throw new RuntimeError(
        SignalFormsErrorCode.INVALID_FIELD_DIRECTIVE_HOST, // TODO: real runtime error
        ngDevMode &&
        `${host.descriptor} is an invalid [formField] directive host. The host must be a native form control ` +
        `(such as <input>', '<select>', or '<textarea>') or a custom form control with a 'value' or ` +
        `'checked' model.`,
      );
    }
  }

  ɵngControlUpdate(): void {
    this.updateFn?.();
  }

  protected elementAcceptsNativeProperty<K extends ControlBindingKey>(
    key: K,
  ): key is K &
  ('min' | 'max' | 'minLength' | 'maxLength' | 'disabled' | 'required' | 'readonly' | 'name') {
    if (!this.elementIsNativeFormElement) {
      return false;
    }

    switch (key) {
      case 'min':
      case 'max':
        return this.elementAcceptsNumericValues;
      case 'minLength':
      case 'maxLength':
        return this.elementAcceptsTextualValues;
      case 'disabled':
      case 'required':
      case 'readonly':
      case 'name':
        return true;
      default:
        return false;
    }
  }
}

export interface PrivateFormField extends Pick<FormField<unknown>, 'registerAsBinding' | 'element' | 'state' | 'errors'> {
  readonly controlValueAccessor: ControlValueAccessor | undefined;
  readonly nativeFormElement: NativeFormControl;
  readonly renderer: Renderer2;
  readonly destroyRef: DestroyRef;

  updateClasses(): void;
  elementAcceptsNativeProperty<K extends ControlBindingKey>(
    key: K,
  ): key is K &
  ('min' | 'max' | 'minLength' | 'maxLength' | 'disabled' | 'required' | 'readonly' | 'name');
}
