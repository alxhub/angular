/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {AST, ImplicitReceiver, MethodCall, PropertyRead, PropertyWrite, RecursiveAstVisitor, SafeMethodCall, SafePropertyRead} from '../../expression_parser/ast';
import {CssSelector, SelectorMatcher} from '../../selector';
import {BoundAttribute, BoundEvent, BoundText, Content, Element, Node, Reference, Template, Text, TextAttribute, Variable, Visitor} from '../r3_ast';

import {BoundTarget, Directive, Target, TargetBinder} from './t2_api';
import {getAttrsForDirectiveMatching} from './util';

export class R3TargetBinder<D> implements TargetBinder<D> {
  constructor(private directiveMatcher: SelectorMatcher<Directive<D>>) {}

  bind(target: Target): BoundTarget<D> {
    if (target.template) {
      const scope = Scope.apply(target.template);
      const {directives, references} =
          DirectiveMatcher.apply(target.template, this.directiveMatcher);
      const {expressions, symbols, nestingLevel} = TemplateBinder.apply(target.template, scope);
      return new R3BoundTarget<D>(
          target, directives, references, expressions, symbols, nestingLevel);
    }
    throw new Error('Method not implemented.');
  }
}

/**
 * Represents a binding scope within a template.
 *
 * Any variables, references, or other named entities declared within the template will
 * be captured and available by name in `namedEntities`. Additionally, child templates will
 * be analyzed and have their child `Scope`s available in `childScopes`.
 */
class Scope implements Visitor {
  readonly namedEntities = new Map<string, Reference|Variable>();
  readonly childScopes = new Map<Template, Scope>();

  private constructor(readonly parentScope?: Scope) {}

  static apply(template: Template|Node[]): Scope {
    const scope = new Scope();
    scope.ingest(template);
    return scope;
  }

  private ingest(template: Template|Node[]): void {
    if (template instanceof Template) {
      // Variables on an <ng-template> are defined in the inner scope.
      template.variables.forEach(node => this.visitVariable(node));
      template.children.forEach(node => node.visit(this));
    } else {
      template.forEach(node => node.visit(this));
    }
  }

  visitElement(element: Element) {
    element.references.forEach(node => this.visitReference(node));
    element.children.forEach(node => node.visit(this));
  }

  visitTemplate(template: Template) {
    // First, collect references.
    template.references.forEach(node => this.visitReference(node));

    // Next, create an inner scope and process the template within it.
    const scope = new Scope(this);
    scope.ingest(template);
    this.childScopes.set(template, scope);
  }

  visitVariable(variable: Variable) { this.maybeDeclare(variable); }

  visitReference(reference: Reference) { this.maybeDeclare(reference); }

  visitContent(content: Content) {}

  visitBoundAttribute(attr: BoundAttribute) {}

  visitBoundEvent(event: BoundEvent) {}

  visitBoundText(text: BoundText) {}

  visitText(text: Text) {}

  visitTextAttribute(attr: TextAttribute) {}

  private maybeDeclare(thing: Reference|Variable) {
    if (!this.namedEntities.has(thing.name)) {
      this.namedEntities.set(thing.name, thing);
    }
  }

  lookup(name: string): Reference|Variable|null {
    if (this.namedEntities.has(name)) {
      return this.namedEntities.get(name) !;
    } else if (this.parentScope !== undefined) {
      return this.parentScope.lookup(name);
    } else {
      return null;
    }
  }

  getChildScope(template: Template): Scope {
    const res = this.childScopes.get(template);
    if (!res) {
      throw new Error(`Debug error: child scope for ${template} not found`);
    }
    return res;
  }
}

class DirectiveMatcher<D> implements Visitor {
  constructor(
      private matcher: SelectorMatcher<Directive<D>>,
      private directives: Map<Element|Template, Directive<D>[]>,
      private references: Map<BoundAttribute|BoundEvent|Reference, Directive<D>|Element|Template>) {
  }

  static apply<D>(template: Node[], selectorMatcher: SelectorMatcher<Directive<D>>): {
    directives: Map<Element|Template, Directive<D>[]>,
    references: Map<BoundAttribute|BoundEvent|Reference, Directive<D>|Element|Template>,
  } {
    const directives = new Map<Element|Template, Directive<D>[]>();
    const references =
        new Map<BoundAttribute|BoundEvent|Reference, Directive<D>|Element|Template>();
    const matcher = new DirectiveMatcher(selectorMatcher, directives, references);
    matcher.ingest(template);
    return {directives, references};
  }

  private ingest(template: Node[]): void { template.forEach(node => node.visit(this)); }

  visitElement(element: Element): void { this.visitElementOrTemplate(element.name, element); }

  visitTemplate(template: Template): void { this.visitElementOrTemplate('ng-template', template); }

  visitElementOrTemplate(tag: string, node: Element|Template): void {
    const attrs = getAttrsForDirectiveMatching(node);
    const cssSelector = new CssSelector();

    cssSelector.setElement(tag);

    Object.getOwnPropertyNames(attrs).forEach((name) => {
      const value = attrs[name];

      cssSelector.addAttribute(name, value);
      if (name.toLowerCase() === 'class') {
        const classes = value.trim().split(/\s+/g);
        classes.forEach(className => cssSelector.addClassName(className));
      }
    });

    const directives: Directive<D>[] = [];
    this.matcher.match(cssSelector, (_, directive) => directives.push(directive));
    if (directives.length > 0) {
      this.directives.set(node, directives);
    }

    // Resolve any references that are created on this node.
    node.references.forEach(ref => {
      let refTarget: Directive<D>|Element|Template|null = null;
      if (ref.value.trim() === '') {
        // Reference to element/template or primary component.
        refTarget = directives.find(dir => dir.isPrimary) || node;
      } else {
        refTarget = directives.find(dir => dir.exportAs === ref.value) || null;
      }
      if (refTarget !== null) {
        this.references.set(ref, refTarget);
      }
    });

    [...node.attributes, ...node.inputs].forEach(
        binding => {

        });

    node.children.forEach(child => child.visit(this));
  }

  visitContent(content: Content): void {}
  visitVariable(variable: Variable): void {}
  visitReference(reference: Reference): void {}
  visitTextAttribute(attribute: TextAttribute): void {}
  visitBoundAttribute(attribute: BoundAttribute): void {}
  visitBoundEvent(attribute: BoundEvent): void {}

  visitBoundAttributeOrEvent(node: BoundAttribute|BoundEvent) {}

  visitText(text: Text): void {}
  visitBoundText(text: BoundText): void {}
}

class TemplateBinder extends RecursiveAstVisitor implements Visitor {
  private visitNode: (node: Node) => void;

  private constructor(
      private bindings: Map<AST, Reference|Variable>,
      private symbols: Map<Reference|Variable, Template>,
      private nestingLevel: Map<Template, number>, private scope: Scope,
      private template: Template|null, private level: number) {
    super();
    this.visitNode = (node: Node) => node.visit(this);
  }

  static apply(template: Template|Node[], scope: Scope): {
    expressions: Map<AST, Reference|Variable>,
    symbols: Map<Variable|Reference, Template>,
    nestingLevel: Map<Template, number>,
  } {
    const expressions = new Map<AST, Reference|Variable>();
    const symbols = new Map<Variable|Reference, Template>();
    const nestingLevel = new Map<Template, number>();
    const binder = new TemplateBinder(
        expressions, symbols, nestingLevel, scope, template instanceof Template ? template : null,
        0);
    binder.ingest(template);
    return {expressions, symbols, nestingLevel};
  }

  private ingest(template: Template|Node[]): void {
    if (template instanceof Template) {
      template.inputs.forEach(this.visitNode);
      template.outputs.forEach(this.visitNode);
      template.variables.forEach(this.visitNode);
      template.children.forEach(this.visitNode);
      this.nestingLevel.set(template, this.level);
    } else {
      template.forEach(this.visitNode);
    }
  }


  visitPropertyRead(ast: PropertyRead, context: any): any {
    if (ast.receiver instanceof ImplicitReceiver) {
      this.maybeMap(context, ast, ast.name);
    }
    return super.visitPropertyRead(ast, context);
  }

  visitSafePropertyRead(ast: SafePropertyRead, context: any): any {
    if (ast.receiver instanceof ImplicitReceiver) {
      this.maybeMap(context, ast, ast.name);
    }
    return super.visitSafePropertyRead(ast, context);
  }

  visitPropertyWrite(ast: PropertyWrite, context: any): any {
    if (ast.receiver instanceof ImplicitReceiver) {
      this.maybeMap(context, ast, ast.name);
    }
    return super.visitPropertyWrite(ast, context);
  }

  visitMethodCall(ast: MethodCall, context: any): any {
    if (ast.receiver instanceof ImplicitReceiver) {
      this.maybeMap(context, ast, ast.name);
    }
    return super.visitMethodCall(ast, context);
  }

  visitSafeMethodCall(ast: SafeMethodCall, context: any): any {
    if (ast.receiver instanceof ImplicitReceiver) {
      this.maybeMap(context, ast, ast.name);
    }
    return super.visitSafeMethodCall(ast, context);
  }

  private maybeMap(scope: Scope, ast: AST, name: string): void {
    console.error('maybe mapping', ast, name);
    let target = this.scope.lookup(name);
    if (target !== null) {
      this.bindings.set(ast, target);
    }
  }


  visitElement(element: Element) {
    const visit = (node: Node) => node.visit(this);
    element.inputs.forEach(visit);
    element.outputs.forEach(visit);
    element.children.forEach(visit);
  }

  visitTemplate(template: Template) {
    template.inputs.forEach(this.visitNode);
    template.outputs.forEach(this.visitNode);
    template.references.forEach(this.visitNode);
    const childScope = this.scope.getChildScope(template);
    const binder = new TemplateBinder(
        this.bindings, this.symbols, this.nestingLevel, childScope, template, this.level + 1);
    binder.ingest(template);
  }

  visitBoundAttribute(attribute: BoundAttribute) { attribute.value.visit(this); }

  visitBoundEvent(event: BoundEvent) { event.handler.visit(this); }

  visitBoundText(text: BoundText) { text.value.visit(this); }

  visitVariable(variable: Variable) {
    if (this.template !== null) {
      this.symbols.set(variable, this.template);
    }
  }

  visitReference(reference: Reference) {
    if (this.template !== null) {
      this.symbols.set(reference, this.template);
    }
  }

  visitText(text: Text) {}
  visitContent(content: Content) {}
  visitTextAttribute(attribute: TextAttribute) {}
}

export class R3BoundTarget<D> implements BoundTarget<D> {
  constructor(
      readonly target: Target, private directives: Map<Element|Template, Directive<D>[]>,
      private references:
          Map<BoundAttribute|BoundEvent|Reference|TextAttribute, Directive<D>|Element|Template>,
      private exprTargets: Map<AST, Directive<D>|Reference|Variable>,
      private symbols: Map<Reference|Variable, Template>,
      private nestingLevel: Map<Template, number>) {}

  getDirectivesOfNode(node: Element|Template): Directive<D>[]|null {
    return this.directives.get(node) || null;
  }

  getReferenceTarget(ref: Reference): Directive<D>|Element|Template|null {
    return this.references.get(ref) || null;
  }

  getConsumerOfBinding(binding: BoundAttribute|BoundEvent|TextAttribute): Directive<D>|Element
      |Template|null {
    return this.references.get(binding) || null;
  }

  getExpressionTarget(expr: AST): Directive<D>|Reference|Variable|null {
    return this.exprTargets.get(expr) || null;
  }

  getTemplateOfSymbol(symbol: Reference|Variable): Template|null {
    return this.symbols.get(symbol) || null;
  }

  getNestingLevel(template: Template): number { return this.nestingLevel.get(template) || 0; }

  getUsedDirectives(): Directive<D>[] {
    const set = new Set<Directive<D>>();
    this.directives.forEach(dirs => {dirs.forEach(dir => set.add(dir))});
    return Array.from(set.values());
  }
}
