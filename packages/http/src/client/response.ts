import {Observable} from 'rxjs/Observable';
import {empty} from 'rxjs/observable/empty';


import {HttpHeaders} from './headers';
import {stringToArrayBuffer} from '../http_utils';
import {HttpBody} from './request';
import {HttpUrlParams} from './url_params';

export enum HttpEventType {
  Sent,
  UploadProgress,
  ResponseHeader,
  DownloadProgress,
  Response,
}

export class HttpProgressEvent {
  constructor(
    private type: HttpEventType.DownloadProgress | HttpEventType.UploadProgress,
    private loaded: number,
    private total: number
  ) {}
}

export interface HttpUnknownEvent {
  type: HttpEventType;
}

export type HttpEvent = HttpProgressEvent | HttpHeaderResponse | HttpResponse | HttpUnknownEvent;

export interface HttpResponseHeaderInit {
  headers?: HttpHeaders;
  status?: number;
  statusText?: string;
  url?: string;
}

export interface HttpResponseInit extends HttpResponseHeaderInit {
  body?: HttpBody|ErrorEvent;
}

export class HttpHeaderResponse {
  constructor(init: HttpResponseInit = {}) {
    this.headers = init.headers || new HttpHeaders();
    this.status = init.status !== undefined ? init.status : 200;
    this.statusText = init.statusText || 'OK';
    this.url = init.url || null;
  }

  get type(): HttpEventType {
    return HttpEventType.ResponseHeader;
  }

  headers: HttpHeaders;
  status: number;
  statusText: string;
  url: string;
}

export class HttpResponse extends HttpHeaderResponse {
  _body: HttpBody|ErrorEvent|null;

  constructor(init: HttpResponseInit = {}) {
    super(init);
    this._body = init.body || null;
  }

  get type(): HttpEventType {
    return HttpEventType.Response;
  }

  get ok(): boolean {
    return this.status >= 200 && this.status < 300;
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    if (this._body instanceof ArrayBuffer) {
      return Promise.resolve(this._body);
    }
    return this.text().then(stringToArrayBuffer);
  }

  blob(): Promise<Blob> {
    if (this._body instanceof Blob) {
      return Promise.resolve(this._body);
    }
    if (this._body instanceof ArrayBuffer) {
      return Promise.resolve(new Blob([this._body]));
    }
    return Promise.reject(new Error(`The request body isn't either a blob or an array buffer`));
  }

  json(): Promise<any>;
  json<T>(): Promise<T>;
  json<T>(): Promise<T> {
    if (typeof this._body === 'string') {
      return Promise.resolve(JSON.parse(this._body));
    }
    if (this._body instanceof ArrayBuffer) {
      return this.text().then(text => JSON.parse(text));
    }
    return Promise.resolve(this._body);
  }

  text(): Promise<string> {
    if (this._body instanceof HttpUrlParams) {
      return Promise.resolve(this._body.toString());
    }
    if (this._body instanceof ArrayBuffer) {
      return Promise.resolve(String.fromCharCode.apply(null, new Uint16Array(this._body)));
    }
    if (this._body === null) {
      return Promise.resolve('');
    }
    if (typeof this._body === 'object') {
      return Promise.resolve(JSON.stringify(this._body, null, 2));
    }
    return Promise.resolve(this._body.toString());
  }

  clone(update: HttpResponseInit = {}): HttpResponse {
    return new HttpResponse({
      body: (update.body !== undefined) ? update.body : this._body,
      headers: update.headers || this.headers.clone(),
      status: (update.status !== undefined) ? update.status : this.status,
      statusText: update.statusText || this.statusText,
      url: update.url || this.url,
    });
  }
}
