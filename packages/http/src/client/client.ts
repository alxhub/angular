import {Injectable} from '@angular/core';
import {Observable} from 'rxjs/Observable';
import {concatMap} from 'rxjs/operator/concatMap';

import {HttpHeaders} from '../headers';
import {HttpUrlParams} from '../url_search_params';

import {HttpHandler} from './backend';
import {HttpBody, HttpMethod, HttpRequest, HttpResponseType} from './request';
import {HttpResponse} from './response';

export interface HttpMethodOptions {
  headers?: HttpHeaders;
  responseType?: HttpResponseType;
  withCredentials?: boolean;
}
export interface HttpMethodOptionsWithArrayBufferBody extends HttpMethodOptions {
  responseType: HttpResponseType.ArrayBuffer;
}
export interface HttpMethodOptionsWithBlobBody extends HttpMethodOptions {
  responseType: HttpResponseType.Blob;
}
export interface HttpMethodOptionsWithTextBody extends HttpMethodOptions {
  responseType: HttpResponseType.Text;
}
export interface HttpMethodOptionsWithJsonBody extends HttpMethodOptions {
  responseType?: HttpResponseType.Json;
}
export interface HttpMethodOptionsWithUnparsedBody extends HttpMethodOptions {
  responseType: HttpResponseType.Unparsed;
}

export interface HttpRequestOptions extends HttpMethodOptions {
  body?: HttpBody|null;
}
export interface HttpRequestOptionsWithArrayBufferBody extends HttpRequestOptions {
  responseType: HttpResponseType.ArrayBuffer;
}
export interface HttpRequestOptionsWithBlobBody extends HttpRequestOptions {
  responseType: HttpResponseType.Blob;
}
export interface HttpRequestOptionsWithTextBody extends HttpRequestOptions {
  responseType: HttpResponseType.Text;
}
export interface HttpRequestOptionsWithJsonBody extends HttpRequestOptions {
  responseType?: HttpResponseType.Json;
}
export interface HttpRequestOptionsWithUnparsedBody extends HttpRequestOptions {
  responseType: HttpResponseType.Unparsed;
}

@Injectable()
export class HttpClient {
  constructor(private handler: HttpHandler) {}

  request(req: HttpRequest): Observable<HttpResponse>;
  request(url: string, method: HttpMethod|string, options: HttpRequestOptionsWithArrayBufferBody): Observable<ArrayBuffer>;
  request(url: string, method: HttpMethod|string, options: HttpRequestOptionsWithBlobBody): Observable<Blob>;
  request(url: string, method: HttpMethod|string, options: HttpRequestOptionsWithTextBody): Observable<string>;
  request(url: string, method: HttpMethod|string, options: HttpRequestOptionsWithUnparsedBody): Observable<HttpResponse>;
  request(url: string, method: HttpMethod|string, options?: HttpRequestOptionsWithJsonBody): Observable<any>;
  request<T>(url: string, method: HttpMethod|string, options?: HttpRequestOptionsWithJsonBody): Observable<T>;
  request<T>(url: string, method: HttpMethod|string, options?: HttpRequestOptions): Observable<T>;
  request(first: string|HttpRequest, method?: HttpMethod|string, options?: HttpRequestOptions): Observable<any> {
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
    const res$ = this.handler.handle(req);
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
        return res$;
    }
  }

  get(url: string, options: HttpMethodOptionsWithArrayBufferBody): Observable<ArrayBuffer>;
  get(url: string, options: HttpMethodOptionsWithBlobBody): Observable<Blob>;
  get(url: string, options: HttpMethodOptionsWithTextBody): Observable<string>;
  get(url: string, options?: HttpMethodOptionsWithUnparsedBody): Observable<HttpResponse>;
  get(url: string, options?: HttpMethodOptionsWithJsonBody): Observable<any>;
  get<T>(url: string, options?: HttpMethodOptionsWithJsonBody): Observable<T>;
  get<T>(url: string, options?: HttpMethodOptions): Observable<T>;
  get<T>(url: string, options?: HttpMethodOptions): Observable<T> {
    return this.request<any>(url, HttpMethod.Get, options);
  }

  post(url: string, body: HttpBody, options: HttpMethodOptionsWithArrayBufferBody): Observable<ArrayBuffer>;
  post(url: string, body: HttpBody, options: HttpMethodOptionsWithBlobBody): Observable<Blob>;
  post(url: string, body: HttpBody, options: HttpMethodOptionsWithTextBody): Observable<string>;
  post(url: string, body: HttpBody, options?: HttpMethodOptionsWithUnparsedBody): Observable<HttpResponse>;
  post(url: string, body: HttpBody, options?: HttpMethodOptionsWithJsonBody): Observable<any>;
  post<T>(url: string, body: HttpBody, options?: HttpMethodOptionsWithJsonBody): Observable<T>;
  post<T>(url: string, body: HttpBody, options: HttpMethodOptions = {}): Observable<T> {
    return this.request<any>(url, HttpMethod.Post, {
      body,
      headers: options.headers,
      responseType: options.responseType,
    });
  }

  delete(url: string, options: HttpMethodOptionsWithArrayBufferBody): Observable<ArrayBuffer>;
  delete(url: string, options: HttpMethodOptionsWithBlobBody): Observable<Blob>;
  delete(url: string, options: HttpMethodOptionsWithTextBody): Observable<string>;
  delete(url: string, options: HttpMethodOptionsWithUnparsedBody): Observable<HttpResponse>;
  delete(url: string, options?: HttpMethodOptionsWithJsonBody): Observable<any>;
  delete<T>(url: string, options?: HttpMethodOptionsWithJsonBody): Observable<T>;
  delete<T>(url: string, options: HttpMethodOptions = {}): Observable<T> {
    return this.request<any>(url, HttpMethod.Post, options);
  }
}
