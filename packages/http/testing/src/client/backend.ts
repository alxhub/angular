import {Observable} from 'rxjs/Observable';

import {HttpHandler} from '../../../src/client/backend';
import {HttpRequest} from '../../../src/client/request';
import {HttpResponse} from '../../../src/client/response';

export class MockHttpBackend implements HttpHandler {
  handle(req: HttpRequest): Observable<HttpResponse> {
    return null;
  }
}

var x: any;

x
 .answer('/foo/:id')
 .with('response');

let [first, second] = x.answer('/foo/:id').withBody('response').thenWithBody('another').signals();
x.answer('/foo/:id', {method: ['get', 'post']}).withStatus(200)

x.answer('/foo/:id').manually({times: 2}).subscribe((handler: any) => {
  handler.req;
  handler.answer('response');
  handler.error(402, '');
});

x.verify({allowPending: true});
