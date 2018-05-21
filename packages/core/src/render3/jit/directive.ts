/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {compileComponent as compileIvyComponent, compileDirective as compileIvyDirective, parseTemplate, ConstantPool, makeBindingParser, WrappedNodeExpr, jitExpression, jitPatchDefinition, R3DirectiveMetadata} from '@angular/compiler';

import {Component, Directive, Input, Output} from '../../metadata/directives';
import {ReflectionCapabilities} from '../../reflection/reflection_capabilities';
import {Type} from '../../type';

import {angularCoreEnv} from './environment';
import {reflectDependencies, getReflect} from './util';

let _pendingPromises: Promise<void>[] = [];

/**
 * Compile an Angular component according to its decorator metadata, and patch the resulting
 * ngComponentDef onto the component type.
 *
 * Compilation may be asynchronous (due to the need to resolve URLs for the component template or
 * other resources, for example). In the event that compilation is not immediate, `compileComponent`
 * will return a `Promise` which will resolve when compilation completes and the component becomes
 * usable.
 */
export function compileComponent(type: Type<any>, metadata: Component): Promise<void>|null {
  // TODO(alxhub): implement ResourceLoader support for template compilation.
  if (!metadata.template) {
    throw new Error('templateUrl not yet supported');
  }

  // Parse the template and check for errors.
  const template = parseTemplate(metadata.template !, `ng://${type.name}/template.html`);
  if (template.errors !== undefined) {
    const errors = template.errors.map(err => err.toString()).join(', ');
    throw new Error(`Errors during JIT compilation of template for ${type.name}: ${errors}`);
  }

  // The ConstantPool is a requirement of the JIT'er.
  const constantPool = new ConstantPool();


  // Compile the component metadata, including template, into an expression.
  // TODO(alxhub): implement inputs, outputs, queries, etc.
  const res = compileIvyComponent(
      {
        ...directiveMetadata(type, metadata),
        template,
        directives: new Map(),
        pipes: new Map(),
        viewQueries: [],
      },
      constantPool, makeBindingParser());

  // Patch the generated expression as ngComponentDef on the type.
  jitPatchDefinition(type, 'ngComponentDef', res.expression, angularCoreEnv, constantPool);
  return null;
}

export function compileDirective(type: Type<any>, directive: Directive): void {
  let def: any = null;
  Object.defineProperty(type, 'ngDirectiveDef', {
    get: () => {
      if (def === null) {
        const constantPool = new ConstantPool();
        const sourceMapUrl = `ng://${type && type.name}/ngDirectiveDef`;
        const res = compileIvyDirective(
            directiveMetadata(type, directive), constantPool, makeBindingParser());
        def = jitExpression(res.expression, angularCoreEnv, sourceMapUrl, constantPool);
      }
      return def;
    },
  });
}

/**
 * A wrapper around `compileComponent` which is intended to be used for the `@Component` decorator.
 *
 * This wrapper keeps track of the `Promise` returned by `compileComponent` and will cause
 * `awaitCurrentlyCompilingComponents` to wait on the compilation to be finished.
 */
export function compileComponentDecorator(type: Type<any>, metadata: Component): void {
  const res = compileComponent(type, metadata);
  if (res !== null) {
    _pendingPromises.push(res);
  }
}

/**
 * Returns a promise which will await the compilation of any `@Component`s which have been defined
 * since the last time `awaitCurrentlyCompilingComponents` was called.
 */
export function awaitCurrentlyCompilingComponents(): Promise<void> {
  const res = Promise.all(_pendingPromises).then(() => undefined);
  _pendingPromises = [];
  return res;
}

function directiveMetadata(type: Type<any>, metadata: Directive): R3DirectiveMetadata {
  // Reflect inputs and outputs.
  const props = getReflect().propMetadata(type);
  const inputs: {[key: string]: string} = {};
  const outputs: {[key: string]: string} = {};

  for (let field in props) {
    props[field].forEach(ann => {
      if (isInput(ann)) {
        inputs[field] = ann.bindingPropertyName || field;
      } else if (ann.ngMetadataName === 'Output') {
        outputs[field] = ann.bindingPropertyName || field;
      }
    });
  }

  return {
    name: type.name,
    type: new WrappedNodeExpr(type),
    selector: metadata.selector !,
    deps: reflectDependencies(type),
    host: {
      attributes: {},
      listeners: {},
      properties: {},
    },
    inputs,
    outputs,
    queries: [],
    lifecycle: {
      usesOnChanges: type.prototype.ngOnChanges !== undefined,
    },
    typeSourceSpan: null !,
  };
}

function isInput(value: any): value is Input {
  return value.ngMetadataName === 'Input';
}

function isOutput(value: any): value is Output {
  return value.ngMetadataName === 'Output';
}