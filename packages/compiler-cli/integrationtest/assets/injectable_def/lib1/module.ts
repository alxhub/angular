import {Injectable, NgModule} from '@angular/core';

@NgModule({})
export class Lib1Module {}

@Injectable({
  scope: Lib1Module,
})
export class Service {
  static instanceCount = 0;
  instance = Service.instanceCount++;
}
