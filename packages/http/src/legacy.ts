import {HttpHeaders} from './client/headers';
import {HttpUrlParams} from './client/url_params';

/**
 * @deprecated use HttpHeaders instead
 */
export type Headers = HttpHeaders;

/**
 * @deprecated use HttpHeaders instead
 */
export const Headers = HttpHeaders;

export type URLSearchParams = HttpUrlParams;
export const URLSearchParams = HttpUrlParams;
