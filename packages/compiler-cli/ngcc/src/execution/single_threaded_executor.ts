/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {AnalyzeFn, Executor, TaskQueue} from './api';
import {NgccTaskCompiler} from './compiler';

export class SingleProcessExecutor implements Executor {
  constructor() {}

  execute(analyzeFn: AnalyzeFn, compiler: NgccTaskCompiler): void {
    const {queue} = analyzeFn();
    while (true) {
      const task = queue.takeFirst();
      if (task === null) {
        break;
      }

      compiler.compile(task);
    }
  }
}
