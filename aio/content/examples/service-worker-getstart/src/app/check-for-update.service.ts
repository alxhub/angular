import { Injectable } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { interval } from 'rxjs/observable/interval';

function promptUser(event): boolean {
  return true;
}

// #docregion sw-check-update
@Injectable()
export class CheckForUpdateService {

  constructor(updates: SwUpdate) {
    interval(6 * 60 * 60).subscribe(() => updates.checkForUpdate());
  }
}
// #enddocregion sw-check-update
