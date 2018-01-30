import {Injectable} from '@angular/core';
import {ServiceModule} from './module';

@Injectable({
  scope: ServiceModule,
})
export class Service {
  static instances = 0;
  readonly instance: number;

  constructor() {
    this.instance = Service.instances++;
  }
}
