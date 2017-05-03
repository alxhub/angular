/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {isPromise} from '../src/util/lang';

import {Inject, Injectable, InjectionToken, Optional} from './di';


/**
 * A function that will be executed when an application is initialized.
 * @experimental
 */
export const APP_INITIALIZER = new InjectionToken<Array<() => void>>('Application Initializer');

/**
 * A class that reflects the state of running {@link APP_INITIALIZER}s.
 *
 * @experimental
 */
@Injectable()
export class ApplicationInitStatus {
  private _donePromise: Promise<any>;
  private _done = false;

  constructor(@Inject(APP_INITIALIZER) @Optional() appInits: (() => any)[]) {
    const asyncInitPromises: Promise<any>[] = [];
    let resolve: Function;
    this._donePromise = new Promise(r => resolve = r);
    if (appInits) {
      for (let i = 0; i < appInits.length; i++) {
        const initResult = appInits[i]();
        if (isPromise(initResult)) {
          asyncInitPromises.push(initResult);
        }
      }
    }
    Promise.all(asyncInitPromises).then(() => {
      this._done = true;
      resolve();
    });
    if (asyncInitPromises.length === 0) {
      this._done = true;
    }
  }

  get done(): boolean { return this._done; }

  get donePromise(): Promise<any> { return this._donePromise; }
}
