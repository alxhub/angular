import {InjectionToken} from '@angular/core';
import {Observable} from 'rxjs/Observable';

import {HttpHandler} from './backend';
import {HttpRequest} from './request';
import {HttpEvent, HttpResponse} from './response';

export interface HttpInterceptor {
  intercept(req: HttpRequest, next: HttpHandler): Observable<HttpEvent>;
}

export class HttpInterceptorHandler implements HttpHandler {

  constructor(private next: HttpHandler, private interceptor: HttpInterceptor) {}

  handle(req: HttpRequest): Observable<HttpEvent> {
    return this.interceptor.intercept(req, this.next);
  }
}

export const HTTP_INTERCEPTORS = new InjectionToken<HttpInterceptor[]>("HTTP_INTERCEPTORS");
