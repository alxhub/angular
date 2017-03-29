import {Injectable} from '@angular/core';
import {Observable} from 'rxjs/Observable';
import {concatMap} from 'rxjs/operator/concatMap';
import {filter} from 'rxjs/operator/filter';

import {HttpHeaders} from './headers';
import {HttpUrlParams} from './url_params';

import {HttpHandler} from './backend';
import {HttpBody, HttpMethod, HttpRequest, HttpResponseType} from './request';
import {HttpEvent, HttpResponse} from './response';

export enum HttpObserve {
  Body,
  Events,
  Response,
}

export interface HttpMethodOptions {
  headers?: HttpHeaders;
  observe?: HttpObserve;
  responseType?: HttpResponseType;
  withCredentials?: boolean;
}
export interface _HttpMethodOptionsObserveEvents extends HttpMethodOptions {
  observe: HttpObserve.Events;
}
export interface _HttpMethodOptionsObserveResponse extends HttpMethodOptions {
  observe: HttpObserve.Response;
}
export interface _HttpMethodOptionsArrayObserveBufferBody extends HttpMethodOptions {
  observe?: HttpObserve.Body;
  responseType: HttpResponseType.ArrayBuffer;
}
export interface _HttpMethodOptionsObserveBlobBody extends HttpMethodOptions {
  observe?: HttpObserve.Body;
  responseType: HttpResponseType.Blob;
}
export interface _HttpMethodOptionsObserveTextBody extends HttpMethodOptions {
  observe?: HttpObserve.Body;
  responseType: HttpResponseType.Text;
}

export interface _HttpRequestBodyOptions {
  body?: HttpBody|null;
}

export interface HttpRequestOptions extends HttpMethodOptions, _HttpRequestBodyOptions {}

export interface _HttpRequestOptionsObserveEvents extends _HttpMethodOptionsObserveEvents, _HttpRequestBodyOptions {}

export interface _HttpRequestOptionsObserveResponse extends _HttpMethodOptionsObserveResponse, _HttpRequestBodyOptions {}

export interface _HttpRequestOptionsObserveArrayBufferBody extends _HttpMethodOptionsArrayObserveBufferBody, _HttpRequestBodyOptions {}

export interface HttpBlobRequestOptions extends HttpRequestOptions {
  observe?: HttpObserve.Body;
  responseType: HttpResponseType.Blob;
}
export interface HttpTextRequestOptions extends HttpRequestOptions {
  observe?: HttpObserve.Body;
  responseType: HttpResponseType.Text;
}
export interface HttpJsonpOptions {
  observe: HttpObserve;
}

function addBody(options: HttpMethodOptions, body: HttpBody|null): HttpRequestOptions {
  return {
    body,
    headers: options.headers,
    observe: options.observe,
    responseType: options.responseType,
    withCredentials: options.withCredentials,
  }
}

@Injectable()
export class HttpClient {
  constructor(private handler: HttpHandler) {}

  request(req: HttpRequest): Observable<HttpEvent>;
  request(url: string, method: HttpMethod|string, options: _HttpRequestOptionsObserveEvents): Observable<HttpEvent>;
  request(url: string, method: HttpMethod|string, options: _HttpRequestOptionsObserveResponse): Observable<HttpResponse>;
  request(url: string, method: HttpMethod|string, options: _HttpRequestOptionsObserveArrayBufferBody): Observable<ArrayBuffer>;
  request(url: string, method: HttpMethod|string, options: HttpBlobRequestOptions): Observable<Blob>;
  request(url: string, method: HttpMethod|string, options: HttpTextRequestOptions): Observable<string>;
  request(url: string, method: HttpMethod|string, options?: HttpRequestOptions): Observable<any>;
  request<T>(url: string, method: HttpMethod|string, options?: HttpRequestOptions): Observable<T>;
  request(first: string|HttpRequest, method?: HttpMethod|string, options: HttpRequestOptions = {}): Observable<any> {
    let req: HttpRequest;
    if (first instanceof HttpRequest) {
      req = first as HttpRequest;
    } else {
      req = new HttpRequest(first as string, method, options.body || null, {
        headers: options.headers,
        responseType: options.responseType,
        withCredentials: options.withCredentials,
      });
    }
    const events$: Observable<HttpEvent> = this.handler.handle(req);
    if (first instanceof HttpRequest || options.observe === HttpObserve.Events) {
      return events$;
    }
    const res$: Observable<HttpResponse> = filter.call(events$, (event: HttpEvent) => event instanceof HttpResponse);
    switch (options.observe || HttpObserve.Body) {
      case HttpObserve.Body:
        switch (req.responseType) {
          case HttpResponseType.ArrayBuffer:
            return concatMap.call(res$, (res: HttpResponse) => res.arrayBuffer());
          case HttpResponseType.Blob:
            return concatMap.call(res$, (res: HttpResponse) => res.blob());
          case HttpResponseType.Json:
            return concatMap.call(res$, (res: HttpResponse) => res.json());
          case HttpResponseType.Text:
            return concatMap.call(res$, (res: HttpResponse) => res.text());
          default:
            // Cast to any to trick Typescript into thinking that this case is possible.
            const responseType = req.responseType as any;
            throw new Error(`Unreachable: unhandled response type ${HttpResponseType[responseType]}`);
        }
      case HttpObserve.Response:
        return res$;
      default:
        throw new Error(`Unreachable: unhandled observe type ${HttpObserve[options.observe]}`);
    }
  }

  delete(url: string, body: HttpBody, options: _HttpMethodOptionsObserveEvents): Observable<HttpEvent>;
  delete(url: string, body: HttpBody, options: _HttpMethodOptionsObserveResponse): Observable<HttpResponse>;
  delete(url: string, body: HttpBody, options: _HttpMethodOptionsArrayObserveBufferBody): Observable<ArrayBuffer>;
  delete(url: string, body: HttpBody, options: _HttpMethodOptionsObserveBlobBody): Observable<Blob>;
  delete(url: string, body: HttpBody, options: _HttpMethodOptionsObserveTextBody): Observable<string>;
  delete(url: string, body: HttpBody, options?: HttpMethodOptions): Observable<any>;
  delete<T>(url: string, body: HttpBody, options?: HttpMethodOptions): Observable<T>;
  delete<T>(url: string, body: HttpBody, options: HttpMethodOptions = {}): Observable<T> {
    return this.request<any>(url, HttpMethod.Delete, addBody(options, body));
  }

  get(url: string, options: _HttpMethodOptionsArrayObserveBufferBody): Observable<ArrayBuffer>;
  get(url: string, options: _HttpMethodOptionsObserveBlobBody): Observable<Blob>;
  get(url: string, options: _HttpMethodOptionsObserveEvents): Observable<HttpEvent>;
  get(url: string, options: _HttpMethodOptionsObserveTextBody): Observable<string>;
  get(url: string, options: _HttpMethodOptionsObserveResponse): Observable<HttpResponse>;
  get(url: string, options?: HttpMethodOptions): Observable<any>;
  get<T>(url: string, options?: HttpMethodOptions): Observable<T>;
  get<T>(url: string, options?: HttpMethodOptions): Observable<T> {
    return this.request<any>(url, HttpMethod.Get, options);
  }

  head(url: string, options: _HttpMethodOptionsArrayObserveBufferBody): Observable<ArrayBuffer>;
  head(url: string, options: _HttpMethodOptionsObserveBlobBody): Observable<Blob>;
  head(url: string, options: _HttpMethodOptionsObserveEvents): Observable<HttpEvent>;
  head(url: string, options: _HttpMethodOptionsObserveTextBody): Observable<string>;
  head(url: string, options: _HttpMethodOptionsObserveResponse): Observable<HttpResponse>;
  head(url: string, options?: HttpMethodOptions): Observable<any>;
  head<T>(url: string, options?: HttpMethodOptions): Observable<T>;
  head<T>(url: string, options?: HttpMethodOptions): Observable<T> {
    return this.request<any>(url, HttpMethod.Head, options);
  }

  jsonp(url: string): Observable<any>;
  jsonp<T>(url: string): Observable<T>;
  jsonp<T>(url: string): Observable<T> {
    return this.request<any>(url, HttpMethod.Jsonp, {
      observe: HttpObserve.Body,
      responseType: HttpResponseType.Json,
    });
  }

  options(url: string, options: _HttpMethodOptionsArrayObserveBufferBody): Observable<ArrayBuffer>;
  options(url: string, options: _HttpMethodOptionsObserveBlobBody): Observable<Blob>;
  options(url: string, options: _HttpMethodOptionsObserveEvents): Observable<HttpEvent>;
  options(url: string, options: _HttpMethodOptionsObserveTextBody): Observable<string>;
  options(url: string, options: _HttpMethodOptionsObserveResponse): Observable<HttpResponse>;
  options(url: string, options?: HttpMethodOptions): Observable<any>;
  options<T>(url: string, options?: HttpMethodOptions): Observable<T>;
  options<T>(url: string, options?: HttpMethodOptions): Observable<T> {
    return this.request<any>(url, HttpMethod.Options, options);
  }

  patch(url: string, body: HttpBody, options: _HttpMethodOptionsArrayObserveBufferBody): Observable<ArrayBuffer>;
  patch(url: string, body: HttpBody, options: _HttpMethodOptionsObserveBlobBody): Observable<Blob>;
  patch(url: string, body: HttpBody, options: _HttpMethodOptionsObserveEvents): Observable<HttpEvent>;
  patch(url: string, body: HttpBody, options: _HttpMethodOptionsObserveTextBody): Observable<string>;
  patch(url: string, body: HttpBody, options: _HttpMethodOptionsObserveResponse): Observable<HttpResponse>;
  patch(url: string, body: HttpBody, options?: HttpMethodOptions): Observable<any>;
  patch<T>(url: string, body: HttpBody, options?: HttpMethodOptions): Observable<T>;
  patch<T>(url: string, body: HttpBody, options: HttpMethodOptions = {}): Observable<T> {
    return this.request<any>(url, HttpMethod.Patch, addBody(options, body));
  }

  post(url: string, body: HttpBody, options: _HttpMethodOptionsArrayObserveBufferBody): Observable<ArrayBuffer>;
  post(url: string, body: HttpBody, options: _HttpMethodOptionsObserveBlobBody): Observable<Blob>;
  post(url: string, body: HttpBody, options: _HttpMethodOptionsObserveEvents): Observable<HttpEvent>;
  post(url: string, body: HttpBody, options: _HttpMethodOptionsObserveTextBody): Observable<string>;
  post(url: string, body: HttpBody, options: _HttpMethodOptionsObserveResponse): Observable<HttpResponse>;
  post(url: string, body: HttpBody, options?: HttpMethodOptions): Observable<any>;
  post<T>(url: string, body: HttpBody, options?: HttpMethodOptions): Observable<T>;
  post<T>(url: string, body: HttpBody, options: HttpMethodOptions = {}): Observable<T> {
    return this.request<any>(url, HttpMethod.Post, addBody(options, body));
  }

  put(url: string, body: HttpBody, options: _HttpMethodOptionsArrayObserveBufferBody): Observable<ArrayBuffer>;
  put(url: string, body: HttpBody, options: _HttpMethodOptionsObserveBlobBody): Observable<Blob>;
  put(url: string, body: HttpBody, options: _HttpMethodOptionsObserveEvents): Observable<HttpEvent>;
  put(url: string, body: HttpBody, options: _HttpMethodOptionsObserveTextBody): Observable<string>;
  put(url: string, body: HttpBody, options: _HttpMethodOptionsObserveResponse): Observable<HttpResponse>;
  put(url: string, body: HttpBody, options?: HttpMethodOptions): Observable<any>;
  put<T>(url: string, body: HttpBody, options?: HttpMethodOptions): Observable<T>;
  put<T>(url: string, body: HttpBody, options: HttpMethodOptions = {}): Observable<T> {
    return this.request<any>(url, HttpMethod.Put, addBody(options, body));
  }
}

let client = new HttpClient(null);

let res = client.get('http://some/url', {observe: HttpObserve.Events, responseType: HttpResponseType.Text});
