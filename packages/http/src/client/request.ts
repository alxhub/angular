import {HttpHeaders} from './headers';
import {HttpUrlParams} from './http_url_params';

export type HttpBody = ArrayBuffer | Blob | FormData | Object | HttpUrlParams | number | string;
export type HttpSerializedBody = ArrayBuffer | Blob | FormData | string;

export enum HttpResponseType {
  ArrayBuffer,
  Blob,
  Json,
  Request,
  Text,
  Unparsed,
}

export enum HttpMethod {
  Delete,
  Get,
  Head,
  Jsonp,
  Options,
  Post,
  Put,
  Patch,
}

export type HttpNoBodyMethod = HttpMethod.Delete | HttpMethod.Get | HttpMethod.Head | HttpMethod.Jsonp | HttpMethod.Options;
export type HttpBodyMethod = HttpMethod.Post | HttpMethod.Put | HttpMethod.Patch;

export interface HttpRequestInit {
  headers?: HttpHeaders;
  withCredentials?: boolean;
  responseType?: HttpResponseType;
}

function mightHaveBody(method: HttpMethod): boolean {
  switch (method) {
    case HttpMethod.Delete:
    case HttpMethod.Get:
    case HttpMethod.Head:
    case HttpMethod.Options:
    case HttpMethod.Jsonp:
      return false;
    default:
      return true;
  }
}

export class HttpRequest {
  body: HttpBody|null = null;
  headers: HttpHeaders;
  withCredentials: boolean = false;
  responseType: HttpResponseType = HttpResponseType.Json;

  constructor(url: string, method: HttpNoBodyMethod, init?: HttpRequestInit);
  constructor(url: string, method: HttpBodyMethod, body: HttpBody|null, init?: HttpRequestInit);
  constructor(url: string, method: HttpMethod|string, body: HttpBody|null, init?: HttpRequestInit);
  constructor(public url: string, public method: HttpMethod | string, third?: HttpBody|HttpRequestInit|null, fourth?: HttpRequestInit) {
    let options: HttpRequestInit|undefined;
    if (typeof method === 'string' || mightHaveBody(method)) {
      this.body = third;
      options = fourth;
    } else {
      options = third;
    }
    if (options) {
      this.withCredentials = !!options.withCredentials;
      if (!!options.responseType) {
        this.responseType = options.responseType;
      }
      if (!!options.headers) {
        this.headers = options.headers;
      }
    }
    if (!this.headers) {
      this.headers = new HttpHeaders();
    }
  }

  get verb(): string {
    return typeof this.method === 'string'
        ? this.method.toUpperCase()
        : HttpMethod[this.method].toUpperCase();
  }


  serializeBody(): HttpSerializedBody|null {
    if (this.body === null) {
      return null;
    }
    if (this.body instanceof ArrayBuffer || (Blob && this.body instanceof Blob) || (FormData && this.body instanceof FormData) || typeof this.body === 'string') {
      return this.body;
    }
    if (typeof this.body === 'object') {
      return JSON.stringify(this.body, null, 2);
    }
    return this.body.toString();
  }

  detectContentTypeHeader(): string|null {
    if (this.body === null) {
      return null;
    } else if (FormData && this.body instanceof FormData) {
      return 'application/x-www-form-urlencoded;charset=UTF-8';
    } else if (Blob && this.body instanceof Blob) {
      if (this.body.type) {
        return this.body.type;
      }
    } else if (this.body instanceof ArrayBuffer) {
      return null;
    } else if (typeof this.body === 'string') {
      return 'text/plain';
    } else if (typeof this.body === 'object' || typeof this.body === 'number') {
      return 'application/json';
    }
    return null;
  }
}
