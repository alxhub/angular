import {RequestMethod, ResponseContentType} from './enums';
import {HttpHeaders} from './headers';
import {Request} from './static_request';
import {Response} from './static_response';
import {HttpUrlParams} from './url_search_params';


export type HttpBody = ArrayBuffer | Blob | FormData | Object | HttpUrlParams | number | string;
export type HttpMethod = 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT' | string;

export interface HttpRequestInit {
  headers?: HttpHeaders;
  withCredentials?: boolean;
  body?: HttpBody|null;
  method?: RequestMethod|string;
  responsesTypeHint?: ResponseContentType;
}

export class HttpRequest {

  /**
   * @internal
   */
  body: HttpBody|null;

  headers: HttpHeaders;
  method: RequestMethod|string;
  responseTypeHint: ResponseContentType|null;
  url: string;
  withCredentials: boolean;

  constructor(url: string, init?: HttpRequestInit) {
    this.url = url;
    this.headers = init.headers || new HttpHeaders();
    this.method = init.method || 'GET';
    this.withCredentials = !!init.withCredentials;
    this.responseTypeHint = init.responsesTypeHint || null;
  }

  /**
   * @internal
   */
   toRequest(): Request {
     return null;
   }

   /**
    * @internal
    */
   static fromRequest(req: Request): HttpRequest {
    return new HttpRequest(req.url, {
      body: req._body,
      headers: req.headers,
      method: !req.customMethod ? req.method : req.customMethod,
      responsesTypeHint: req.responseType,
      withCredentials: req.withCredentials,
    });
   }
}

export class HttpResponse {
  
  /**
   * @internal
   */
  toResponse(): Response {
    return null;
  }
}
