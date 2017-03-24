import {Observable} from 'rxjs/Observable';
import {HttpRequest} from './request';
import {HttpEvent} from './response';

export abstract class HttpHandler {
  abstract handle(req: HttpRequest): Observable<HttpEvent>;
}

export abstract class HttpBackend implements HttpHandler {
  abstract handle(req: HttpRequest): Observable<HttpEvent>;
}
