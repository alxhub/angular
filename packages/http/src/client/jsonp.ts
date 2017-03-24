import {Injectable} from '@angular/core';
import {Observable} from 'rxjs/Observable';
import {Observer} from 'rxjs/Observer';

import {HttpBackend, HttpHandler} from './backend';
import {HttpInterceptor} from './interceptor';
import {HttpMethod, HttpRequest} from './request';
import {HttpResponse} from './response';

let nextRequestId: number = 0;
const JSONP_HOME = '__ng__jsonp__';

export const JSONP_ERR_NO_CALLBACK = 'JSONP injected script did not invoke callback.';
export const JSONP_ERR_WRONG_METHOD = 'JSONP requests must use JSONP request method.';

@Injectable()
export class JsonpAdapter {
  private callbackMap: {[key: string]: Function} = {};

  constructor() {
    if (window) {
      if (!(window as any)[JSONP_HOME]) {
        (window as any)[JSONP_HOME] = {};
      }
      this.callbackMap = (window as any)[JSONP_HOME];
    }
  }

  createScript(): HTMLScriptElement {
    return document.createElement('script');
  }

  get body(): HTMLBodyElement {
    return document.body as HTMLBodyElement;
  }

  allocateCallback(): string {
    return `ng_jsonp_callback_${nextRequestId++}`;
  }

  setCallback(callback: string, fn: Function): void {
    this.callbackMap[callback] = fn;
  }

  clearCallback(callback: string): void {
    delete this.callbackMap[callback];
  }
}

@Injectable()
export class JsonpClientBackend implements HttpBackend {
  constructor(private adapter: JsonpAdapter) {}

  handle(req: HttpRequest): Observable<HttpResponse> {
    if (req.verb !== 'JSONP') {
      throw new Error(JSONP_ERR_WRONG_METHOD);
    }
    return new Observable<HttpResponse>((observer: Observer<HttpResponse>) => {
      const callback = this.adapter.allocateCallback();
      const url = req.url.replace(/=JSONP_CALLBACK(&|$)/, `=${callback}$1`);
      const node = this.adapter.createScript();
      node.src = url;

      let body: any = null;
      let finished: boolean = false;
      let cancelled: boolean = false;

      this.adapter.setCallback(callback, (data?: any) => {
        this.adapter.clearCallback(callback);
        if (cancelled) {
          return;
        }
        body = data;
        finished = true;
      });

      const cleanup = () => {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
        this.adapter.clearCallback(callback);
      };

      const onLoad = (event: Event) => {
        if (cancelled) {
          return;
        }
        cleanup();

        if (!finished) {
          observer.error(new HttpResponse({
            url,
            status: 502,
            body: JSONP_ERR_NO_CALLBACK,
          }));
          return;
        }

        observer.next(new HttpResponse({
          body,
          status: 200,
          statusText: 'OK',
          url,
        }));
        observer.complete();
      };
      
      const onError: any = (err: Error) => {
        if (cancelled) {
          return;
        }
        cleanup();

        observer.error(new HttpResponse({
          body: err,
          status: 502,
          url,
        }));
      };

      node.addEventListener('load', onLoad);
      node.addEventListener('error', onError);
      this.adapter.body.appendChild(node);

      return () => {
        cancelled = true;
        node.removeEventListener('load', onLoad);
        node.removeEventListener('error', onError);
        cleanup();
      };
    });
  }
}

@Injectable()
export class JsonpInterceptor {
  constructor(private jsonp: JsonpClientBackend) {}

  intercept(req: HttpRequest, next: HttpHandler): Observable<HttpResponse> {
    if (req.verb === 'JSONP') {
      return this.jsonp.handle(req);
    }
    return next.handle(req);
  }
}
