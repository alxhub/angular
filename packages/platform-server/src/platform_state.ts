/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

const parse5 = require('parse5');

import {Injectable, Inject, Optional, InjectionToken} from '@angular/core';
import {DOCUMENT, ɵgetDOM as getDOM} from '@angular/platform-browser';

/**
 * A function which will execute just before {@link PlatformState} renders the
 * DOM to string or returns the tree. 
 *
 * @experimental
 */
export type RenderListener = () => void;

/**
 * All callbacks provided via this token will be called just before {@link PlatformState}
 * renders the DOM to string or returns the tree.
 *
 * Signature of the callback:
 * `() => void`.
 *
 * @experimental
 */
export const RENDER_LISTENER = new InjectionToken<RenderListener>('RENDER_LISTENER');

/**
 * Representation of the current platform state.
 *
 * @experimental
 */
@Injectable()
export class PlatformState {

  /**
   * Blocks re-entry into `_runRenderListeners()`.
   */
  private _runningListeners: boolean = false;

  constructor(@Inject(DOCUMENT) private _doc: any, @Optional() @Inject(RENDER_LISTENER) private _listeners?: RenderListener[]) {}

  /**
   * Renders the current state of the platform to string.
   */
  renderToString(): string {
    this._runRenderListeners();
    return getDOM().getInnerHTML(this._doc);
  }

  /**
   * Returns the current DOM state.
   */
  getDocument(): any {
    this._runRenderListeners();
    return this._doc;
  }

  /**
   * Runs all RenderListeners.
   */
  private _runRenderListeners() {
    if (this._runningListeners) {
      throw new Error(`Cannot access PlatformState APIs from a RENDER_LISTENER.`);
    }
    this._runningListeners = true;
    try {
      if (this._listeners !== undefined) {
        this._listeners.forEach(listener => listener());
      }
    } finally {
      this._runningListeners = false;
    }
  }
}
