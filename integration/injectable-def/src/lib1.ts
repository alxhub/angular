import {Injectable, NgModule, forwardRef} from '@angular/core';

@NgModule({
  //providers: [forwardRef(() => Service)],
})
export class Lib1Module {}

@Injectable(
  {scope: Lib1Module}
)
export class Service {
  static instance = 0;
  readonly instance = Service.instance++;
}
