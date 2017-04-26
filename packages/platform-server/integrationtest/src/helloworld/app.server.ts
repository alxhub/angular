/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {NgModule} from '@angular/core';
import {Meta} from '@angular/platform-browser';
import {ServerModule, RenderListener, RENDER_LISTENER} from '@angular/platform-server';

import {HelloWorldModule} from './app';
import {HelloWorldComponent} from './hello-world.component';

export function beforeRender(meta: Meta): RenderListener {
  return () => meta.addTag({name: 'test', content: 'Added before render'}, true);
}

@NgModule({
  bootstrap: [HelloWorldComponent],
  imports: [HelloWorldModule, ServerModule],
  providers: [{provide: RENDER_LISTENER, useFactory: beforeRender, deps: [Meta]}],
})
export class HelloWorldServerModule {
}
