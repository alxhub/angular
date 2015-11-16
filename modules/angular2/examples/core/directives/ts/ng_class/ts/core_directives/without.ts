import {bootstrap} from 'angular2/bootstrap';

// #docregion without
import {NgClass, NgIf, NgFor, NgSwitch, NgSwitchWhen, NgSwitchDefault, Component} from 'angular2/angular2';
@Component({
  selector: 'without-component',
  template: `<p *ng-if="true">NgIf is explicitly specified here.</p>`,
  directives: [NgClass, NgIf, NgFor, NgSwitch, NgSwitchWhen, NgSwitchDefault]
})
export class WithoutComponent {}
// #enddocregion
