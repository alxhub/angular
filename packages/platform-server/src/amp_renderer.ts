import {Inject, Optional, NgZone, Renderer2, RendererType2} from '@angular/core';
import {ɵNAMESPACE_URIS as NAMESPACE_URIS, DOCUMENT, ɵTRANSITION_ID, ɵSharedStylesHost as SharedStylesHost, ɵgetDOM as getDOM, ɵflattenStyles as flattenStyles, ɵshimContentAttribute as shimContentAttribute, ɵshimHostAttribute as shimHostAttribute} from '@angular/platform-browser';
import {DomElementSchemaRegistry} from '@angular/compiler';
import {DefaultServerRenderer2, EmulatedEncapsulationServerRenderer2, ServerRendererFactory2} from './server_renderer';
import {Parse5DomAdapter} from './parse5_adapter';

export class AmpRendererFactory2 extends ServerRendererFactory2 {
  constructor(
      ngZone: NgZone, @Inject(DOCUMENT) document: any, sharedStylesHost: SharedStylesHost) {
    super(ngZone, document, sharedStylesHost);
  }

  protected _createDefaultRenderer(document: any, ngZone: NgZone, schema: DomElementSchemaRegistry): Renderer2 {
    return new DefaultAmpRenderer2(document, ngZone, schema);
  }

  protected _createEmulatedRenderer(document: any, ngZone: NgZone, sharedStylesHost: SharedStylesHost,
      schema: DomElementSchemaRegistry, component: RendererType2): Renderer2 {
    return new EmulatedEncapsulationAmpRenderer2(document, ngZone, sharedStylesHost, schema, component);
  }
}

export class DefaultAmpRenderer2 extends DefaultServerRenderer2 {
  createElement(name: string, namespace?: string, debugInfo?: any): any {
    if (!namespace && name === 'img') {
      name = 'amp-img';
    }

    if (namespace) {
      return getDOM().createElementNS(NAMESPACE_URIS[namespace], name);
    }

    return getDOM().createElement(name);
  }
}

/**
 * {@link SharedStylesHost} that combines all styles into a single <style amp-custom> tag.
 */
export class AmpSharedStylesHost extends SharedStylesHost {
  private adapter: Parse5DomAdapter;
  private style: any = null;
  private styleText: string = '';

  constructor(
      @Inject(DOCUMENT) private doc: any) {
    super();
    this.adapter = getDOM() as Parse5DomAdapter;
    const head = this.adapter.getElementsByTagName(doc, 'head')[0];
    this.style = this.adapter.createElement('style');
    this.adapter.setAttribute(this.style, 'amp-custom', '');
    this.adapter.appendChild(head, this.style);
  }

  onStylesAdded(additions: Set<string>) { 
    additions.forEach(style => this.styleText += '\n' + style);
    this.adapter.setText(this.style, this.styleText);
  }
}

export class EmulatedEncapsulationAmpRenderer2 extends DefaultAmpRenderer2 {
  private contentAttr: string;
  private hostAttr: string;

  constructor(
      document: any, ngZone: NgZone, sharedStylesHost: SharedStylesHost,
      schema: DomElementSchemaRegistry, private component: RendererType2) {
    super(document, ngZone, schema);
    const styles = flattenStyles(component.id, component.styles, []);
    this.contentAttr = shimContentAttribute(component.id);
    this.hostAttr = shimHostAttribute(component.id);
    const contentRegex = new RegExp(`\\[${this.contentAttr}\\]`, 'g');
    const hostRegex = new RegExp(`\\[${this.hostAttr}\\]`, 'g');
    sharedStylesHost.addStyles(styles.map(style => style
      .replace(contentRegex, `.${this.contentAttr}`)
      .replace(hostRegex, `.${this.hostAttr}`)
    ));
  }

  applyToHost(element: any) {
    super.setAttribute(element, this.hostAttr, 'AMP-STYLE-ATTR');
  }

  createElement(parent: any, name: string): Element {
    const el = super.createElement(parent, name);
    super.setAttribute(el, this.contentAttr, 'AMP-STYLE-ATTR');
    return el;
  }
}
