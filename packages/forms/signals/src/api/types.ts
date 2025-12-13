/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Signal, ɵFieldState} from '@angular/core';
import {AbstractControl} from '@angular/forms';
import type {Field} from './field_directive';
import type {MetadataKey} from './rules/metadata';
import type {ValidationError} from './rules/validation/validation_errors';

/**
 * Symbol used to retain generic type information when it would otherwise be lost.
 */
declare const ɵɵTYPE: unique symbol;

/**
 * A type that represents either a single value of type `T` or a readonly array of `T`.
 * @template T The type of the value(s).
 *
 * @experimental 21.0.0
 */
export type OneOrMany<T> = T | readonly T[];

/**
 * A status indicating whether a field is unsubmitted, submitted, or currently submitting.
 *
 * @category types
 * @experimental 21.0.0
 */
export type SubmittedStatus = 'unsubmitted' | 'submitted' | 'submitting';

/**
 * A reason for a field's disablement.
 *
 * @category logic
 * @experimental 21.0.0
 */
export interface DisabledReason {
  /** The field that is disabled. */
  readonly field: FieldTree<unknown>;
  /** A user-facing message describing the reason for the disablement. */
  readonly message?: string;
}

/**
 * The absence of an error which indicates a successful validation result.
 *
 * @category types
 * @experimental 21.0.0
 */
export type ValidationSuccess = null | undefined | void;

/**
 * The result of running a tree validation function.
 *
 * The result may be one of the following:
 * 1. A {@link ValidationSuccess} to indicate no errors.
 * 2. A {@link ValidationError} without a field to indicate an error on the field being validated.
 * 3. A {@link ValidationError} with a field to indicate an error on the target field.
 * 4. A list of {@link ValidationError} with or without fields to indicate multiple errors.
 *
 * @template E the type of error (defaults to {@link ValidationError}).
 *
 * @category types
 * @experimental 21.0.0
 */
export type TreeValidationResult<
  E extends ValidationError.WithOptionalField = ValidationError.WithOptionalField,
> = ValidationSuccess | OneOrMany<E>;

/**
 * A validation result where all errors explicitly define their target field.
 *
 * The result may be one of the following:
 * 1. A {@link ValidationSuccess} to indicate no errors.
 * 2. A {@link ValidationError} with a field to indicate an error on the target field.
 * 3. A list of {@link ValidationError} with fields to indicate multiple errors.
 *
 * @template E the type of error (defaults to {@link ValidationError}).
 *
 * @category types
 * @experimental 21.0.0
 */
export type ValidationResult<E extends ValidationError = ValidationError> =
  | ValidationSuccess
  | OneOrMany<E>;

/**
 * An asynchronous validation result where all errors explicitly define their target field.
 *
 * The result may be one of the following:
 * 1. A {@link ValidationResult} to indicate the result if resolved.
 * 5. 'pending' if the validation is not yet resolved.
 *
 * @template E the type of error (defaults to {@link ValidationError}).
 *
 * @category types
 * @experimental 21.0.0
 */
export type AsyncValidationResult<E extends ValidationError = ValidationError> =
  | ValidationResult<E>
  | 'pending';

/**
 * An object that represents a tree of fields in a form. This includes both primitive value fields
 * (e.g. fields that contain a `string` or `number`), as well as "grouping fields" that contain
 * sub-fields. `FieldTree` objects are arranged in a tree whose structure mimics the structure of the
 * underlying data. For example a `FieldTree<{x: number}>` has a property `x` which contains a
 * `FieldTree<number>`. To access the state associated with a field, call it as a function.
 *
 * @template TValue The type of the data which the field is wrapped around.
 * @template TKey The type of the property key which this field resides under in its parent.
 *
 * @category types
 * @experimental 21.0.0
 */
export type FieldTree<TModel> =
  // Note: We use `[TModel]` in several places below to avoid the condition from being distributed
  // over a recursive union type, which seems to result in infinite type recursion. By adding the
  // tuple we're not testing a naked type parameter, and thus the condition is not distributed.
  // (See https://typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types)
  // The example below demonstrates the problematic situation we want to avoid:
  //
  // ```
  // type RecursiveType = (number | RecursiveType)[]
  // type Test = FieldTree<RecursiveType> // Infinite type recursion if condition distributes.
  // ```
  (() => [TModel] extends [AbstractControl] ? CompatFieldState<TModel> : FieldState<TModel>) &
    // Children:
    ([TModel] extends [AbstractControl]
      ? object
      : [TModel] extends [Array<infer U>]
        ? ReadonlyArrayLike<MaybeFieldTree<U>>
        : TModel extends Record<string, any>
          ? Subfields<TModel>
          : object);

/**
 * The sub-fields that a user can navigate to from a `FieldTree<TModel>`.
 *
 * @template TModel The type of the data which the parent field is wrapped around.
 *
 * @experimental 21.0.0
 */
export type Subfields<TModel> = {
  readonly [K in keyof TModel as TModel[K] extends Function ? never : K]: MaybeFieldTree<TModel[K]>;
} & {
  [Symbol.iterator](): Iterator<[string, MaybeFieldTree<TModel[keyof TModel]>]>;
};

/**
 * An iterable object with the same shape as a readonly array.
 *
 * @template T The array item type.
 *
 * @experimental 21.0.0
 */
export type ReadonlyArrayLike<T> = Pick<
  ReadonlyArray<T>,
  number | 'length' | typeof Symbol.iterator
>;

/**
 * Helper type for defining `FieldTree`. Given a type `TValue` that may include `undefined`, it extracts
 * the `undefined` outside the `FieldTree` type.
 *
 * For example `MaybeField<{a: number} | undefined, TKey>` would be equivalent to
 * `undefined | FieldTree<{a: number}, TKey>`.
 *
 * @template TModel The type of the data which the field is wrapped around.
 * @template TKey The type of the property key which this field resides under in its parent.
 *
 * @experimental 21.0.0
 */
export type MaybeFieldTree<TModel> = (TModel & undefined) | FieldTree<Exclude<TModel, undefined>>;

/**
 * Contains all of the state (e.g. value, statuses, etc.) associated with a `FieldTree`, exposed as
 * signals.
 *
 * @category structure
 * @experimental 21.0.0
 */
export interface FieldState<TValue> extends ɵFieldState<TValue> {
  /**
   * A signal indicating whether field value has been changed by user.
   */
  readonly dirty: Signal<boolean>;

  /**
   * A signal indicating whether a field is hidden.
   *
   * When a field is hidden it is ignored when determining the valid, touched, and dirty states.
   *
   * Note: This doesn't hide the field in the template, that must be done manually.
   * ```
   * @if (!field.hidden()) {
   *   ...
   * }
   * ```
   */
  readonly hidden: Signal<boolean>;
  readonly disabledReasons: Signal<readonly DisabledReason[]>;
  readonly errors: Signal<ValidationError.WithField[]>;

  /**
   * A signal containing the {@link errors} of the field and its descendants.
   */
  readonly errorSummary: Signal<ValidationError.WithField[]>;

  /**
   * A signal indicating whether the field's value is currently valid.
   *
   * Note: `valid()` is not the same as `!invalid()`.
   * - `valid()` is `true` when there are no validation errors *and* no pending validators.
   * - `invalid()` is `true` when there are validation errors, regardless of pending validators.
   *
   * Ex: consider the situation where a field has 3 validators, 2 of which have no errors and 1 of
   * which is still pending. In this case `valid()` is `false` because of the pending validator.
   * However `invalid()` is also `false` because there are no errors.
   */
  readonly valid: Signal<boolean>;
  /**
   * A signal indicating whether the field's value is currently invalid.
   *
   * Note: `invalid()` is not the same as `!valid()`.
   * - `invalid()` is `true` when there are validation errors, regardless of pending validators.
   * - `valid()` is `true` when there are no validation errors *and* no pending validators.
   *
   * Ex: consider the situation where a field has 3 validators, 2 of which have no errors and 1 of
   * which is still pending. In this case `invalid()` is `false` because there are no errors.
   * However `valid()` is also `false` because of the pending validator.
   */
  readonly invalid: Signal<boolean>;
  /**
   * Whether there are any validators still pending for this field.
   */
  readonly pending: Signal<boolean>;
  /**
   * A signal indicating whether the field is currently in the process of being submitted.
   */
  readonly submitting: Signal<boolean>;

  /**
   * The property key in the parent field under which this field is stored. If the parent field is
   * array-valued, for example, this is the index of this field in that array.
   */
  readonly key: Signal<string>;
  /**
   * The {@link Field} directives that bind this field to a UI control.
   */
  readonly fieldBindings: Signal<readonly Field<unknown>[]>;

  /**
   * Reads a metadata value from the field.
   * @param key The metadata key to read.
   */
  metadata<M>(key: MetadataKey<M, any, any>): M | undefined;

  /**
   * Resets the {@link touched} and {@link dirty} state of the field and its descendants.
   *
   * Note this does not change the data model, which can be reset directly if desired.
   *
   * @param value Optional value to set to the form. If not passed, the value will not be changed.
   */
  reset(value?: TValue): void;
}

/**
 * This is FieldState also providing access to the wrapped FormControl.
 *
 * @category interop
 * @experimental 21.0.0
 */
export interface CompatFieldState<TControl extends AbstractControl>
  extends FieldState<TControl extends AbstractControl<unknown, infer TValue> ? TValue : never> {
  control: Signal<TControl>;
}

/**
 * An object that represents a location in the `FieldTree` tree structure that can be used to
 * reference fields within a schema. This is a base type that encompasses both paths that support
 * rules and paths that do not (e.g., compat paths for `AbstractControl`).
 *
 * Use `SchemaPath` instead when you need a path that supports rules.
 *
 * @template TValue The type of the data which the form is wrapped around.
 *
 * @category types
 * @experimental 21.0.0
 */
export type SchemaReferencePath<TValue> = {
  [ɵɵTYPE]: {
    value: () => TValue;
  };
};

/**
 * An object that represents a location in the `FieldTree` tree structure and is used to bind logic to a
 * particular part of the structure prior to the creation of the form. Because the `SchemaPath`
 * exists prior to the form's creation, it cannot be used to access any of the field state.
 *
 * A `SchemaPath` supports rules (e.g., `validate`, `required`, `disabled`). For paths that may not
 * support rules (e.g., compat paths for `AbstractControl`), use `SchemaReferencePath` instead.
 *
 * @template TValue The type of the data which the form is wrapped around.
 *
 * @category types
 * @experimental 21.0.0
 */
export type SchemaPath<TValue> = {
  [ɵɵTYPE]: {
    value: () => TValue;
    supportsRules: true;
  };
};

/**
 * Schema path used if the value is an AbstractControl.
 *
 * Note: `CompatSchemaPath` is a `SchemaReferencePath` but NOT a `SchemaPath`, because it does not
 * support rules. This means it can be used with `valueOf()` and `stateOf()`, but not with
 * `validate()`, `required()`, or other rule functions.
 *
 * @category interop
 * @experimental 21.0.0
 */
export type CompatSchemaPath<TControl extends AbstractControl> = {
  [ɵɵTYPE]: {
    value: () => TControl extends AbstractControl<unknown, infer TValue> ? TValue : never;
    // Explicitly false to prevent casting to SchemaPath
    supportsRules: false;
    // Capture the control type, so that `stateOf(p)` can unwrap to a correctly typed `CompatFieldState`.
    control: TControl;
  };
};

/**
 * Nested schema path.
 *
 * It mirrors the structure of a given data structure, and allows applying rules to the appropriate
 * fields.
 *
 * @experimental 21.0.0
 */
export type SchemaPathTree<TModel> =
  // Note: We use `[TModel]` here to avoid distributing over a union type model.
  // (e.g. if we have a model of `number | string`, we want a `SchemaPath<number | string>`,
  // not a `SchemaPath<number> | SchemaPath<string>`.
  // See https://typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types)
  ([TModel] extends [AbstractControl] ? CompatSchemaPath<TModel> : SchemaPath<TModel>) &
    // Subpaths
    (TModel extends AbstractControl
      ? unknown
      : // Array paths have no subpaths
        TModel extends Array<any>
        ? unknown
        : // Object subfields
          TModel extends Record<string, any>
          ? {[K in keyof TModel]: MaybeSchemaPathTree<TModel[K]>}
          : // Primitive or other type - no subpaths
            unknown);

/**
 * Helper type for defining `FieldPath`. Given a type `TValue` that may include `undefined`, it
 * extracts the `undefined` outside the `FieldPath` type.
 *
 * For example `MaybeFieldPath<{a: number} | undefined, PathKind.Child>` would be equivalent to
 * `undefined | FieldTree<{a: number}, PathKind.child>`.
 *
 * @template TValue The type of the data which the field is wrapped around.
 * @template TPathKind The kind of path (root field, child field, or item of an array)
 *
 * @experimental 21.0.0
 */
export type MaybeSchemaPathTree<TModel> =
  | (TModel & undefined)
  | SchemaPathTree<Exclude<TModel, undefined>>;

/**
 * Defines logic for a form.
 *
 * @template TValue The type of data stored in the form that this schema is attached to.
 *
 * @category types
 * @experimental 21.0.0
 */
export type Schema<in TModel> = {
  [ɵɵTYPE]: SchemaFn<TModel>;
};

/**
 * Function that defines rules for a schema.
 *
 * @template TModel The type of data stored in the form that this schema function is attached to.
 * @template TPathKind The kind of path this schema function can be bound to.
 *
 * @category types
 * @experimental 21.0.0
 */
export type SchemaFn<TModel> = (p: SchemaPathTree<TModel>) => void;

/**
 * A schema or schema definition function.
 *
 * @template TModel The type of data stored in the form that this schema function is attached to.
 * @template TPathKind The kind of path this schema function can be bound to.
 *
 * @category types
 * @experimental 21.0.0
 */
export type SchemaOrSchemaFn<TModel> = Schema<TModel> | SchemaFn<TModel>;

/**
 * A function that receives the `FieldContext` for the field the logic is bound to and returns
 * a specific result type.
 *
 * @template TValue The data type for the field the logic is bound to.
 * @template TReturn The type of the result returned by the logic function.
 * @template TPathKind The kind of path the logic is applied to (root field, child field, or item of an array)
 *
 * @category types
 * @experimental 21.0.0
 */
export type LogicFn<TValue, TReturn> = (ctx: FieldContext<TValue>) => TReturn;

/**
 * A function that takes the `FieldContext` for the field being validated and returns a
 * `ValidationResult` indicating errors for the field.
 *
 * @template TValue The type of value stored in the field being validated
 * @template TPathKind The kind of path being validated (root field, child field, or item of an array)
 *
 * @category validation
 * @experimental 21.0.0
 */
export type FieldValidator<TValue> = LogicFn<
  TValue,
  ValidationResult<ValidationError.WithoutField>
>;

/**
 * A function that takes the `FieldContext` for the field being validated and returns a
 * `TreeValidationResult` indicating errors for the field and its sub-fields.
 *
 * @template TValue The type of value stored in the field being validated
 * @template TPathKind The kind of path being validated (root field, child field, or item of an array)
 *
 * @category types
 * @experimental 21.0.0
 */
export type TreeValidator<TValue> = LogicFn<TValue, TreeValidationResult>;

/**
 * A function that takes the `FieldContext` for the field being validated and returns a
 * `ValidationResult` indicating errors for the field and its sub-fields. In a `Validator` all
 * errors must explicitly define their target field.
 *
 * @template TValue The type of value stored in the field being validated
 * @template TPathKind The kind of path being validated (root field, child field, or item of an array)
 *
 * @category types
 * @experimental 21.0.0
 */
export type Validator<TValue> = LogicFn<TValue, ValidationResult>;

/**
 * Provides access to the state of the current field as well as functions that can be used to look
 * up state of other fields based on a `SchemaReferencePath`.
 *
 * @category types
 * @experimental 21.0.0
 */
export interface FieldContext<TValue> {
  /** A signal containing the value of the current field. */
  readonly value: Signal<TValue>;
  /** The state of the current field. */
  readonly state: FieldState<TValue>;
  /** The current field. */
  readonly field: FieldTree<TValue>;

  /** Gets the value of the field represented by the given path. */
  valueOf<PValue>(p: SchemaReferencePath<PValue>): PValue;

  /** Gets the state of the field represented by the given path. */
  stateOf<PControl extends AbstractControl>(
    p: CompatSchemaPath<PControl>,
  ): CompatFieldState<PControl>;
  stateOf<PValue>(p: SchemaReferencePath<PValue>): FieldState<PValue>;
  /** Gets the field represented by the given path. */
  fieldTreeOf<PModel>(p: SchemaPathTree<PModel>): FieldTree<PModel>;
  /** The list of keys that lead from the root field to the current field. */
  readonly pathKeys: Signal<readonly string[]>;
}

/**
 * Gets the item type of an object that is possibly an array.
 *
 * @experimental 21.0.0
 */
export type ItemType<T extends Object> = T extends ReadonlyArray<any> ? T[number] : T[keyof T];

/**
 * A function that defines custom debounce logic for a field.
 *
 * @param context The field context.
 * @param abortSignal An `AbortSignal` used to communicate that the debounced operation was aborted.
 * @returns A `Promise<void>` to debounce an update, or `void` to apply an update immediately.
 * @template TValue The type of value stored in the field.
 * @template TPathKind The kind of path the debouncer is applied to (root field, child field, or item of an array).
 *
 * @experimental 21.0.0
 */
export type Debouncer<TValue> = (
  context: FieldContext<TValue>,
  abortSignal: AbortSignal,
) => Promise<void> | void;
