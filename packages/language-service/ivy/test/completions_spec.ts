/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */


import * as ts from 'typescript';

import {LanguageService} from '../language_service';

import {APP_COMPONENT, setup, TEST_TEMPLATE} from './mock_host';

describe('completions', () => {
  const {project, service, tsLS} = setup();
  const ngLS = new LanguageService(project, tsLS);

  beforeEach(() => {
    service.reset();
  });


  it('should be able to get the completions at the end of an interpolation', () => {
    const {position, text} = service.overwriteInlineTemplate(APP_COMPONENT, '{{ti¦}}');
    const completions = ngLS.getCompletionsAtPosition(APP_COMPONENT, position, undefined);
    debugger;
    expectContain(completions, ts.ScriptElementKind.memberVariableElement, ['title', 'hero']);
  });
});

function expectContain(
    completions: ts.CompletionInfo|undefined, kind: ts.ScriptElementKind, names: string[]) {
  expect(completions).toBeDefined();
  for (const name of names) {
    expect(completions!.entries).toContain(jasmine.objectContaining({name, kind} as any));
  }
}
