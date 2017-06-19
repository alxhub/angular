import {ɵAnimationEngine} from '@angular/animations/browser';
import {Inject, Injectable, NgModule, RendererFactory2, NgZone} from '@angular/core';
import {DOCUMENT, ɵSharedStylesHost as SharedStylesHost, ɵgetDOM as getDOM} from '@angular/platform-browser';
import {ɵAnimationRendererFactory} from '@angular/platform-browser/animations';
import {AmpRendererFactory2, AmpSharedStylesHost} from './amp_renderer';
import {PlatformState} from './platform_state';
import {PRE_RENDER_HOOK, PreRenderHook} from './server';

const validator = require('amphtml-validator');

export function instantiateAmpRendererFactory(renderer: AmpRendererFactory2, engine: ɵAnimationEngine, zone: NgZone): ɵAnimationRendererFactory {
  return new ɵAnimationRendererFactory(renderer, engine, zone);
}

@Injectable()
export class AmpSetupHook implements PreRenderHook {
  constructor(@Inject(DOCUMENT) private doc: any) {}

  private scanNodeForStyleAttrs(el: any): void {
    const dom = getDOM();
    console.log('on element', dom.tagName(el));
    const attrs = dom.attributeMap(el).entries();
    let next: IteratorResult<[string, string]>;
    do {
      next = attrs.next();
      console.log('next', next);
      if (!next || next.done || !next.value) {
        break;
      }
      console.log(next.value);
      const [name, value] = next.value;
      console.log(`scan attr ${name} = ${value}`);
      if (value === 'AMP-STYLE-ATTR') {
        dom.removeAttribute(el, name);
        const clazz = dom.getAttribute(el, 'class');
        if (clazz !== null) {
          dom.setAttribute(el, 'class', clazz + ' ' + name);
        } else {
          dom.setAttribute(el, 'class', name);
        }
      }
    } while (!next.done);

    const children = dom.childNodes(el);
    if (!!children) {
      children.forEach(child => this.scanNodeForStyleAttrs(child));
    }
  }

  beforeRender(): Promise<any> {
    console.log('SETUP HOOK');
    this.scanNodeForStyleAttrs(this.doc);
    return Promise.resolve();
  }
}

@Injectable()
export class AmpValidationHook implements PreRenderHook {
  constructor(private state: PlatformState) {}

  beforeRender(): Promise<any> {
    console.log('VALIDATOR HOOK');
    return validator
      .getInstance()
      .then((v: any) => {
        const html = this.state.renderToString();
        console.log(html);
        const result = v.validateString(html);
        if (result.status === 'PASS') {
          return true;
        }
        let msg = 'Failed AMP validation:';
        result.errors.forEach((error: any) => {
          msg += '\nline ' + error.line + ', col ' + error.col + ': ' + error.message;
          if (error.specUrl !== null) {
            msg += '\n (see ' + error.specUrl + ')';
          }
        });
        throw new Error(msg);
      });
  }
}

@NgModule({
  providers: [
    AmpRendererFactory2,
    {
      provide: RendererFactory2,
      useFactory: instantiateAmpRendererFactory,
      deps: [AmpRendererFactory2, ɵAnimationEngine, NgZone],
    },
    AmpSharedStylesHost,
    { 
      provide: SharedStylesHost,
      useExisting: AmpSharedStylesHost,
    },
    {
      provide: PRE_RENDER_HOOK,
      useClass: AmpSetupHook,
      multi: true,
    },
    {
      provide: PRE_RENDER_HOOK,
      useClass: AmpValidationHook,
      multi: true,
    },
  ],
})
export class AmpModule {}