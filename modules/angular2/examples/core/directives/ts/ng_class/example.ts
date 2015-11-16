import {Component, NgClass} from 'angular2/angular2';
import {bootstrap} from 'angular2/bootstrap';

// #docregion toggle_button
@Component({
  selector: 'toggle-button',
  inputs: ['isDisabled'],
  template: `
     <div class="button" [ng-class]="{active: isOn, disabled: isDisabled}"
         (click)="toggle(!isOn)">
         Click me!
     </div>`,
  styles: [`
    .button {
      width: 120px;
      border: medium solid black;
    }

    .active {
      background-color: red;
   }

    .disabled {
      color: gray;
      border: medium solid gray;
    }
  `],
  directives: [NgClass]
})
class ToggleButton {
  isOn = false;
  isDisabled = false;

  toggle(newState) {
    if (!this.isDisabled) {
      this.isOn = newState;
    }
  }
}
// #enddocregion

@Component({
  selector: 'app-component',
  directives: [ToggleButton],
  template: `<toggle-button></toggle-button>`
})
class AppComponent{}

bootstrap(AppComponent);
