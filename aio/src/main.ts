import {enableProdMode} from '@angular/core';
import {platformBrowserDynamic} from '@angular/platform-browser-dynamic';

import {AppModule} from './app/app.module';
import {environment} from './environments/environment';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule);

// benchmark instructions:
// start at root and run:
// - scripts/build-ivy-npm-packages.sh
// - mv dist/packages-dist-ivy-aot dist/packages-dist
// - yarn --cwd aio build-with-ivy --progress=false
// - cd aio
// - yarn ng serve
// At this point you can trigger rebuilds by add more lines like these:
console.log(1);
console.log(1);
console.log(1);
