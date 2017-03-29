import {Observable} from 'rxjs/Observable';

import {HttpBody, HttpMethod, HttpRequest} from '../../../src/client/request';

import {
  MockBackendAnswer,
  MockBackendAnswerArgs,
  MockBackendAnswerWith,
  MockBackendAnswerWithArgs,
} from './api';

export class MockRequestEntry implements MockBackendAnswer, MockBackendAnswerWith {
  constructor(urlPattern: string, args?: MockBackendAnswerArgs) {}

  manually(args: MockBackendAnswerWithArgs): Observable<any> {
    return null;
  }

  with(args: MockBackendAnswerWithArgs): MockBackendAnswerWith {
    return this;
  }

  thenWith(args: MockBackendAnswerWithArgs): MockBackendAnswerWith {
    return this.with(args);
  }

  withBody(body: HttpBody): MockBackendAnswerWith {
    return this;
  }

  thenWithBody(body: HttpBody): MockBackendAnswerWith {
    return this.withBody(body);
  }

  withStatus(status: number): MockBackendAnswerWith {
    return this;
  }

  thenWithStatus(status: number): MockBackendAnswerWith {
    return this.withStatus(status);
  }

  withSuccess(): MockBackendAnswerWith {
    return this;
  }

  thenWithSuccess(): MockBackendAnswerWith {
    return this.withSuccess();
  }

  signals(): Promise<any>[] {
    return null;
  }
}
