/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {DepGraph} from 'dependency-graph';

import {EntryPoint, PackageJsonFormatKey, PackageJsonFormatProperties} from '../packages/entry_point';

import {NgccTaskCompiler} from './compiler';

export type AnalyzeFn = () => {
  queue: TaskQueue;
  graph: DepGraph<EntryPoint>;
};

export interface Task {
  entryPoint: EntryPoint;
  /**
   * A single task can produce results for multiple keys in the package.json.
   */
  formatProperties: PackageJsonFormatKey[];

  /**
   * Whether to also compile typings for this project.
   */
  processDts: boolean;
}

export interface Executor {
  execute(analyzeFn: AnalyzeFn, compiler: NgccTaskCompiler): Promise<void>|void;
}

export interface TaskQueue {
  takeFirst(): Task|null;
  takeMatching(predicate: (task: Task) => boolean): Task|null;

  readonly isEmpty: boolean;
}
