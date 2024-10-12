/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {assertInInjectionContext, Injector, ValueEqualityFn, WritableResource} from '@angular/core';
import {resource} from '@angular/core/src/resource/resource';
import {firstValueFrom, Observable, Subject, takeUntil} from 'rxjs';

export interface RxResourceOptions<R, T> {
  request: () => R;
  loader: (req: Exclude<NoInfer<R>, undefined>) => Observable<T>;
  equal?: ValueEqualityFn<T>;
  injector?: Injector;
}

export function rxResource<R, T>({
  request,
  loader,
  equal,
  injector,
}: RxResourceOptions<R, T>): WritableResource<T> {
  injector || assertInInjectionContext(rxResource);
  return resource<T, R>({
    request,
    loader: ({request, abortSignal}) => {
      const cancelled = new Subject<void>();
      abortSignal.addEventListener('abort', () => cancelled.next());
      return firstValueFrom(loader(request).pipe(takeUntil(cancelled)));
    },
    equal,
    injector,
  });
}

export function toResource<T>(
  observable: Observable<T>,
  opts?: {injector?: Injector},
): WritableResource<T> {
  opts?.injector || assertInInjectionContext(toResource);
  return rxResource({
    request: () => null,
    loader: () => observable,
    injector: opts?.injector,
  });
}
