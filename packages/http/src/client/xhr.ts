import {Injectable} from '@angular/core';
import {Observable} from 'rxjs/Observable';
import {Observer} from 'rxjs/Observer';

import {HttpBackend, XhrFactory} from './backend';
import {HttpBody, HttpMethod, HttpRequest, HttpResponseType} from './request';
import {HttpResponse} from './response';

import {HttpHeaders} from '../headers';
import {getResponseURL} from '../http_utils';

const XSSI_PREFIX = /^\)\]\}',?\n/;

@Injectable()
export class HttpXhrBackend implements HttpBackend {
  constructor(private xhrFactory: XhrFactory) {}

  handle(req: HttpRequest): Observable<HttpResponse> {
    if (req.method === HttpMethod.Jsonp) {
      throw new Error(`Attempted to construct Jsonp request without JsonpClientModule installed.`);
    }
    return new Observable((observer: Observer<HttpResponse>) => {
      const xhr = this.xhrFactory.build();
      xhr.open(req.verb, req.url);
      if (!!req.withCredentials) {
        xhr.withCredentials = true;
      }

      const onLoad = () => {
        // normalize IE9 bug (http://bugs.jquery.com/ticket/1450)
        let status: number = xhr.status === 1223 ? 204 : xhr.status;
        let body: HttpBody|null = null;
        if (status !== 204) {
          body = (typeof xhr.response === 'undefined') ? xhr.responseText : xhr.response;
          if (typeof body === 'string') {
            body = body.replace(XSSI_PREFIX, '');
          }
        }
        
        if (status === 0) {
          status = !!body ? 200 : 0;
        }

        const headers = HttpHeaders.fromResponseHeaderString(xhr.getAllResponseHeaders());
        const url = getResponseURL(xhr) || req.url;
        const statusText = xhr.statusText || 'OK';

        const res = new HttpResponse({
          body,
          headers,
          status,
          statusText,
          url,
        });
        
        if (res.ok) {
          observer.next(res);
          observer.complete();
        } else {
          observer.error(res);
        }
      };
      
      const onError = (err: ErrorEvent) => {
        const res = new HttpResponse({
          body: err,
          status: xhr.status,
          statusText: xhr.statusText,
        });
        observer.error(res);
      };

      req.headers.forEach((values, name) => xhr.setRequestHeader(name, values.join(',')));

      if (!req.headers.has('Accept')) {
        xhr.setRequestHeader('Accept', 'application/json, text/plain, */*');
      }
      if (!req.headers.has('Content-Type')) {
        const detectedType = req.detectContentTypeHeader();
        if (detectedType !== null) {
          xhr.setRequestHeader('Content-Type', detectedType);
        }
      }

      switch (req.responseType) {
        case HttpResponseType.ArrayBuffer:
        case HttpResponseType.Blob:
        case HttpResponseType.Json:
        case HttpResponseType.Text:
          xhr.responseType = HttpResponseType[req.responseType].toLowerCase();
          break;
        default:
          // Leave xhr.responseType unset.
          break;
      }

      xhr.addEventListener('load', onLoad);
      xhr.addEventListener('error', onError);

      xhr.send(req.serializeBody());
    });
  }
}
