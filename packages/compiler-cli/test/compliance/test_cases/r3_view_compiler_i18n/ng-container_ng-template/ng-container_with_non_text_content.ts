import {Component, NgModule} from '@angular/core';

@Component({
  selector: 'my-component',
  template: `
  <div i18n>
    Hello <ng-container>there <strong>{{ name }} {{name }}</strong></ng-container>
  </div>
`,
})
export class MyComponent {
  name = 'Alex';
}

@NgModule({declarations: [MyComponent]})
export class MyModule {
}