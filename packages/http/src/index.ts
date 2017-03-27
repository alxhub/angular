/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

// Old API surface:
export {JSONPBackend, JSONPConnection} from './backends/jsonp_backend';
export {CookieXSRFStrategy, XHRBackend, XHRConnection} from './backends/xhr_backend';
export {BaseRequestOptions, RequestOptions} from './base_request_options';
export {BaseResponseOptions, ResponseOptions} from './base_response_options';
export {ReadyState, RequestMethod, ResponseContentType, ResponseType} from './enums';
export {Http, Jsonp} from './http';
export {HttpModule, JsonpModule} from './http_module';
export {Connection, ConnectionBackend, RequestOptionsArgs, ResponseOptionsArgs, XSRFStrategy} from './interfaces';
export {Headers, URLSearchParams} from './legacy';
export {Request} from './static_request';
export {Response} from './static_response';
export {VERSION} from './version';

// Client API surface:
export {HttpBackend, HttpHandler} from './client/backend';
export {HttpClient} from './client/client';
export {HttpHeaders} from './client/headers';
export {HTTP_INTERCEPTORS, HttpInterceptor} from './client/interceptor';
export {JSONP_ERR_NO_CALLBACK, JSONP_ERR_WRONG_METHOD, JSONP_ERR_WRONG_RESPONSE_TYPE, JsonpAdapter, JsonpClientBackend, JsonpInterceptor} from './client/jsonp';
export {HttpClientJsonpModule, HttpClientModule} from './client/module';
export {HttpBody, HttpBodyMethod, HttpNoBodyMethod, HttpMethod, HttpRequest, HttpRequestClone, HttpRequestInit, HttpResponseType, HttpSerializedBody} from './client/request';
export {HttpEvent, HttpEventType, HttpHeaderResponse, HttpProgressEvent, HttpResponse, HttpResponseHeaderInit, HttpResponseInit, HttpUnknownEvent} from './client/response';
export {HttpUrlParams, QueryEncoder} from './client/url_params';
export {BrowserXhr, HttpXhrBackend, XhrFactory} from './client/xhr';
