/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {AttributeMarker} from '@angular/compiler/src/core';

import * as ast from '../../../../expression_parser/ast';
import * as tmpl from '../../../r3_ast';
import {Property} from '../features/binding';
import {InterpolationExpr} from '../features/binding/interpolation';
import {ElementEnd, ElementStart} from '../features/element';
import {Template} from '../features/embedded_views';
import {Text, TextInterpolate} from '../features/text';
import * as ir from '../ir';

import {Scope} from './scope';
import {TemplateExpressionConverter} from './value';

/**
 * Convert the given template AST to an `ir.RootTemplate` in the template IR.
 */
export function templateToIr(input: tmpl.Node[], name: string): ir.RootTemplate {
  const root = TemplateToIrConverter.parseRoot(input, name);
  return root;
}

/**
 * Processes a template (either a root template or an embedded view) and converts it to its IR
 * representation as lists of create and update nodes.
 *
 * `TemplateToIrConverter` is invoked via its `parseRoot()` static function, which will create an
 * `ir.RootTemplate` from the given template AST. It will recurse as necessary into embedded views.
 */
class TemplateToIrConverter implements tmpl.Visitor<void> {
  private create = new ir.CreateList();
  private update = new ir.UpdateList();

  private expressionConverter = new TemplateExpressionConverter(this.scope);

  private constructor(private scope: Scope) {}

  /**
   * Parse a template beginning from its top-level, including all sub-templates.
   */
  static parseRoot(input: tmpl.Node[], name: string): ir.RootTemplate {
    const scope = Scope.root();
    const parser = new TemplateToIrConverter(scope);
    for (const node of input) {
      node.visit(parser);
    }

    const {create, update} = parser.finalize();
    return new ir.RootTemplate(name, create, update, scope);
  }

  /**
   * Parse a child template of a higher-level template, including all sub-templates.
   */
  private parseChild(id: ir.Id, input: tmpl.Template): CreateUpdateBlocks {
    const childScope = this.scope.child(id);
    const parser = new TemplateToIrConverter(childScope);

    for (const v of input.variables) {
      childScope.recordVariable(v.name, id, v.value);
    }

    for (const node of input.children) {
      node.visit(parser);
    }

    return parser.finalize();
  }

  visitElement(element: tmpl.Element): void {
    // All elements have an id.
    const id = this.scope.allocateId();

    // Parse the references list, and add a reference in the current scope for each one.
    let refs: ir.Reference[]|null = null;
    if (element.references.length > 0) {
      refs = [];
      for (const ref of element.references) {
        refs.push(this.scope.recordReference(ref.name, id, ref.value));
      }
    }

    // Start building the ElementStart node.
    const elementStart = new ElementStart(id, element.name, element.sourceSpan);
    elementStart.refs = refs;

    // If the element has bindings (either attributes or inputs), it'll need an attrs array, which
    // is initialized lazily to avoid allocating it unnecessarily.
    if (element.attributes.length > 0 || element.inputs.length > 0) {
      elementStart.attrs = [];

      // First, add all static attributes for the element.
      for (const attr of element.attributes) {
        elementStart.attrs.push(attr.name);
        elementStart.attrs.push(attr.value);
      }

      // Then add an inputs section, and all of the inputs if needed.
      if (element.inputs.length > 0) {
        elementStart.attrs.push(AttributeMarker.Bindings);
      }

      for (const input of element.inputs) {
        const name = normalizeBindingName(input.type, input.name);
        elementStart.attrs.push(name);
        const property =
            new Property(id, name, this.expressionConverter.convert(input.value), input.sourceSpan);
        this.update.append(property);
      }
    }

    // Add the ElementStart node for this element, followed by processing all of its children, and
    // then the ElementEnd.
    this.create.append(elementStart);
    tmpl.visitAll(this, element.children);
    this.create.append(new ElementEnd(id));
  }

  visitText(text: tmpl.Text): void {
    const id = this.scope.allocateId();
    this.create.append(new Text(id, text.value, text.sourceSpan));
  }

  visitBoundText(text: tmpl.BoundText): void {
    const id = this.scope.allocateId();

    // TODO(alxhub): static text nodes?
    this.create.append(new Text(id, null, text.sourceSpan));

    let top = text.value;
    if (top instanceof ast.ASTWithSource) {
      top = top.ast;
    }

    if (top instanceof ast.Interpolation) {
      const sourceSpan = text.sourceSpan;
      const interpolationExpr = new InterpolationExpr(
          top.expressions.map(e => this.expressionConverter.convert(e)), top.strings);
      const textInterpolate = new TextInterpolate(id, interpolationExpr, sourceSpan);
      this.update.append(textInterpolate);
    } else {
      throw new Error('AssertionError: BoundText should have an ast.Interpolation value');
    }
  }

  visitTemplate(template: tmpl.Template): void {
    const id = this.scope.allocateId();
    const parsed = this.parseChild(id, template);

    // Template nodes still have references.
    let refs: ir.Reference[]|null = null;
    if (template.references.length > 0) {
      refs = [];
      for (const ref of template.references) {
        refs.push(this.scope.recordReference(ref.name, id, ref.value));
      }
    }

    const view = new Template(id, template.tagName !== '' ? template.tagName : 'ng-template');
    this.create.append(view);
    view.create = parsed.create;
    view.update = parsed.update;
    view.refs = refs;
  }

  visitContent(content: tmpl.Content): void {
    throw new Error('Method not implemented.');
  }

  visitVariable(variable: tmpl.Variable): void {
    throw new Error('Method not implemented.');
  }

  visitReference(reference: tmpl.Reference): void {
    throw new Error('Method not implemented.');
  }

  visitTextAttribute(attribute: tmpl.TextAttribute): void {
    throw new Error('Method not implemented.');
  }

  visitBoundAttribute(attribute: tmpl.BoundAttribute): void {
    throw new Error('Method not implemented.');
  }

  visitBoundEvent(attribute: tmpl.BoundEvent): void {
    throw new Error('Method not implemented.');
  }

  visitIcu(icu: tmpl.Icu): void {
    throw new Error('Method not implemented.');
  }

  finalize(): CreateUpdateBlocks {
    return {
      create: this.create,
      update: this.update,
    };
  }
}

/**
 * Recover the original binding name for a binding of a given type.
 *
 * The template parser converts special bindings like `[style.foo]` to a binding with name 'foo'
 * that has a special `ast.BindingType`. This normalizing operation undoes this conversion, because
 * in the template IR such special bindings are (initially) treated no differently than any other
 * kind.
 */
function normalizeBindingName(type: ast.BindingType, name: string): string {
  switch (type) {
    case ast.BindingType.Style:
      // this will convert [width] => [style.width]
      return name !== 'style' ? `style.${name}` : 'style';
    case ast.BindingType.Class:
      // this will convert [foo] => [class.foo]
      return name !== 'class' ? `class.${name}` : 'class';
    default:
      return name;
  }
}

interface CreateUpdateBlocks {
  create: ir.CreateList;
  update: ir.UpdateList;
}
