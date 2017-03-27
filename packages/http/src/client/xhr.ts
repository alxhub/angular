import {Injectable} from '@angular/core';
import {Observable} from 'rxjs/Observable';
import {Observer} from 'rxjs/Observer';

import {HttpBackend} from './backend';
import {HttpBody, HttpMethod, HttpRequest, HttpResponseType} from './request';
import {HttpEvent, HttpEventType, HttpResponse, HttpHeaderResponse} from './response';

import {HttpHeaders} from './headers';
import {getResponseURL} from '../http_utils';

const XSSI_PREFIX = /^\)\]\}',?\n/;

interface PartialResponse {
  headers: HttpHeaders;
  status: number;
  statusText: string;
  url: string;
}

export abstract class XhrFactory {
  abstract build(): XMLHttpRequest;
}

/**
 * A backend for http that uses the `XMLHttpRequest` browser API.
 *
 * Take care not to evaluate this in non-browser contexts.
 *
 * @experimental
 */
@Injectable()
export class BrowserXhr implements XhrFactory {
  constructor() {}
  build(): any { return <any>(new XMLHttpRequest()); }
}

@Injectable()
export class HttpXhrBackend implements HttpBackend {
  constructor(private xhrFactory: XhrFactory) {}

  handle(req: HttpRequest): Observable<HttpEvent> {
    if (req.method === HttpMethod.Jsonp) {
      throw new Error(`Attempted to construct Jsonp request without JsonpClientModule installed.`);
    }
    return new Observable((observer: Observer<HttpEvent>) => {
      const xhr = this.xhrFactory.build();
      xhr.open(req.verb, req.url);
      if (!!req.withCredentials) {
        xhr.withCredentials = true;
      }

      let respHeaders: HttpHeaderResponse|null = null;

      const partialFromXhr = (existing?: HttpHeaderResponse|null): PartialResponse => {
        if (existing !== null) {
          return existing as PartialResponse;
        }

        // normalize IE9 bug (http://bugs.jquery.com/ticket/1450)
        const status: number = xhr.status === 1223 ? 204 : xhr.status;
        const headers = HttpHeaders.fromResponseHeaderString(xhr.getAllResponseHeaders());
        const url = getResponseURL(xhr) || req.url;
        const statusText = xhr.statusText || 'OK';
        return {headers, status, statusText, url};
      };

      const onLoad = () => {
        let body: HttpBody|null = null;
        let {headers, status, statusText, url} = partialFromXhr(respHeaders);

        if (status !== 204) {
          body = (typeof xhr.response === 'undefined') ? xhr.responseText : xhr.response;
          if (typeof body === 'string') {
            body = body.replace(XSSI_PREFIX, '');
          }
        }
        
        if (status === 0) {
          status = !!body ? 200 : 0;
        }

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

      let sentHeaders = false;

      const onDownProgress = (event: ProgressEvent) => {
        if (!sentHeaders) {
          const partial = partialFromXhr();
          respHeaders = new HttpHeaderResponse(partial);
          observer.next(respHeaders);
          sentHeaders = true;
        }
        if (event.lengthComputable) {
          observer.next({
            type: HttpEventType.DownloadProgress,
            loaded: event.loaded,
            total: event.total,
          });
        }
      };

      const onUpProgress = (event: ProgressEvent) => {
        if (event.lengthComputable) {
          observer.next({
            type: HttpEventType.UploadProgress,
            loaded: event.loaded,
            total: event.total,
          })
        }
      }

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
      if (req.responseType) {
        xhr.responseType = HttpResponseType[req.responseType].toLowerCase();
      }

      xhr.addEventListener('load', onLoad);
      xhr.addEventListener('error', onError);

      const reqBody = req.serializeBody();

      if (req.reportProgress) {
        xhr.addEventListener('progress', onDownProgress);

        if (reqBody !== null && xhr.upload) {
          xhr.upload.addEventListener('progress', onUpProgress);
        }
      }

      xhr.send(req.serializeBody());
      observer.next({type: HttpEventType.Sent});

      return () => {
        xhr.removeEventListener('error', onError);
        xhr.removeEventListener('load', onLoad);
        if (req.reportProgress) {
          xhr.removeEventListener('progress', onDownProgress);
          if (reqBody !== null && xhr.upload) {
            xhr.upload.removeEventListener('progress', onUpProgress);
          }
        }
        xhr.abort();

      };
    });
  }
}
