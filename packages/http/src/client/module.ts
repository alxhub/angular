import {Inject, NgModule, Optional} from '@angular/core';

import {HttpBackend, HttpHandler} from './backend';
import {HttpClient} from './client';
import {HttpInterceptor, HttpInterceptorHandler, HTTP_INTERCEPTORS} from './interceptor';
import {JsonpAdapter, JsonpClientBackend, JsonpInterceptor} from './jsonp';
import {BrowserXhr, HttpXhrBackend, XhrFactory} from './xhr';

export function interceptingHandler(backend: HttpBackend, interceptors: HttpInterceptor[] = []): HttpHandler {
  return interceptors.reduceRight(
    (next, interceptor) => new HttpInterceptorHandler(next, interceptor),
    backend
  );
}

@NgModule({
  providers: [
    HttpClient,
    {
      provide: HttpHandler,
      useFactory: interceptingHandler,
      deps: [HttpBackend, [new Optional(), new Inject(HTTP_INTERCEPTORS)]],
    },
    {provide: HttpBackend, useClass: HttpXhrBackend},
    {provide: XhrFactory, useClass: BrowserXhr},
  ],
})
export class HttpClientModule {}

@NgModule({
  providers: [
    JsonpAdapter,
    JsonpClientBackend,
    {provide: HTTP_INTERCEPTORS, useValue: JsonpInterceptor, multi: true},
  ],
})
export class HttpClientJsonpModule {}
