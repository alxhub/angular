import {ddescribe, describe, it} from '@angular/core/testing/src/testing_internal';
import {HttpHeaders} from '../../src/client/headers';
import {HttpMethod, HttpRequest, HttpResponseType} from '../../src/client/request';

const TEST_URL = 'http://angular.io';
const TEST_STRING = `I'm a body!`;

export function main() {
  ddescribe('HttpRequest', () => {
    describe('constructor', () => {
      it('initializes url', () => {
        const req = new HttpRequest(TEST_URL, '', null);
        expect(req.url).toBe(TEST_URL);
      });
      it('doesn\'t require a body for body-less methods', () => {
        let req = new HttpRequest(TEST_URL, HttpMethod.Get);
        expect(req.method).toBe(HttpMethod.Get);
        expect(req.body).toBeNull();
        req = new HttpRequest(TEST_URL, HttpMethod.Head);
        expect(req.method).toBe(HttpMethod.Head);
        expect(req.body).toBeNull();
        req = new HttpRequest(TEST_URL, HttpMethod.Jsonp);
        expect(req.method).toBe(HttpMethod.Jsonp);
        expect(req.body).toBeNull();
        req = new HttpRequest(TEST_URL, HttpMethod.Options);
        expect(req.method).toBe(HttpMethod.Options);
        expect(req.body).toBeNull();
      });
      it('accepts a string request method', () => {
        const req = new HttpRequest(TEST_URL, 'TEST', null);
        expect(req.method).toBe('TEST');
      });
      it('accepts a string body', () => {
        const req = new HttpRequest(TEST_URL, HttpMethod.Post, TEST_STRING);
        expect(req.body).toBe(TEST_STRING);
      });
      it('accepts an object body', () => {
        const req = new HttpRequest(TEST_URL, HttpMethod.Post, {data: TEST_STRING});
        expect(req.body).toEqual({data: TEST_STRING});
      });
      it('creates default headers if not passed', () => {
        const req = new HttpRequest(TEST_URL, HttpMethod.Get);
        expect(req.headers instanceof HttpHeaders).toBeTruthy();
      });
      it('uses the provided headers if passed', () => {
        const headers = new HttpHeaders();
        const req = new HttpRequest(TEST_URL, HttpMethod.Get, {headers});
        expect(req.headers).toBe(headers);
      });
      it('defaults to Json', () => {
        const req = new HttpRequest(TEST_URL, HttpMethod.Get);
        expect(req.responseType).toBe(HttpResponseType.Json);
      });
    });
  });
}