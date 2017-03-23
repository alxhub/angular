import {Observable} from 'rxjs/Observable';
import {HttpRequest} from './request';
import {HttpResponse} from './response';

export abstract class HttpHandler {
  abstract handle(req: HttpRequest): Observable<HttpResponse>;
}

export abstract class HttpBackend implements HttpHandler {
  abstract handle(req: HttpRequest): Observable<HttpResponse>;
}

export abstract class XhrFactory {
  abstract build(): XMLHttpRequest;
}