/** @experimental */
export declare const HTTP_INTERCEPTORS: InjectionToken<HttpInterceptor[]>;

/** @experimental */
export declare abstract class HttpBackend implements HttpHandler {
    abstract handle(req: HttpRequest<any>): Observable<HttpEvent<any>>;
}

/** @experimental */
export declare class HttpClient {
    constructor(handler: HttpHandler);
}

/** @experimental */
export declare class HttpClientJsonpModule {
}

/** @experimental */
export declare class HttpClientModule {
}

/** @experimental */
export interface HttpDownloadProgressEvent extends HttpProgressEvent {
    partialText?: string;
    type: HttpEventType.DownloadProgress;
}

/** @experimental */
export declare class HttpErrorResponse extends HttpResponseBase implements Error {
    error: any | null;
    message: string;
    name: string;
    ok: boolean;
    constructor(init: {
        error?: any;
        headers?: HttpHeaders;
        status?: number;
        statusText?: string;
        url?: string;
    });
}

/** @experimental */
export declare type HttpEvent<T> = HttpSentEvent | HttpHeaderResponse | HttpResponse<T> | HttpProgressEvent | HttpUserEvent<T>;

/** @experimental */
export declare enum HttpEventType {
    Sent = 0,
    UploadProgress = 1,
    ResponseHeader = 2,
    DownloadProgress = 3,
    Response = 4,
    User = 5,
}

/** @experimental */
export declare abstract class HttpHandler {
    abstract handle(req: HttpRequest<any>): Observable<HttpEvent<any>>;
}

/** @experimental */
export declare class HttpHeaderResponse extends HttpResponseBase {
    readonly type: HttpEventType.ResponseHeader;
    constructor(init?: {
        headers?: HttpHeaders;
        status?: number;
        statusText?: string;
        url?: string;
    });
}

/** @experimental */
export declare class HttpHeaders {
    constructor(headers?: string | {
        [name: string]: string | string[];
    });
    append(name: string, value: string | string[]): void;
    delete(name: string, value?: string | string[]): void;
    get(name: string): string | null;
    getAll(name: string): string[] | null;
    has(name: string): boolean;
    keys(): string[];
    set(name: string, value: string | string[]): void;
    clone(): HttpHeaders;
}

/** @experimental */
export interface HttpInterceptor {
    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>>;
}

/** @experimental */
export interface HttpProgressEvent {
    loaded: number;
    total?: number;
    type: HttpEventType.DownloadProgress | HttpEventType.UploadProgress;
}

/** @experimental */
export declare class HttpRequest<T> {
    body: T | null;
    headers: HttpHeaders;
    method: string;
    params: {[param: string]: string|string[]};
    reportProgress: boolean;
    responseType: 'arraybuffer' | 'blob' | 'json' | 'text';
    url: string;
    withCredentials: boolean;

    readonly urlWithParams: string;

    constructor(method: 'DELETE' | 'GET' | 'HEAD' | 'JSONP' | 'OPTIONS', url: string, init?: {
        headers?: HttpHeaders;
        reportProgress?: boolean;
        responseType?: 'arraybuffer' | 'blob' | 'json' | 'text';
        withCredentials?: boolean;
    });
    constructor(method: 'POST' | 'PUT' | 'PATCH', url: string, body: T | null, init?: {
        headers?: HttpHeaders;
        reportProgress?: boolean;
        responseType?: 'arraybuffer' | 'blob' | 'json' | 'text';
        withCredentials?: boolean;
    });
    constructor(method: string, url: string, body: T | null, init?: {
        headers?: HttpHeaders;
        reportProgress?: boolean;
        responseType?: 'arraybuffer' | 'blob' | 'json' | 'text';
        withCredentials?: boolean;
    });
    clone(): HttpRequest<T>;
    detectContentTypeHeader(): string | null;
    serializeBody(): ArrayBuffer | Blob | FormData | string | null;
}

/** @experimental */
export declare class HttpResponse<T> extends HttpResponseBase {
    body: T | null;
    readonly type: HttpEventType.Response;
    constructor(init?: {
        body?: T | null;
        headers?: HttpHeaders;
        status?: number;
        statusText?: string;
        url?: string;
    });
}

/** @experimental */
export declare abstract class HttpResponseBase {
    headers: HttpHeaders;
    ok: boolean;
    status: number;
    statusText: string;
    readonly type: HttpEventType.Response | HttpEventType.ResponseHeader;
    url: string | null;
    constructor(init: {
        headers?: HttpHeaders;
        status?: number;
        statusText?: string;
        url?: string;
    }, defaultStatus?: number, defaultStatusText?: string);
}

/** @experimental */
export interface HttpSentEvent {
    type: HttpEventType.Sent;
}

/** @experimental */
export declare class HttpStandardUrlParameterCodec implements HttpUrlParameterCodec {
    decodeKey(k: string): string;
    decodeValue(v: string): string;
    encodeKey(k: string): string;
    encodeValue(v: string): string;
}

/** @experimental */
export interface HttpUrlParameterCodec {
    decodeKey(key: string): string;
    decodeValue(value: string): string;
    encodeKey(key: string): string;
    encodeValue(value: string): string;
}

/** @experimental */
export interface HttpUserEvent<T> {
    type: HttpEventType.User;
}

/** @experimental */
export declare class HttpXhrBackend implements HttpBackend {
    constructor(xhrFactory: XhrFactory);
    handle(req: HttpRequest<any>): Observable<HttpEvent<any>>;
}

/** @experimental */
export declare class JsonpClientBackend implements HttpBackend {
    constructor(callbackMap: JsonpCallbackContext, document: any);
    handle(req: HttpRequest<never>): Observable<HttpEvent<any>>;
}

/** @experimental */
export declare class JsonpInterceptor {
    constructor(jsonp: JsonpClientBackend);
    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>>;
}

/** @experimental */
export declare abstract class XhrFactory {
    abstract build(): XMLHttpRequest;
}

export interface HttpTypedBody {
    readonly contentType: string;
    serialize(): string | ArrayBuffer | Blob | FormData;
}

export class HttpUrlEncodedBody implements HttpTypedBody {
    params: {[param: string]: string|string[]};
    readonly contentType: 'application/x-www-form-urlencoded;charset=UTF-8';
    serialize(): string;
}