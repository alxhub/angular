import {bootstrap} from 'angular2/bootstrap';

// #docregion with
import {CORE_DIRECTIVES, Component} from 'angular2/angular2';
@Component({
  selector: 'with-component',
  template: `<p *ng-if="true">NgIf is used without being explicitly specified here.</p>`,
  directives: [CORE_DIRECTIVES]
})
export class WithComponent {}
// #enddocregion
