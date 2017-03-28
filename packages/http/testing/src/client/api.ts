import {Observable} from 'rxjs/Observable';

import {HttpBody, HttpMethod, HttpRequest} from '../../../src/client/request';

export interface HeaderMap {
  [name: string]: string|string[]|boolean;
}

export interface ParamsMap {
  [name: string]: string|boolean;
}

export interface MockBackendConfig {
  answer(urlPattern: string, args?: MockBackendAnswerArgs): MockBackendAnswer;
  verify(): void;

  push(): void;
  pop(): void;
}

export type MockBackendPredicate<T> = (value: T) => boolean;
export type MockBackendAsyncTransform<T, U> = (value: T) => U|Promise<U>;

export interface MockBackendAnswerArgs {
  headers?: HeaderMap;
  method?: HttpMethod|string|HttpMethod[]|string[];
  params?: ParamsMap;
  predicate?: MockBackendPredicate<HttpRequest>;
}

export interface MockBackendAnswer extends MockBackendAnswerWith {
  manually(args: MockBackendAnswerWithArgs): Observable<any>;
  with(args: MockBackendAnswerWithArgs): MockBackendAnswerWith;
  withBody(body: HttpBody): MockBackendAnswerWith;
  withStatus(status: number): MockBackendAnswerWith;
  withSuccess(): MockBackendAnswerWith;
}

export interface MockBackendAnswerWithArgs {
  atLeast?: number;
  atMost?: number;
  body?: HttpBody|null;
  expect?: MockBackendAnswerWithArgsExpect;
  times?: number;
  status?: number;
}

export interface MockBackendAnswerWithArgsExpect {
  headers?: HeaderMap;
  method?: HttpMethod|string|HttpMethod[]|string[];
  matches?: MockBackendPredicate<HttpRequest>;
}

export interface MockBackendAnswerWith {
  thenWith(args: MockBackendAnswerWithArgs): MockBackendAnswerWith;
  thenWithBody(body: HttpBody): MockBackendAnswerWith;
  thenWithStatus(status: number): MockBackendAnswerWith;
  thenWithSuccess(): MockBackendAnswerWith;
  signals(): Promise<any>[];
}
