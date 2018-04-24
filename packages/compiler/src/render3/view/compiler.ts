/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {CompileDiDependencyMetadata, CompileDirectiveMetadata, CompileQueryMetadata, CompileTypeMetadata, flatten, identifierName, sanitizeIdentifier, tokenReference, CompileDirectiveSummary, CompileTokenMetadata} from '../../compile_metadata';
import {CompileReflector} from '../../compile_reflector';
import {BindingForm, BuiltinFunctionCall, LocalResolver, convertActionBinding, convertPropertyBinding} from '../../compiler_util/expression_converter';
import {ConstantPool, DefinitionKind} from '../../constant_pool';
import * as core from '../../core';
import {AST, AstMemoryEfficientTransformer, BindingPipe, BoundElementBindingType, FunctionCall, ImplicitReceiver, LiteralArray, LiteralMap, LiteralPrimitive, PropertyRead} from '../../expression_parser/ast';
import {Identifiers} from '../../identifiers';
import {LifecycleHooks} from '../../lifecycle_reflector';
import * as o from '../../output/output_ast';
import {ParseSourceSpan, typeSourceSpan} from '../../parse_util';
import {CssSelector, SelectorMatcher} from '../../selector';
import {BindingParser} from '../../template_parser/binding_parser';
import {OutputContext, error} from '../../util';

import * as t from './../r3_ast';
import {Identifiers as R3} from './../r3_identifiers';
import {compileIvyFactoryFunction, IvyDependencyMetadata, IvyResolvedDependency} from './../r3_factory';

import {StaticSymbol} from '../../aot/static_symbol';

import {ComponentDef, DirectiveDef, IvyComponentMetadata, IvyDirectiveMetadata, IvyQueryMetadata} from './api';
import {BindingScope, TemplateDefinitionBuilder} from './template';
import {asLiteral, conditionallyCreateMapObjectLiteral, CONTEXT_NAME, ID_SEPARATOR, MEANING_SEPARATOR, temporaryAllocator, TEMPORARY_NAME, unsupported} from './util';

export function compileIvyDirective(meta: IvyDirectiveMetadata, constantPool: ConstantPool, bindingParser: BindingParser): DirectiveDef {
  const definitionMapValues: {key: string, quoted: boolean, value: o.Expression}[] = [];

  const field = (key: string, value: o.Expression | null) => {
    if (value) {
      definitionMapValues.push({key, value, quoted: false});
    }
  };

  // e.g. `type: MyDirective`
  field('type', meta.type);

  // e.g. `selectors: [['', 'someDir', '']]`
  field('selectors', createDirectiveSelector(meta.selector!));

  const queryDefinitions = createQueryDefinitions(meta, constantPool);

  // e.g. `factory: () => new MyApp(injectElementRef())`
  field('factory', compileIvyFactoryFunction({
    name: meta.name,
    fnOrClass: meta.type,
    deps: meta.deps,
    useNew: true,
    injectFn: R3.directiveInject,
    extraResults: queryDefinitions,
  }));

  // e.g. `hostBindings: (dirIndex, elIndex) => { ... }
  field('hostBindings', createHostBindingsFunction(meta, bindingParser));

  // e.g. `attributes: ['role', 'listbox']`
  field('attributes', createHostAttributesArray(meta));

  // e.g 'inputs: {a: 'a'}`
  field('inputs', conditionallyCreateMapObjectLiteral(meta.inputs));

  // e.g 'outputs: {a: 'a'}`
  field('outputs', conditionallyCreateMapObjectLiteral(meta.outputs));

  const expression = o.importExpr(R3.defineDirective).callFn([o.literalMap(definitionMapValues)]);
  const type = new o.ExpressionType(o.importExpr(R3.DirectiveDef, [new o.ExpressionType(meta.type)]));
  return {expression, type};
}

export function compileIvyComponent(meta: IvyComponentMetadata, constantPool: ConstantPool, bindingParser: BindingParser): ComponentDef {
  const definitionMapValues: {key: string, quoted: boolean, value: o.Expression}[] = [];

  const field = (key: string, value: o.Expression | null) => {
    if (value) {
      definitionMapValues.push({key, value, quoted: false});
    }
  };

  // e.g. `type: MyApp`
   field('type', meta.type);

   // e.g. `selectors: [['my-app']]`
   field('selectors', createDirectiveSelector(meta.selector !));
 
   const selector = meta.selector && CssSelector.parse(meta.selector);
   const firstSelector = selector && selector[0];
 
   // e.g. `attr: ["class", ".my.app"]`
   // This is optional an only included if the first selector of a component specifies attributes.
   if (firstSelector) {
     const selectorAttributes = firstSelector.getAttrs();
     if (selectorAttributes.length) {
       field(
           'attrs', constantPool.getConstLiteral(
                        o.literalArr(selectorAttributes.map(
                            value => value != null ? o.literal(value) : o.literal(undefined))),
                        /* forceShared */ true));
     }
   }
 
   const queryDefinitions = createQueryDefinitions(meta, constantPool);

   // e.g. `factory: () => new MyApp(injectElementRef())`
   field('factory', compileIvyFactoryFunction({
     name: meta.name,
     fnOrClass: meta.type,
     deps: meta.deps,
     useNew: true,
     injectFn: R3.directiveInject,
     extraResults: queryDefinitions,
   }));

   // e.g `hostBindings: function MyApp_HostBindings { ... }
   field('hostBindings', createHostBindingsFunction(meta, bindingParser));
 
   // e.g. `template: function MyComponent_Template(_ctx, _cm) {...}`
   const templateTypeName = meta.name;
   const templateName = templateTypeName ? `${templateTypeName}_Template` : null;
 
   const templateFunctionExpression =
       new TemplateDefinitionBuilder(
           constantPool, CONTEXT_NAME, BindingScope.ROOT_SCOPE, 0,
           templateTypeName, templateName, meta.viewQueries, directiveMatcher, directives,
           pipeTypeByName, pipes)
           .buildTemplateFunction(nodes, [], hasNgContent, ngContentSelectors);
 
   field('template', templateFunctionExpression);
 
   // e.g. `directives: [MyDirective]`
   if (directives.size) {
     const expressions = Array.from(directives).map(d => outputCtx.importExpr(d));
     field('directives', o.literalArr(expressions));
   }
 
   // e.g. `pipes: [MyPipe]`
   if (pipes.size) {
     const expressions = Array.from(pipes).map(d => outputCtx.importExpr(d));
     field('pipes', o.literalArr(expressions));
   }
 
   // e.g `inputs: {a: 'a'}`
   field('inputs', conditionallyCreateMapObjectLiteral(component.inputs));
 
   // e.g 'outputs: {a: 'a'}`
   field('outputs', conditionallyCreateMapObjectLiteral(component.outputs));
 
   // e.g. `features: [NgOnChangesFeature(MyComponent)]`
   const features: o.Expression[] = [];
   if (component.type.lifecycleHooks.some(lifecycle => lifecycle == LifecycleHooks.OnChanges)) {
     features.push(o.importExpr(R3.NgOnChangesFeature, null, null).callFn([outputCtx.importExpr(
         component.type.reference)]));
   }
   if (features.length) {
     field('features', o.literalArr(features));
   }
 
   const definitionField = outputCtx.constantPool.propertyNameOf(DefinitionKind.Component);
   const definitionFunction =
       o.importExpr(R3.defineComponent).callFn([o.literalMap(definitionMapValues)]);
   const className = identifierName(component.type) !;
   className || error(`Cannot resolver the name of ${component.type}`);

   return null!;
}

export function compileDirectiveGlobal(
    outputCtx: OutputContext, directive: CompileDirectiveMetadata, reflector: CompileReflector,
    bindingParser: BindingParser) {
  const name = identifierName(directive.type) !;
  name || error(`Cannot resolver the name of ${directive.type}`);

  const definitionField = outputCtx.constantPool.propertyNameOf(DefinitionKind.Directive);

  const summary = directive.toSummary();
  const res = compileIvyDirective({
    name,
    type: outputCtx.importExpr(directive.type.reference),
    selector: directive.selector,
    deps: depsFromGlobalMetadata(directive.type, outputCtx, reflector),
    queries: queriesFromGlobalMetadata(directive.queries, outputCtx),
    host: {
      attributes: directive.hostAttributes,
      listeners: summary.hostListeners,
      properties: summary.hostProperties,
    },
    inputs: directive.inputs,
    outputs: directive.outputs,
  }, outputCtx.constantPool, bindingParser);

  // Create the partial class to be merged with the actual class.
  outputCtx.statements.push(new o.ClassStmt(
      name, null,
      [new o.ClassField(
          definitionField, o.INFERRED_TYPE, [o.StmtModifier.Static], res.expression)],
      [], new o.ClassMethod(null, [], []), []));
}

export function compileComponent(
    outputCtx: OutputContext, component: CompileDirectiveMetadata, nodes: t.Node[],
    hasNgContent: boolean, ngContentSelectors: string[], reflector: CompileReflector,
    bindingParser: BindingParser, directiveTypeBySel: Map<string, any>,
    pipeTypeByName: Map<string, any>) {

  const name = identifierName(component.type) !;
  name || error(`Cannot resolver the name of ${component.type}`);

  const definitionField = outputCtx.constantPool.propertyNameOf(DefinitionKind.Component);

  const summary = component.toSummary();
  const res = compileIvyComponent({
    name,
    type: outputCtx.importExpr(component.type.reference),
    selector: component.selector,
    deps: depsFromGlobalMetadata(component.type, outputCtx, reflector),
    queries: queriesFromGlobalMetadata(component.queries, outputCtx),
    viewQueries: queriesFromGlobalMetadata(component.viewQueries, outputCtx),
    template: '',
    host: {
      attributes: component.hostAttributes,
      listeners: summary.hostListeners,
      properties: summary.hostProperties,
    },
    inputs: component.inputs,
    outputs: component.outputs,
  }, outputCtx.constantPool, bindingParser);

  // Create the partial class to be merged with the actual class.
  outputCtx.statements.push(new o.ClassStmt(
      name, null,
      [new o.ClassField(
          definitionField, o.INFERRED_TYPE, [o.StmtModifier.Static], res.expression)],
      [], new o.ClassMethod(null, [], []), []));
}

function getQueryPredicate(query: IvyQueryMetadata, constantPool: ConstantPool): o.Expression {
  if (Array.isArray(query.selectors)) {
    return constantPool.getConstLiteral(
      o.literalArr(query.selectors.map(selector => o.literal(selector) as o.Expression))
    );
  } else {
    return query.selectors;
  }
}

function depsFromGlobalMetadata(type: CompileTypeMetadata, outputCtx: OutputContext, reflector: CompileReflector): IvyDependencyMetadata[] {
  const deps: IvyDependencyMetadata[] = [];
  const elementRef = reflector.resolveExternalReference(Identifiers.ElementRef);
  const templateRef = reflector.resolveExternalReference(Identifiers.TemplateRef);
  const viewContainerRef = reflector.resolveExternalReference(Identifiers.ViewContainerRef);
  const injectorRef = reflector.resolveExternalReference(Identifiers.Injector);
  for (let dependency of type.diDeps) {
    if (dependency.token) {
      const tokenRef = tokenReference(dependency.token);
      let resolved: IvyResolvedDependency = IvyResolvedDependency.Token;
      if (tokenRef === elementRef) {
        resolved = IvyResolvedDependency.ElementRef;
      } else if (tokenRef === templateRef) {
        resolved = IvyResolvedDependency.TemplateRef;
      } else if (tokenRef === viewContainerRef) {
        resolved = IvyResolvedDependency.ViewContainerRef;
      } else if (tokenRef === injectorRef) {
        resolved = IvyResolvedDependency.Injector;
      } else if (dependency.isAttribute) {
        resolved = IvyResolvedDependency.Attribute;
      }

      const token =
          tokenRef instanceof StaticSymbol ? outputCtx.importExpr(tokenRef) : o.literal(tokenRef);

      deps.push({
        token,
        resolved,
        host: !!dependency.isHost,
        optional: !!dependency.isOptional,
        self: !!dependency.isSelf,
        skipSelf: !!dependency.isSkipSelf,
      });
    } else {
      unsupported('dependency without a token');
    }
  }

  return deps;
}

function queriesFromGlobalMetadata(queries: CompileQueryMetadata[], outputCtx: OutputContext): IvyQueryMetadata[] {
  return queries.map(query => {
    return {
      propertyName: query.propertyName,
      first: query.first,
      selectors: selectorsFromGlobalMetadata(query.selectors, outputCtx),
      descendants: query.descendants,
      read: null,
    };
  });
}

function selectorsFromGlobalMetadata(selectors: CompileTokenMetadata[], outputCtx: OutputContext): o.Expression | string[] {
  if (selectors.length > 1 || (selectors.length == 1 && selectors[0].value)) {
    const selectorStrings = selectors.map(value => value.value as string);
    selectorStrings.some(value => !value) && error('Found a type among the string selectors expected');
    return outputCtx.constantPool.getConstLiteral(
        o.literalArr(selectorStrings.map(value => o.literal(value))));
  }

  if (selectors.length == 1) {
    const first = selectors[0];
    if (first.identifier) {
      return outputCtx.importExpr(first.identifier.reference);
    }
  }

  error('Unexpected query form');
  return o.NULL_EXPR;
}

function createQueryDefinitions(meta: IvyDirectiveMetadata, constantPool: ConstantPool): o.Expression[] {
  const queryDefinitions: o.Expression[] = [];
  for (let i = 0; i < meta.queries.length; i++) {
    const query = meta.queries[i];
    const predicate = getQueryPredicate(query, constantPool);

    // e.g. r3.Q(null, somePredicate, false) or r3.Q(null, ['div'], false)
    const parameters = [
      o.literal(null, o.INFERRED_TYPE),
      predicate,
      o.literal(query.descendants),
    ];

    if (query.read) {
      parameters.push(query.read);
    }

    queryDefinitions.push(o.importExpr(R3.query).callFn(parameters));
  }
  return queryDefinitions;
}

function extractFlags(dependency: CompileDiDependencyMetadata): core.InjectFlags {
  let flags = core.InjectFlags.Default;
  if (dependency.isHost) {
    flags |= core.InjectFlags.Host;
  }
  if (dependency.isOptional) {
    flags |= core.InjectFlags.Optional;
  }
  if (dependency.isSelf) {
    flags |= core.InjectFlags.Self;
  }
  if (dependency.isSkipSelf) {
    flags |= core.InjectFlags.SkipSelf;
  }
  if (dependency.isValue) {
    unsupported('value dependencies');
  }
  return flags;
}

// Turn a directive selector into an R3-compatible selector for directive def
function createDirectiveSelector(selector: string): o.Expression {
  return asLiteral(core.parseSelectorToR3Selector(selector));
}

function createHostAttributesArray(
    meta: IvyDirectiveMetadata): o.Expression|null {
  const values: o.Expression[] = [];
  const attributes = meta.host.attributes;
  for (let key of Object.getOwnPropertyNames(attributes)) {
    const value = attributes[key];
    values.push(o.literal(key), o.literal(value));
  }
  if (values.length > 0) {
    return o.literalArr(values);
  }
  return null;
}

// Return a host binding function or null if one is not necessary.
function createHostBindingsFunction(
    meta: IvyDirectiveMetadata, bindingParser: BindingParser): o.Expression|null {
  const statements: o.Statement[] = [];

  const temporary = temporaryAllocator(statements, TEMPORARY_NAME);

  const hostBindingSourceSpan = meta.type.sourceSpan!;

  // Calculate the queries
  for (let index = 0; index < meta.queries.length; index++) {
    const query = meta.queries[index];

    // e.g. r3.qR(tmp = r3.ld(dirIndex)[1]) && (r3.ld(dirIndex)[0].someDir = tmp);
    const getDirectiveMemory = o.importExpr(R3.load).callFn([o.variable('dirIndex')]);
    // The query list is at the query index + 1 because the directive itself is in slot 0.
    const getQueryList = getDirectiveMemory.key(o.literal(index + 1));
    const assignToTemporary = temporary().set(getQueryList);
    const callQueryRefresh = o.importExpr(R3.queryRefresh).callFn([assignToTemporary]);
    const updateDirective = getDirectiveMemory.key(o.literal(0, o.INFERRED_TYPE))
                                .prop(query.propertyName)
                                .set(query.first ? temporary().prop('first') : temporary());
    const andExpression = callQueryRefresh.and(updateDirective);
    statements.push(andExpression.toStmt());
  }

 const directiveSummary = metadataAsSummary(meta);

  // Calculate the host property bindings
  const bindings = bindingParser.createBoundHostProperties(directiveSummary, hostBindingSourceSpan);
  const bindingContext = o.importExpr(R3.load).callFn([o.variable('dirIndex')]);
  if (bindings) {
    for (const binding of bindings) {
      const bindingExpr = convertPropertyBinding(
          null, bindingContext, binding.expression, 'b', BindingForm.TrySimple,
          () => error('Unexpected interpolation'));
      statements.push(...bindingExpr.stmts);
      statements.push(o.importExpr(R3.elementProperty)
                          .callFn([
                            o.variable('elIndex'),
                            o.literal(binding.name),
                            o.importExpr(R3.bind).callFn([bindingExpr.currValExpr]),
                          ])
                          .toStmt());
    }
  }

  // Calculate host event bindings
  const eventBindings =
      bindingParser.createDirectiveHostEventAsts(directiveSummary, hostBindingSourceSpan);
  if (eventBindings) {
    for (const binding of eventBindings) {
      const bindingExpr = convertActionBinding(
          null, bindingContext, binding.handler, 'b', () => error('Unexpected interpolation'));
      const bindingName = binding.name && sanitizeIdentifier(binding.name);
      const typeName = meta.name;
      const functionName =
          typeName && bindingName ? `${typeName}_${bindingName}_HostBindingHandler` : null;
      const handler = o.fn(
          [new o.FnParam('$event', o.DYNAMIC_TYPE)],
          [...bindingExpr.stmts, new o.ReturnStatement(bindingExpr.allowDefault)], o.INFERRED_TYPE,
          null, functionName);
      statements.push(
          o.importExpr(R3.listener).callFn([o.literal(binding.name), handler]).toStmt());
    }
  }

  if (statements.length > 0) {
    const typeName = meta.name;
    return o.fn(
        [
          new o.FnParam('dirIndex', o.NUMBER_TYPE),
          new o.FnParam('elIndex', o.NUMBER_TYPE),
        ],
        statements, o.INFERRED_TYPE, null, typeName ? `${typeName}_HostBindings` : null);
  }

  return null;
}

function metadataAsSummary(meta: IvyDirectiveMetadata): CompileDirectiveSummary {
  return meta as any;
}
