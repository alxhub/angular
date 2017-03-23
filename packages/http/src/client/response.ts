import {HttpBody} from './request';

import {HttpHeaders} from '../headers';
import {stringToArrayBuffer} from '../http_utils';
import {HttpUrlParams} from '../url_search_params';

export interface HttpResponseInit {
  body?: HttpBody|ErrorEvent;
  headers?: HttpHeaders;
  status?: number;
  statusText?: string;
  url?: string;
}

export class HttpResponse {
  _body: HttpBody|ErrorEvent|null;
  headers: HttpHeaders;
  status: number;
  statusText: string;
  url: string|null;

  constructor(init: HttpResponseInit = {}) {
    this._body = init.body || null;
    this.headers = init.headers || new HttpHeaders();
    this.status = init.status !== undefined ? init.status : 200;
    this.statusText = init.statusText || 'OK';
    this.url = init.url || null;
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
}
