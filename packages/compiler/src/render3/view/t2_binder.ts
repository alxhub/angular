import {BoundTarget, MatchedDirective, Target, TargetBinder} from './t2_api';
import {Content, Element, Reference, Template, Variable, Visitor, TextAttribute, BoundAttribute, BoundEvent, BoundText, Text, visitAll as visitTemplate} from '../r3_ast';
import {AST, RecursiveAstVisitor, PropertyRead, ImplicitReceiver, PropertyWrite, MethodCall, SafePropertyRead, SafeMethodCall} from '../../expression_parser/ast';
import { templateVisitAll } from '../../template_parser/template_ast';

export class R3TargetBinder implements TargetBinder {
  bind(target: Target): BoundTarget {
    if (target.template) {
      const scope = Scope.analyze(target.template);
      const bindings = TemplateBinder.bind(target.template, scope);
    }
    throw new Error("Method not implemented.");
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

  static analyze(template: Template): Scope {
    const scope = new Scope();
    scope.ingest(template);
    return scope;
  }

  private ingest(template: Template): void {
    // Variables on an <ng-template> are defined in the inner scope.
    template.variables.forEach(node => this.visitVariable(node));
    template.children.forEach(node => node.visit(this));
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
  }

  visitVariable(variable: Variable) {
    this.maybeDeclare(variable);
  }

  visitReference(reference: Reference) {
    this.maybeDeclare(reference);
  }

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
      return this.namedEntities.get(name)!;
    } else if (this.parentScope !== undefined) {
      return this.parentScope.lookup(name);
    } else {
      return null;
    }
  }
}

class TemplateBinder extends RecursiveAstVisitor implements Visitor {

  static bind(template: Template, scope: Scope): Map<AST, Reference|Variable> {
    const map = new Map<AST, Reference|Variable>();
    const binder = new TemplateBinder(map, scope);
    binder.bind(template);
    return map;
  }

  private constructor(private bindings: Map<AST, Reference|Variable>, private scope: Scope) {
    super();
  }

  private bind(template: Template): void {
    template.attributes.forEach(node => this.visitTextAttribute(node));
    template.references.forEach(node => this.visitReference(node));

    Array
      .from(this.scope.childScopes.entries())
      .forEach(([childTemplate, childScope]) => new TemplateBinder(this.bindings, childScope).bind(childTemplate));
  }

  visitElement(element: Element) {
    element.references.forEach(node => this.visitReference(node));
    element.children.forEach(node => node.visit(this));
  }

  visitTemplate(template: Template) {
  }

  visitVariable(variable: Variable) {
  }

  visitReference(reference: Reference) {
  }

  visitContent(content: Content) {}

  visitBoundAttribute(attr: BoundAttribute) {}

  visitBoundEvent(event: BoundEvent) {}

  visitBoundText(text: BoundText) {}

  visitText(text: Text) {}

  visitTextAttribute(attr: TextAttribute) {}
}

class ExpressionBinder extends RecursiveAstVisitor {
  private constructor(private bindings: Map<AST, Reference|Variable>, private scope: Scope) {
    super();
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
    let target = this.scope.lookup(name);
    if (target !== null) {
      this.bindings.set(ast, target);
    }
  }
}

export class R3BoundTarget implements BoundTarget {
  constructor(
    readonly target: Target,
    private directives: Map<Element, MatchedDirective<any>[]>,
    private exprTargets: Map<AST, MatchedDirective<any>|Reference|Variable>,
  ) {}

  getDirectivesOfElement(el: Element): MatchedDirective<any>[]|null {
    return this.directives.get(el) || null;
  }

  getExpressionTarget(expr: AST): MatchedDirective<any>|Reference|Variable|null {
    return this.exprTargets.get(expr) || null;
  }
}
