/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Task, TaskQueue} from './api';

export class ArrayTaskQueue implements TaskQueue {
  constructor(private tasks: Task[]) {}

  takeFirst(): Task|null { return this.tasks.length > 0 ? this.tasks.shift() ! : null; }

  takeMatching(predicate: (task: Task) => boolean): Task|null {
    for (let i = 0; i < this.tasks.length; i++) {
      const task = this.tasks[i];
      if (predicate === undefined || predicate(task)) {
        this.tasks.splice(i, 1);
        return task;
      }
    }
    return null;
  }

  get isEmpty(): boolean { return this.tasks.length === 0; }
}
