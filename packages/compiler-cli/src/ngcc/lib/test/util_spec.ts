
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {getGreeting} from '../src/util';

describe('utilities', () => {
  it('should have the correct greeting', () => {
    expect(getGreeting()).toContain('ngcc');
  });
});
