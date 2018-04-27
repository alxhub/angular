/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript';

import {makeProgram, getDeclaration} from '../../test_util';
import {ScopeAnalyzer, ModuleScope} from '../src/scope';

const FAKE_ANGULAR_CORE = [{
  name: '/node_modules/@angular/core/index.d.ts',
  contents: `
export type ClassDecorator = (clazz: any) => any;
export type ClassDecoratorWithParam = (param?: any) => ClassDecorator;

export const Component: ClassDecoratorWithParam;
export const NgModule: ClassDecoratorWithParam;
`
}];

describe('ngtsc scope analysis', () => {
  it('analyzes a module', () => {
    const program = makeProgram([
      ...FAKE_ANGULAR_CORE,
      {
        name: 'index.ts',
        contents: `
import {Component, NgModule} from '@angular/core';

@Component({
  selector: 'test',
})
export class TestComponent {}

@NgModule({
  declarations: [TestComponent],
})
export class TestModule {}
        `
      }
    ]);
    const analyzer = new ScopeAnalyzer(program.getTypeChecker());
    const scopes: ModuleScope[] = [];
    program.getSourceFiles().filter(sf => !sf.fileName.endsWith('.d.ts')).forEach(sf => scopes.push(...analyzer.analyze(sf)));
    expect(scopes.length).toBe(1);
    const scope = scopes[0];
    const directives = scope.compilationScope.directives;
    expect(directives.length).toBe(1);
    expect(directives[0].selector).toBe('test');
    expect(directives[0].importFrom.relatively).toBe('/index.ts');
    expect(directives[0].identifier).toBe('TestComponent');

    const TestComponent = getDeclaration(program, 'index.ts', 'TestComponent', ts.isClassDeclaration);
    expect(analyzer.getScopeForDirective(TestComponent)).toBe(scope.compilationScope);
  });

  it('analyzes a component in a separate file', () => {
    const program = makeProgram([
      ...FAKE_ANGULAR_CORE,
      {
        name: 'index.ts',
        contents: `
import {NgModule} from '@angular/core';
import {TestComponent} from './component';

@NgModule({
  declarations: [TestComponent],
})
export class TestModule {}
        `,
      }, {
        name: 'component.ts',
        contents: `
import {Component} from '@angular/core';

@Component({
  selector: 'test',
})
export class TestComponent {}
        `
      }
    ]);
    const analyzer = new ScopeAnalyzer(program.getTypeChecker());
    program.getSourceFiles().filter(sf => !sf.fileName.endsWith('.d.ts')).forEach(sf => analyzer.analyze(sf));
    const TestComponent = getDeclaration(program, 'component.ts', 'TestComponent', ts.isClassDeclaration);
    expect(analyzer.getScopeForDirective(TestComponent)).toBeDefined();
  });
});