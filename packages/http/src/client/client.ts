import {Observable} from 'rxjs/Observable';

import {HttpHeaders} from '../headers';
import {HttpUrlParams} from '../url_search_params';

import {HttpRequest} from './request';
import {HttpResponse} from './response';

export enum HttpResponseType {
  ARRAY_BUFFER,
  BLOB,
  JSON,
  TEXT,
  UNPARSED,
}

export enum HttpMethod {
  DELETE,
  GET,
  HEAD,
  OPTIONS,
  POST,
  PUT,
  PATCH,
}

export type HttpBody = ArrayBuffer | Blob | FormData | Object | string | number;

export interface HttpMethodOptions {
  headers?: HttpHeaders;
  responseType?: HttpResponseType;
}
export interface HttpMethodOptionsWithArrayBufferBody extends HttpMethodOptions {
  responseType: HttpResponseType.ARRAY_BUFFER;
}
export interface HttpMethodOptionsWithBlobBody extends HttpMethodOptions {
  responseType: HttpResponseType.BLOB;
}
export interface HttpMethodOptionsWithTextBody extends HttpMethodOptions {
  responseType: HttpResponseType.TEXT;
}
export interface HttpMethodOptionsWithJsonBody extends HttpMethodOptions {
  responseType?: HttpResponseType.JSON;
}
export interface HttpMethodOptionsWithUnparsedBody extends HttpMethodOptions {
  responseType: HttpResponseType.UNPARSED;
}


export interface HttpRequestOptions extends HttpMethodOptions {
  body?: HttpBody|null;
}
export interface HttpRequestOptionsWithArrayBufferBody extends HttpRequestOptions {
  responseType: HttpResponseType.ARRAY_BUFFER;
}
export interface HttpRequestOptionsWithBlobBody extends HttpRequestOptions {
  responseType: HttpResponseType.BLOB;
}
export interface HttpRequestOptionsWithTextBody extends HttpRequestOptions {
  responseType: HttpResponseType.TEXT;
}
export interface HttpRequestOptionsWithJsonBody extends HttpRequestOptions {
  responseType?: HttpResponseType.JSON;
}
export interface HttpRequestOptionsWithUnparsedBody extends HttpRequestOptions {
  responseType: HttpResponseType.UNPARSED;
}



/*
export interface HttpMethodOptionsWithArrayBufferBody extends HttpMethodOptions {
  responseType: HttpResponseType.
}
*/

export class HttpClient {
  request(url: string, method: HttpMethod|string, options: HttpRequestOptionsWithArrayBufferBody): Observable<ArrayBuffer>;
  request(url: string, method: HttpMethod|string, options: HttpRequestOptionsWithBlobBody): Observable<Blob>;
  request(url: string, method: HttpMethod|string, options: HttpRequestOptionsWithTextBody): Observable<string>;
  request(url: string, method: HttpMethod|string, options: HttpRequestOptionsWithUnparsedBody): Observable<HttpResponse>;
  request(url: string, method: HttpMethod|string, options?: HttpRequestOptionsWithJsonBody): Observable<any>;
  request<T>(url: string, method: HttpMethod|string, options?: HttpRequestOptionsWithJsonBody): Observable<T>;
  request<T>(url: string, method: HttpMethod|string, options?: HttpRequestOptions): Observable<T>;
  request<T>(url: string, method: HttpMethod|string, options?: HttpRequestOptions): Observable<T> {
    return null;
  }

  get(url: string, options: HttpMethodOptionsWithArrayBufferBody): Observable<ArrayBuffer>;
  get(url: string, options: HttpMethodOptionsWithBlobBody): Observable<Blob>;
  get(url: string, options: HttpMethodOptionsWithTextBody): Observable<string>;
  get(url: string, options?: HttpMethodOptionsWithUnparsedBody): Observable<HttpResponse>;
  get(url: string, options?: HttpMethodOptionsWithJsonBody): Observable<any>;
  get<T>(url: string, options?: HttpMethodOptionsWithJsonBody): Observable<T>;
  get<T>(url: string, options?: HttpMethodOptions): Observable<T>;
  get<T>(url: string, options?: HttpMethodOptions): Observable<T> {
    return this.request<any>(url, HttpMethod.GET, options);
  }

  post(url: string, body: HttpBody, options: HttpMethodOptionsWithArrayBufferBody): Observable<ArrayBuffer>;
  post(url: string, body: HttpBody, options: HttpMethodOptionsWithBlobBody): Observable<Blob>;
  post(url: string, body: HttpBody, options: HttpMethodOptionsWithTextBody): Observable<string>;
  post(url: string, body: HttpBody, options?: HttpMethodOptionsWithUnparsedBody): Observable<HttpResponse>;
  post(url: string, body: HttpBody, options?: HttpMethodOptionsWithJsonBody): Observable<any>;
  post<T>(url: string, body: HttpBody, options?: HttpMethodOptionsWithJsonBody): Observable<T>;
  post<T>(url: string, body: HttpBody, options: HttpMethodOptions = {}): Observable<T> {
    return this.request<any>(url, HttpMethod.POST, {
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
    return this.request<any>(url, HttpMethod.POST, options);
  }
}
