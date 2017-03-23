import {Injectable} from '@angular/core';
import {Observable} from 'rxjs/Observable';

import {HttpHandler} from './backend';
import {HttpInterceptor} from './interceptor';
import {HttpMethod, HttpRequest} from './request';
import {HttpResponse} from './response';

@Injectable()
export class JsonpInterceptor {
  constructor(backend: JsonpClientBackend) {}

  intercept(req: HttpRequest, next: HttpHandler): Observable<HttpResponse> {
    if (req.method === HttpMethod.Jsonp) {
      
    }
    return next.handle(req);
  }

}