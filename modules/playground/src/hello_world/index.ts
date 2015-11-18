import {bootstrap} from 'angular2/bootstrap';
import {ElementRef, Component, Directive, Injectable, provide} from 'angular2/core';
import {Renderer} from 'angular2/render';
import {TEMPLATE_TRANSFORMS} from 'angular2/src/compiler/template_parser';
import {
  TemplateAst,
  TemplateAstVisitor,
  NgContentAst,
  EmbeddedTemplateAst,
  ElementAst,
  VariableAst,
  BoundEventAst,
  AttrAst,
  BoundTextAst,
  TextAst,
  DirectiveAst,
  BoundDirectivePropertyAst,
  BoundElementPropertyAst,
  templateVisitAll
  
} from 'angular2/src/compiler/template_ast';
import {AST, AstTransformer, BindingPipe, PrefixNot} from 'angular2/src/core/change_detection/parser/ast';

export class MyAstTransformer extends AstTransformer {
  
  visitPipe(ast: BindingPipe): AST {
    if (ast.name == "not") {
      console.log("Transform triggered");
      let res = new PrefixNot(ast.exp.visit(this));
      return res;
    }
    console.log("Transform not triggered");
    return super.visitPipe(ast);
  }
}

export class MyTransformer implements TemplateAstVisitor {
  
  astTransformer: MyAstTransformer = new MyAstTransformer();
  
  visitNgContent(ast: NgContentAst, context: any): any {
    console.log("visitNgContent");
    return ast;
  }
  visitEmbeddedTemplate(ast: EmbeddedTemplateAst, context: any): any {
    console.log("visitEmbeddedTemplate");
    return ast;
  }
  visitElement(ast: ElementAst, context: any): any {
    console.log("visitElement");
    let children = this.descend(ast.children);
    let inputs = this.descend(ast.inputs);
    let directives = this.descend(ast.directives);
    return new ElementAst(ast.name, ast.attrs, inputs, ast.outputs, ast.exportAsVars, directives, children, ast.ngContentIndex, ast.sourceInfo);
  }
  visitVariable(ast: VariableAst, context: any): any {
    console.log("visitVariable");
    return ast;
  }
  visitEvent(ast: BoundEventAst, context: any): any {
    console.log("visitEvent");
    return ast;
  }
  visitElementProperty(ast: BoundElementPropertyAst, context: any): any {
    console.log("visitElementProperty");
    return ast;
  }
  visitAttr(ast: AttrAst, context: any): any {
    console.log("visitAttr");
    return ast;
  }
  visitBoundText(ast: BoundTextAst, context: any): any {
    console.log("visitBoundText");
    let tx = ast.value.visit(this.astTransformer);
    let res = new BoundTextAst(tx, ast.ngContentIndex, ast.sourceInfo);
    return res;
  }
  visitText(ast: TextAst, context: any): any {
    console.log("visitText()");
    return ast;
  }
  visitDirective(ast: DirectiveAst, context: any): any {
    console.log("visitDirective()");
    console.log(ast.directive.type.runtime);
    let inputs = this.descend(ast.inputs);
    let hostProperties = this.descend(ast.hostProperties);
    return new DirectiveAst(ast.directive, inputs, hostProperties, ast.hostEvents, ast.exportAsVars, ast.sourceInfo);
  }
  visitDirectiveProperty(ast: BoundDirectivePropertyAst, context: any): any {
    console.log("visitDirectiveProperty");
    return ast;
  }
  
  descend(children: TemplateAst[]) {
    console.log("->");
    let res = templateVisitAll(this, children);
    console.log("<-");
    return res;
  }
}

export function main() {
  // Bootstrapping only requires specifying a root component.
  // The boundary between the Angular application and the rest of the page is
  // the shadowDom of this root component.
  // The selector of the component passed in is used to find where to insert the
  // application.
  // You can use the light dom of the <hello-app> tag as temporary content (for
  // example 'Loading...') before the application is ready.
  console.log("Bootstrap");
  bootstrap(HelloCmp, [
    provide(TEMPLATE_TRANSFORMS, {useClass: MyTransformer, multi: true})
  ]);
}

// A service available to the Injector, used by the HelloCmp component.
@Injectable()
class GreetingService {
  greeting: string = 'hello';
}

// Directives are light-weight. They don't allow new
// expression contexts (use @Component for those needs).
@Directive({selector: '[red]'})
class RedDec {
  // ElementRef is always injectable and it wraps the element on which the
  // directive was found by the compiler.
  constructor(el: ElementRef, renderer: Renderer) { renderer.setElementStyle(el, 'color', 'red'); }
}

// Angular 2.0 supports 2 basic types of directives:
// - Component - the basic building blocks of Angular 2.0 apps. Backed by
//   ShadowDom.(http://www.html5rocks.com/en/tutorials/webcomponents/shadowdom/)
// - Directive - add behavior to existing elements.

// @Component is AtScript syntax to annotate the HelloCmp class as an Angular
// 2.0 component.
@Component({
  // The Selector prop tells Angular on which elements to instantiate this
  // class. The syntax supported is a basic subset of CSS selectors, for example
  // 'element', '[attr]', [attr=foo]', etc.
  selector: 'hello-app',
  // These are services that would be created if a class in the component's
  // template tries to inject them.
  viewProviders: [GreetingService],
  // Expressions in the template (like {{greeting}}) are evaluated in the
  // context of the HelloCmp class below.
  template: `<div class="greeting"><pre>
  greeting | json: {{greeting | json}}
  greeting | not: {{greeting | not}}
  </pre>
           <button class="changeButton" (click)="changeGreeting()">change value</button>`,
  // All directives used in the template need to be specified. This allows for
  // modularity (RedDec can only be used in this template)
  // and better tooling (the template can be invalidated if the attribute is
  // misspelled).
  directives: [RedDec]
})
export class HelloCmp {
  greeting: boolean;

  constructor(service: GreetingService) { this.greeting = false; }

  changeGreeting(): void { this.greeting = !this.greeting; }
}
