import {Injectable} from '@angular/core';
import {Observable} from 'rxjs/Observable';
import {Observer} from 'rxjs/Observer';

import {HttpBackend} from './backend';
import {HttpRequest} from './request';
import {HttpResponse} from './response';

@Injectable()
export class HttpXhrBackend implements HttpBackend {
  handle(req: HttpRequest): Observable<HttpResponse> {
    return new Observable((observer: Observer<HttpResponse>) => {
      
    });
  }
}