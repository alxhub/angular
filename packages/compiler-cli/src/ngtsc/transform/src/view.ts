import * as ts from 'typescript';

import {CompilerAdapter, AnalysisOutput, AddStaticFieldInstruction} from './api';

import {compileComponent, compileDirective, ConstantPool, Lexer, Parser, R3ComponentMetadata, R3DirectiveMetadata, BindingParser, DEFAULT_INTERPOLATION_CONFIG, DomElementSchemaRegistry, WrappedNodeExpr, parseTemplate, ExternalExpr, ExternalReference, ReadVarExpr, Expression} from '@angular/compiler';
import { Decorator, reflectObjectLiteral, staticallyResolve } from '../../metadata';
import { ScopeMap, getImportPath } from './scope';

export class ViewCompilerAdapter implements CompilerAdapter<R3ComponentMetadata | R3DirectiveMetadata> {
  private lexer = new Lexer();
  private parser = new Parser(this.lexer);

  constructor(private scopeMap: ScopeMap, private checker: ts.TypeChecker) {}

  detect(decorators: Decorator[]): Decorator | undefined {
    return decorators.find(decorator => decorator.from === '@angular/core' &&
        (decorator.name === 'Directive' || decorator.name === 'Component'));
  }

  analyze(node: ts.ClassDeclaration, decorator: Decorator): AnalysisOutput<R3ComponentMetadata | R3DirectiveMetadata> {
    if (decorator.args.length !== 1) {
      throw new Error(`Invalid decorator argument length`);
    }
    const arg = decorator.args[0];
    if (!ts.isObjectLiteralExpression(arg)) {
      throw new Error(`Decorator argument needs to be object literal`);
    }
    const directive = reflectObjectLiteral(arg);

    const scope = this.scopeMap.getScopeForDirective(node);
    if (scope === undefined) {
      throw new Error(`Component not found in scope: ${node.name!.text}`);
    }

    const selector = directive.has('selector') ? staticallyResolve(directive.get('selector')!, this.checker) : null;
    if (selector !== null && !(typeof selector === 'string')) {
      throw new Error(`Selector must statically resolve to a string`);
    }
    const templateStr = directive.has('template') ? staticallyResolve(directive.get('template')!, this.checker) : undefined;
    if (templateStr !== undefined && !(typeof templateStr === 'string')) {
      throw new Error(`Template must statically resolve to a string`);
    }
    const bindingParser = new BindingParser(this.parser, DEFAULT_INTERPOLATION_CONFIG, new DomElementSchemaRegistry(), [], []);
    const template = templateStr !== undefined ? parseTemplate(templateStr, 'test', bindingParser) : undefined;

    const directives = new Map<string, Expression>();
    scope.directives.forEach(scopeDirective => {
      const moduleName = getImportPath(node.getSourceFile().fileName, scopeDirective.importFrom.relatively!);
      if (moduleName === '') {
        directives.set(scopeDirective.selector!, new ReadVarExpr(scopeDirective.identifier));
      } else {
        directives.set(scopeDirective.selector!, new ExternalExpr({
          moduleName,
          name: scopeDirective.identifier,
        } as ExternalReference));
      }
    });
    console.error('directives', directives);

    const meta: R3ComponentMetadata | R3DirectiveMetadata = {
      name: node.name!.text,
      type: new WrappedNodeExpr(node.name!),
      selector,
      template,
      lifecycle: {
        usesOnChanges: false,
      },
      deps: [],
      directives,
      host: {
        attributes: {},
        listeners: {},
        properties: {},
      },
      inputs: {},
      outputs: {},
      pipes: [],
      queries: [],
      viewQueries: [],
      typeSourceSpan: null!,
    };
    return {
      analysis: meta,
    };
  }

  compile(node: ts.ClassDeclaration, analysis: R3ComponentMetadata | R3DirectiveMetadata, constantPool: ConstantPool): AddStaticFieldInstruction {
    const bindingParser = new BindingParser(this.parser, DEFAULT_INTERPOLATION_CONFIG, new DomElementSchemaRegistry(), [], []);
    if (isR3ComponentMetadata(analysis)) {
      const res = compileComponent(analysis, constantPool, bindingParser);
      return {
        field: 'ngComponentDef',
        initializer: res.expression,
        type: res.type,
      };
    } else {
      const res = compileDirective(analysis, constantPool, bindingParser);
      return {
        field: 'ngDirectiveDef',
        initializer: res.expression,
        type: res.type,
      };
    }
  }
}

function isR3ComponentMetadata(meta: any): meta is R3ComponentMetadata {
  return (meta as R3ComponentMetadata).template !== undefined;
}