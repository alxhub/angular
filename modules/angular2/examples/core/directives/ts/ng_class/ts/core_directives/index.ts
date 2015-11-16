import {Component} from 'angular2/angular2';
import {bootstrap} from 'angular2/bootstrap';

import {WithComponent} from './with';
import {WithoutComponent} from './without';

@Component({
  selector: 'app-component',
  directives: [WithComponent, WithoutComponent],
  template: `
<h2>Without CORE_DIRECTIVES:</h2>
<without-component></without-component>
<h2>With CORE_DIRECTIVES:</h2>
<with-component></with-component>
`
})
export class MyAppComponent {}

bootstrap(MyAppComponent);