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
export interface HttpBodyMethodOptions extends HttpMethodOptions {
  observe?: HttpObserve.Body;
}
export interface HttpEventsMethodOptions extends HttpMethodOptions {
  observe: HttpObserve.Events;
}
export interface HttpResponseMethodOptions extends HttpMethodOptions {
  observe: HttpObserve.Response;
}
export interface HttpArrayBufferMethodOptions extends HttpBodyMethodOptions {
  responseType: HttpResponseType.ArrayBuffer;
}
export interface HttpBlobMethodOptions extends HttpBodyMethodOptions {
  responseType: HttpResponseType.Blob;
}
export interface HttpJsonMethodOptions extends HttpBodyMethodOptions {
  responseType?: HttpResponseType.Json;
}
export interface HttpTextMethodOptions extends HttpBodyMethodOptions {
  responseType: HttpResponseType.Text;
}

export interface HttpRequestOptions extends HttpMethodOptions {
  body?: HttpBody|null;
}
export interface HttpBodyRequestOptions extends HttpRequestOptions {
  observe?: HttpObserve.Body;
}
export interface HttpEventsRequestOptions extends HttpRequestOptions {
  observe: HttpObserve.Events;
}
export interface HttpResponseRequestOptions extends HttpRequestOptions {
  observe: HttpObserve.Response;
}
export interface HttpArrayBufferRequestOptions extends HttpBodyRequestOptions {
  responseType: HttpResponseType.ArrayBuffer;
}
export interface HttpBlobRequestOptions extends HttpBodyRequestOptions {
  responseType: HttpResponseType.Blob;
}
export interface HttpJsonRequestOptions extends HttpBodyRequestOptions {
  responseType?: HttpResponseType.Json;
}
export interface HttpTextRequestOptions extends HttpBodyRequestOptions {
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
  request(url: string, method: HttpMethod|string, options: HttpArrayBufferRequestOptions): Observable<ArrayBuffer>;
  request(url: string, method: HttpMethod|string, options: HttpBlobRequestOptions): Observable<Blob>;
  request(url: string, method: HttpMethod|string, options: HttpEventsRequestOptions): Observable<HttpEvent>;
  request(url: string, method: HttpMethod|string, options: HttpTextRequestOptions): Observable<string>;
  request(url: string, method: HttpMethod|string, options: HttpResponseRequestOptions): Observable<HttpResponse>;
  request(url: string, method: HttpMethod|string, options?: HttpJsonRequestOptions): Observable<any>;
  request<T>(url: string, method: HttpMethod|string, options?: HttpJsonRequestOptions): Observable<T>;
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

  delete(url: string, body: HttpBody, options: HttpArrayBufferMethodOptions): Observable<ArrayBuffer>;
  delete(url: string, body: HttpBody, options: HttpBlobMethodOptions): Observable<Blob>;
  delete(url: string, body: HttpBody, options: HttpEventsMethodOptions): Observable<HttpEvent>;
  delete(url: string, body: HttpBody, options: HttpTextMethodOptions): Observable<string>;
  delete(url: string, body: HttpBody, options: HttpResponseMethodOptions): Observable<HttpResponse>;
  delete(url: string, body: HttpBody, options?: HttpJsonMethodOptions): Observable<any>;
  delete<T>(url: string, body: HttpBody, options?: HttpJsonMethodOptions): Observable<T>;
  delete<T>(url: string, body: HttpBody, options: HttpMethodOptions = {}): Observable<T> {
    return this.request<any>(url, HttpMethod.Delete, addBody(options, body));
  }

  get(url: string, options: HttpArrayBufferMethodOptions): Observable<ArrayBuffer>;
  get(url: string, options: HttpBlobMethodOptions): Observable<Blob>;
  get(url: string, options: HttpEventsMethodOptions): Observable<HttpEvent>;
  get(url: string, options: HttpTextMethodOptions): Observable<string>;
  get(url: string, options: HttpResponseMethodOptions): Observable<HttpResponse>;
  get(url: string, options?: HttpJsonMethodOptions): Observable<any>;
  get<T>(url: string, options?: HttpJsonMethodOptions): Observable<T>;
  get<T>(url: string, options?: HttpMethodOptions): Observable<T> {
    return this.request<any>(url, HttpMethod.Get, options);
  }

  head(url: string, options: HttpArrayBufferMethodOptions): Observable<ArrayBuffer>;
  head(url: string, options: HttpBlobMethodOptions): Observable<Blob>;
  head(url: string, options: HttpEventsMethodOptions): Observable<HttpEvent>;
  head(url: string, options: HttpTextMethodOptions): Observable<string>;
  head(url: string, options: HttpResponseMethodOptions): Observable<HttpResponse>;
  head(url: string, options?: HttpJsonMethodOptions): Observable<any>;
  head<T>(url: string, options?: HttpJsonMethodOptions): Observable<T>;
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

  options(url: string, options: HttpArrayBufferMethodOptions): Observable<ArrayBuffer>;
  options(url: string, options: HttpBlobMethodOptions): Observable<Blob>;
  options(url: string, options: HttpEventsMethodOptions): Observable<HttpEvent>;
  options(url: string, options: HttpTextMethodOptions): Observable<string>;
  options(url: string, options: HttpResponseMethodOptions): Observable<HttpResponse>;
  options(url: string, options?: HttpJsonMethodOptions): Observable<any>;
  options<T>(url: string, options?: HttpJsonMethodOptions): Observable<T>;
  options<T>(url: string, options?: HttpMethodOptions): Observable<T> {
    return this.request<any>(url, HttpMethod.Options, options);
  }

  patch(url: string, body: HttpBody, options: HttpArrayBufferMethodOptions): Observable<ArrayBuffer>;
  patch(url: string, body: HttpBody, options: HttpBlobMethodOptions): Observable<Blob>;
  patch(url: string, body: HttpBody, options: HttpEventsMethodOptions): Observable<HttpEvent>;
  patch(url: string, body: HttpBody, options: HttpTextMethodOptions): Observable<string>;
  patch(url: string, body: HttpBody, options: HttpResponseMethodOptions): Observable<HttpResponse>;
  patch(url: string, body: HttpBody, options?: HttpJsonMethodOptions): Observable<any>;
  patch<T>(url: string, body: HttpBody, options?: HttpJsonMethodOptions): Observable<T>;
  patch<T>(url: string, body: HttpBody, options: HttpMethodOptions = {}): Observable<T> {
    return this.request<any>(url, HttpMethod.Patch, addBody(options, body));
  }

  post(url: string, body: HttpBody, options: HttpArrayBufferMethodOptions): Observable<ArrayBuffer>;
  post(url: string, body: HttpBody, options: HttpBlobMethodOptions): Observable<Blob>;
  post(url: string, body: HttpBody, options: HttpEventsMethodOptions): Observable<HttpEvent>;
  post(url: string, body: HttpBody, options: HttpTextMethodOptions): Observable<string>;
  post(url: string, body: HttpBody, options: HttpResponseMethodOptions): Observable<HttpResponse>;
  post(url: string, body: HttpBody, options?: HttpJsonMethodOptions): Observable<any>;
  post<T>(url: string, body: HttpBody, options?: HttpJsonMethodOptions): Observable<T>;
  post<T>(url: string, body: HttpBody, options: HttpMethodOptions = {}): Observable<T> {
    return this.request<any>(url, HttpMethod.Post, addBody(options, body));
  }

  put(url: string, body: HttpBody, options: HttpArrayBufferMethodOptions): Observable<ArrayBuffer>;
  put(url: string, body: HttpBody, options: HttpBlobMethodOptions): Observable<Blob>;
  put(url: string, body: HttpBody, options: HttpEventsMethodOptions): Observable<HttpEvent>;
  put(url: string, body: HttpBody, options: HttpTextMethodOptions): Observable<string>;
  put(url: string, body: HttpBody, options: HttpResponseMethodOptions): Observable<HttpResponse>;
  put(url: string, body: HttpBody, options?: HttpJsonMethodOptions): Observable<any>;
  put<T>(url: string, body: HttpBody, options?: HttpJsonMethodOptions): Observable<T>;
  put<T>(url: string, body: HttpBody, options: HttpMethodOptions = {}): Observable<T> {
    return this.request<any>(url, HttpMethod.Put, addBody(options, body));
  }
}
