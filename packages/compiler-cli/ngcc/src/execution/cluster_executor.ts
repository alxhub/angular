/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/// <reference types="node" />
import * as cluster from 'cluster';
import {DepGraph} from 'dependency-graph';

import {EntryPoint} from '../packages/entry_point';

import {AnalyzeFn, Executor, Task, TaskQueue} from './api';
import {NgccTaskCompiler} from './compiler';

interface CompileTaskMessage {
  type: 'compile';
  task: Task;
}

interface ResultMessage {
  type: 'result';
  path: string;
  error?: string;
}

type Message = CompileTaskMessage | ResultMessage;

export class ClusterExecutor implements Executor {
  constructor(private n: number) {}

  async execute(analyzeFn: AnalyzeFn, compiler: NgccTaskCompiler): Promise<void> {
    if (cluster.isMaster) {
      const {queue, graph} = analyzeFn();
      const master = new ClusterMaster(this.n, queue, graph);
      return master.run();
    } else {
      const worker = new ClusterWorker(compiler);
      return worker.run();
    }
  }
}

export class ClusterMaster {
  private assignments = new Map<number, Task|null>();
  private activeWorkers: number[] = [];
  private allDone !: () => void;
  private finishedPromise: Promise<void>

  constructor(private n: number, private queue: TaskQueue, private graph: DepGraph<EntryPoint>) {
    this.finishedPromise = new Promise(resolve => { this.allDone = resolve; });
  }

  async run(): Promise<void> {
    // First, start all the workers.
    for (let i = 0; i < this.n; i++) {
      const worker = cluster.fork();
      worker.on('message', (msg: Message) => {
        if (msg.type === 'result') {
          if (msg.error !== undefined) {
            throw new Error(msg.error);
          }
          this.onWorkerFinishedTask(worker.id);
        }
      });
      worker.on('online', () => this.onWorkerReady(worker.id));
    }

    return this.finishedPromise;
  }

  private onWorkerReady(workerId: number): void {
    this.activeWorkers.push(workerId);
    this.assignments.set(workerId, null);

    this.maybeDistributeWork();
  }

  private onWorkerFinishedTask(workerId: number): void {
    this.assignments.set(workerId, null);
    if (this.isAllWorkDone()) {
      this.allDone();
      for (const workerId in cluster.workers) {
        cluster.workers[workerId] !.kill();
      }
    } else {
      this.maybeDistributeWork();
    }
  }

  private isAllWorkDone(): boolean {
    if (!this.queue.isEmpty) {
      return false;
    }
    for (const workerId of this.activeWorkers) {
      if (this.assignments.get(workerId) !== null) {
        return false;
      }
    }
    return true;
  }

  private maybeDistributeWork(): void {
    for (const workerId of this.activeWorkers) {
      if (this.assignments.get(workerId) !== null) {
        // This worker already has a job.
        continue;
      }

      // This worker needs a job. See if any are available.
      const task = this.getNextTask();
      if (task === null) {
        // No suitable work available right now.
        const working =
            this.activeWorkers.map(id => this.assignments.get(id)).filter(a => a !== null);
        const numIdle = this.activeWorkers.length - working.length;
        console.error(`no assignments for ${numIdle} workers (active ${working.join(', ')})`);
        return;
      }

      // Run this compilation on the worker.
      this.assignments.set(workerId, task);
      this.sendToWorker(workerId, {
        type: 'compile',
        task,
      });
    }
  }

  private getNextTask(): Task|null {
    return this.queue.takeMatching(task => {
      const deps = new Set<string>(this.graph.dependenciesOf(task.entryPoint.path));
      // This task is acceptable if it has no dependencies actively being compiled.
      for (const workerId of this.activeWorkers) {
        const currentTask = (this.assignments.get(workerId) as Task | null);
        // If this task being compiled isn't generating typings, then it cannot affect anything
        // which depends on the entrypoint, regardless of the dep graph. To put this another way,
        // only the task which produces the typings for a dependency needs to have finished.
        if (currentTask === null || !currentTask.processDts) {
          continue;
        }
        if (deps.has(currentTask.entryPoint.path)) {
          // A dependency of the task under consideration is still being compiled, so it must wait.
          return false;
        }
      }
      return true;
    });
  }

  private sendToWorker(workerId: number, msg: Message): void {
    cluster.workers[workerId.toString()] !.send(msg);
  }
}

export class ClusterWorker {
  constructor(private compiler: NgccTaskCompiler) {}

  run(): Promise<void> {
    cluster.worker.on('message', (msg: Message) => {
      if (msg.type === 'compile') {
        try {
          this.compiler.compile(msg.task);
          this.sendToMaster({
            type: 'result',
            path: msg.task.entryPoint.path,
          });
        } catch (e) {
          this.sendToMaster({
            type: 'result',
            path: msg.task.entryPoint.path,
            error: e.toString(),
          });
        }
      }
    });

    // A promise that never returns.
    return new Promise(() => undefined);
  }

  private sendToMaster(msg: Message): void { process.send !(msg); }
}
