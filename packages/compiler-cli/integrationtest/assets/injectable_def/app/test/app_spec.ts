import {enableProdMode} from '@angular/core';
import {renderModuleFactory} from '@angular/platform-server';
import {AppModuleNgFactory} from 'app_built/src/app.ngfactory';

enableProdMode();


describe('ngInjectableDef Bazel Integration', () => {
  it('works in AOT', done => {
    renderModuleFactory(AppModuleNgFactory, {
      document: '<id-app></id-app>',
      url: '/',
    }).then(html => {
      expect(html).toMatch(/>0:0<\//);
      done();
    });
  });
});
