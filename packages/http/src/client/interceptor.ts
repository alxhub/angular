import {InjectionToken} from '@angular/core';
import {Observable} from 'rxjs/Observable';

import {HttpHandler} from './backend';
import {HttpRequest} from './request';
import {HttpResponse} from './response';

export interface HttpInterceptor {
  intercept(req: HttpRequest, next: HttpHandler): Observable<HttpResponse>;
}

export class HttpInterceptorHandler implements HttpHandler {

  constructor(private next: HttpHandler, private interceptor: HttpInterceptor) {}

  handle(req: HttpRequest): Observable<HttpResponse> {
    return this.interceptor.intercept(req, this.next);
  }
}

export const HTTP_INTERCEPTORS = new InjectionToken<HttpInterceptor[]>("HTTP_INTERCEPTORS");
