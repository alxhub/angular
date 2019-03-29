/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {AST, BindingPipe, BindingType, BoundTarget, ExpressionType, ExternalExpr, ImplicitReceiver, PropertyRead, SafePropertyRead, TmplAstBoundAttribute, TmplAstBoundText, TmplAstElement, TmplAstNode, TmplAstReference, TmplAstTemplate, TmplAstTextAttribute, TmplAstVariable, Type} from '@angular/compiler';
import * as ts from 'typescript';

import {NOOP_DEFAULT_IMPORT_RECORDER, Reference, ReferenceEmitter} from '../../imports';
import {ClassDeclaration} from '../../reflection';
import {ImportManager, translateExpression, translateType} from '../../translator';

import {TypeCheckBlockMetadata, TypeCheckableDirectiveMeta, TypeCheckingConfig} from './api';
import {Environment} from './environment';
import {astToTypescript} from './expression';
import {checkIfClassIsExported, checkIfGenericTypesAreUnbound, tsCallMethod, tsCastToAny, tsCreateElement, tsCreateVariable, tsDeclareVariable} from './ts_util';



/**
 * Given a `ts.ClassDeclaration` for a component, and metadata regarding that component, compose a
 * "type check block" function.
 *
 * When passed through TypeScript's TypeChecker, type errors that arise within the type check block
 * function indicate issues in the template itself.
 *
 * @param node the TypeScript node for the component class.
 * @param meta metadata about the component's template and the function being generated.
 * @param importManager an `ImportManager` for the file into which the TCB will be written.
 */
export function generateTypeCheckBlock(
    env: Environment, ref: Reference<ClassDeclaration<ts.ClassDeclaration>>, name: ts.Identifier,
    meta: TypeCheckBlockMetadata): ts.FunctionDeclaration {
  const tcb = new Context(env, meta.boundTarget, meta.pipes);
  const scope = Scope.forNodes(tcb, null, tcb.boundTarget.target.template !);
  const ctxRawType = env.referenceType(ref);
  if (!ts.isTypeReferenceNode(ctxRawType)) {
    throw new Error(
        `Expected TypeReferenceNode when referencing the ctx param for ${ref.debugName}`);
  }
  const paramList = [tcbCtxParam(ref.node, ctxRawType.typeName)];

  const scopeStatements = scope.render();
  const innerBody = ts.createBlock([
    ...env.getPreludeStatements(),
    ...scopeStatements,
  ]);

  // Wrap the body in an "if (true)" expression. This is unnecessary but has the effect of causing
  // the `ts.Printer` to format the type-check block nicely.
  const body = ts.createBlock([ts.createIf(ts.createTrue(), innerBody, undefined)]);

  return ts.createFunctionDeclaration(
      /* decorators */ undefined,
      /* modifiers */ undefined,
      /* asteriskToken */ undefined,
      /* name */ name,
      /* typeParameters */ ref.node.typeParameters,
      /* parameters */ paramList,
      /* type */ undefined,
      /* body */ body);
}

abstract class TcbOp { abstract execute(): ts.Expression|null; }

class TcbElementOp extends TcbOp {
  constructor(private tcb: Context, private scope: Scope, private el: TmplAstElement) { super(); }

  execute(): ts.Identifier {
    const id = this.tcb.allocateId();
    // Add the declaration of the element using document.createElement.
    this.scope.addStatement(tsCreateVariable(id, tsCreateElement(this.el.name)));
    return id;
  }
}

class TcbVariableOp extends TcbOp {
  constructor(
      private tcb: Context, private scope: Scope, private node: TmplAstTemplate,
      private variable: TmplAstVariable) {
    super();
  }

  execute(): ts.Identifier {
    // Look for a context variable for the template.
    const ctx = this.scope.resolve(this.node);

    // Allocate an identifier for the TmplAstVariable, and initialize it to a read of the variable
    // on the template context.
    const id = this.tcb.allocateId();
    const initializer = ts.createPropertyAccess(
        /* expression */ ctx,
        /* name */ this.variable.value);

    // Declare the variable, and return its identifier.
    this.scope.addStatement(tsCreateVariable(id, initializer));
    return id;
  }
}

class TcbTemplateBodyOp extends TcbOp {
  constructor(private tcb: Context, private scope: Scope, private node: TmplAstTemplate) {
    super();
  }
  execute(): null {
    // Create a new Scope to represent bindings captured in the template.
    const tmplScope = Scope.forNodes(this.tcb, this.scope, this.node);

    // Allocate a template ctx variable and declare it with an 'any' type.
    const ctx = this.tcb.allocateId();
    this.scope.bindTemplateCtx(this.node, ctx);
    const type = ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
    this.scope.addStatement(tsDeclareVariable(ctx, type));

    // An `if` will be constructed, within which the template's children will be type checked. The
    // `if` is used for two reasons: it creates a new syntactic scope, isolating variables declared
    // in the template's TCB from the outer context, and it allows any directives on the templates
    // to perform type narrowing of either expressions or the template's context.

    // The guard is the `if` block's condition. It's usually set to `true` but directives that exist
    // on the template can trigger extra guard expressions that serve to narrow types within the
    // `if`. `guard` is calculated by starting with `true` and adding other conditions as needed.
    // Collect these into `guards` by processing the directives.
    const directiveGuards: ts.Expression[] = [];

    const directives = this.tcb.boundTarget.getDirectivesOfNode(this.node);
    if (directives !== null) {
      for (const dir of directives) {
        const dirInstId = this.scope.resolve(this.node, dir);
        const dirId = this.tcb.env.reference(dir.ref);

        // There are two kinds of guards. Template guards (ngTemplateGuards) allow type narrowing of
        // the expression passed to an @Input of the directive. Scan the directive to see if it has
        // any template guards, and generate them if needed.
        dir.ngTemplateGuards.forEach(inputName => {
          // For each template guard function on the directive, look for a binding to that input.
          const boundInput = this.node.inputs.find(i => i.name === inputName) ||
              this.node.templateAttrs.find(
                  (i: TmplAstTextAttribute | TmplAstBoundAttribute): i is TmplAstBoundAttribute =>
                      i instanceof TmplAstBoundAttribute && i.name === inputName);
          if (boundInput !== undefined) {
            // If there is such a binding, generate an expression for it.
            const expr = tcbExpression(boundInput.value, this.tcb, this.scope);
            // Call the guard function on the directive with the directive instance and that
            // expression.
            const guardInvoke = tsCallMethod(dirId, `ngTemplateGuard_${inputName}`, [
              dirInstId,
              expr,
            ]);
            directiveGuards.push(guardInvoke);
          }
        });

        // The second kind of guard is a template context guard. This guard narrows the template
        // rendering context variable `ctx`.
        if (dir.hasNgTemplateContextGuard && this.tcb.env.config.applyTemplateContextGuards) {
          const guardInvoke = tsCallMethod(dirId, 'ngTemplateContextGuard', [dirInstId, ctx]);
          directiveGuards.push(guardInvoke);
        }
      }
    }

    // By default the guard is simply `true`.
    let guard: ts.Expression = ts.createTrue();

    // If there are any guards from directives, use them instead.
    if (directiveGuards.length > 0) {
      // Pop the first value and use it as the initializer to reduce(). This way, a single guard
      // will be used on its own, but two or more will be combined into binary expressions.
      guard = directiveGuards.reduce(
          (expr, dirGuard) =>
              ts.createBinary(expr, ts.SyntaxKind.AmpersandAmpersandToken, dirGuard),
          directiveGuards.pop() !);
    }

    // Construct the `if` block for the template with the generated guard expression.
    const tmplIf = ts.createIf(
        /* expression */ guard,
        /* thenStatement */ ts.createBlock(tmplScope.render()));
    this.scope.addStatement(tmplIf);
    return null;
  }
}

class TcbTextInterpolationOp extends TcbOp {
  constructor(private tcb: Context, private scope: Scope, private node: TmplAstBoundText) {
    super();
  }

  execute(): null {
    const expr = tcbExpression(this.node.value, this.tcb, this.scope);
    this.scope.addStatement(ts.createExpressionStatement(expr));
    return null;
  }
}

class TcbDirectiveOp extends TcbOp {
  constructor(
      private tcb: Context, private scope: Scope, private node: TmplAstTemplate|TmplAstElement,
      private dir: TypeCheckableDirectiveMeta) {
    super();
  }

  execute(): ts.Identifier {
    debugger;
    const id = this.tcb.allocateId();
    const bindings = tcbGetInputBindingExpressions(this.node, this.dir, this.tcb, this.scope);

    // Call the type constructor of the directive to infer a type, and assign the directive
    // instance.
    const typeCtor = tcbCallTypeCtor(this.dir, this.tcb, bindings);
    this.scope.addStatement(tsCreateVariable(id, typeCtor));

    return id;
  }
}

class TcbUnclaimedInputsOp extends TcbOp {
  constructor(
      private tcb: Context, private scope: Scope, private node: TmplAstElement,
      private claimedInputs: Set<string>) {
    super();
  }

  execute(): null {
    // `this.inputs` contains only those bindings not matched by any directive. These bindings go to
    // the element itself.
    const elId = this.scope.resolve(this.node);
    for (const binding of this.node.inputs) {
      if (binding.type === BindingType.Property && this.claimedInputs.has(binding.name)) {
        // Skip this binding as it was claimed by a directive.
        continue;
      }

      let expr = tcbExpression(binding.value, this.tcb, this.scope);

      // If checking the type of bindings is disabled, cast the resulting expression to 'any' before
      // the assignment.
      if (!this.tcb.env.config.checkTypeOfBindings) {
        expr = tsCastToAny(expr);
      }

      if (binding.type === BindingType.Property) {
        if (binding.name !== 'style' && binding.name !== 'class') {
          // A direct binding to a property.
          const prop = ts.createPropertyAccess(elId, binding.name);
          const assign = ts.createBinary(prop, ts.SyntaxKind.EqualsToken, expr);
          this.scope.addStatement(ts.createStatement(assign));
        } else {
          this.scope.addStatement(ts.createExpressionStatement(expr));
        }
      } else {
        // A binding to an animation, attribute, class or style. For now, only validate the right-
        // hand side of the expression.
        // TODO: properly check class and style bindings.
        this.scope.addStatement(ts.createExpressionStatement(expr));
      }
    }

    return null;
  }
}

const CIRCULAR_EXPR = ts.createNonNullExpression(ts.createNull());

/**
 * Overall generation context for the type check block.
 *
 * `Context` handles operations during code generation which are global with respect to the whole
 * block. It's responsible for variable name allocation and management of any imports needed. It
 * also contains the template metadata itself.
 */
export class Context {
  private nextId = 1;

  constructor(
      readonly env: Environment, readonly boundTarget: BoundTarget<TypeCheckableDirectiveMeta>,
      private pipeMap: Map<string, Reference<ClassDeclaration<ts.ClassDeclaration>>>) {}

  /**
   * Allocate a new variable name for use within the `Context`.
   *
   * Currently this uses a monotonically increasing counter, but in the future the variable name
   * might change depending on the type of data being stored.
   */
  allocateId(): ts.Identifier { return ts.createIdentifier(`_t${this.nextId++}`); }

  getPipeByName(name: string): ts.Expression {
    if (!this.pipeMap.has(name)) {
      throw new Error(
          `Unknown pipe ${name} referenced in the AST but not included in generateTypeCheckBlock() pipe map`);
    }

    return this.env.pipeInst(this.pipeMap.get(name) !);
  }
}

/**
 * Local scope within the type check block for a particular template.
 *
 * The top-level template and each nested `<ng-template>` have their own `Scope`, which exist in a
 * hierarchy. The structure of this hierarchy mirrors the syntactic scopes in the generated type
 * check block, where each nested template is encased in an `if` structure.
 *
 * As a template is processed in a given `Scope`, statements are added via `addStatement()`. When
 * this processing is complete, the `Scope` can be turned into a `ts.Block` via `getBlock()`.
 */
export class Scope {
  private opQueue: (TcbOp|ts.Expression|null)[] = [];

  private opMap = new Map<TmplAstElement, number>();
  private dirOpMap =
      new Map<TmplAstElement|TmplAstTemplate, Map<TypeCheckableDirectiveMeta, number>>();

  /**
   * Map of immediately nested <ng-template>s (within this `Scope`) to the `ts.Identifier` of their
   * rendering contexts.
   */
  private templateCtx = new Map<TmplAstTemplate, ts.Identifier>();

  /**
   * Map of variables declared on the template that created this `Scope` to their `ts.Identifier`s
   * within the TCB.
   */
  private varMap = new Map<TmplAstVariable, number>();

  /**
   * Statements for this template.
   */
  private statements: ts.Statement[] = [];

  private constructor(private tcb: Context, private parent: Scope|null = null) {}

  static forNodes(
      tcb: Context, parent: Scope|null, templateOrNodes: TmplAstTemplate|(TmplAstNode[])): Scope {
    const scope = new Scope(tcb, parent);

    let children: TmplAstNode[];
    if (templateOrNodes instanceof TmplAstTemplate) {
      for (const v of templateOrNodes.variables) {
        const opIndex = scope.opQueue.push(new TcbVariableOp(tcb, scope, templateOrNodes, v)) - 1;
        scope.varMap.set(v, opIndex);
      }
      children = templateOrNodes.children;
    } else {
      children = templateOrNodes;
    }
    for (const node of children) {
      scope.appendNode(node);
    }
    return scope;
  }

  bindTemplateCtx(node: TmplAstTemplate, id: ts.Identifier): void {
    this.templateCtx.set(node, id);
  }

  resolve(
      ref: TmplAstElement|TmplAstTemplate|TmplAstVariable,
      directive?: TypeCheckableDirectiveMeta): ts.Expression {
    const res = this.resolveLocal(ref, directive);
    if (res !== null) {
      return res;
    } else if (this.parent !== null) {
      return this.parent.resolve(ref, directive);
    } else {
      throw new Error(`Could not resolve ${ref} / ${directive}`);
    }
  }

  /**
   * Add a statement to this scope.
   */
  addStatement(stmt: ts.Statement): void { this.statements.push(stmt); }

  /**
   * Get the statements.
   */
  render(): ts.Statement[] {
    for (let i = 0; i < this.opQueue.length; i++) {
      this.executeOp(i);
    }
    return this.statements;
  }

  private resolveLocal(
      ref: TmplAstElement|TmplAstTemplate|TmplAstVariable,
      directive?: TypeCheckableDirectiveMeta): ts.Expression|null {
    if (ref instanceof TmplAstVariable && this.varMap.has(ref)) {
      return this.resolveOp(this.varMap.get(ref) !);
    } else if (
        ref instanceof TmplAstTemplate && directive === undefined && this.templateCtx.has(ref)) {
      return this.templateCtx.get(ref) !;
    } else if (
        (ref instanceof TmplAstElement || ref instanceof TmplAstTemplate) &&
        directive !== undefined && this.dirOpMap.has(ref)) {
      const dirMap = this.dirOpMap.get(ref) !;
      if (dirMap.has(directive)) {
        return this.resolveOp(dirMap.get(directive) !);
      } else {
        return null;
      }
    } else if (ref instanceof TmplAstElement && this.opMap.has(ref as TmplAstElement)) {
      return this.resolveOp(this.opMap.get(ref) !);
    } else {
      return null;
    }
  }

  private resolveOp(opIndex: number): ts.Expression {
    const res = this.executeOp(opIndex);
    if (res === null) {
      throw new Error(`Error resolving operation, got null`);
    }

    return res;
  }

  private executeOp(opIndex: number): ts.Expression|null {
    const op = this.opQueue[opIndex];
    if (!(op instanceof TcbOp)) {
      return op;
    }

    this.opQueue[opIndex] = CIRCULAR_EXPR;
    const res = op.execute();
    this.opQueue[opIndex] = res;
    return res;
  }

  private appendNode(node: TmplAstNode): void {
    if (node instanceof TmplAstElement) {
      const opIndex = this.opQueue.push(new TcbElementOp(this.tcb, this, node)) - 1;
      this.opMap.set(node, opIndex);
      this.appendDirectivesAndInputsOfNode(node);
      for (const child of node.children) {
        this.appendNode(child);
      }
    } else if (node instanceof TmplAstTemplate) {
      // Template children are rendered in a child scope.
      this.appendDirectivesAndInputsOfNode(node);
      if (this.tcb.env.config.checkTemplateBodies) {
        this.opQueue.push(new TcbTemplateBodyOp(this.tcb, this, node));
      }
    } else if (node instanceof TmplAstBoundText) {
      this.opQueue.push(new TcbTextInterpolationOp(this.tcb, this, node));
    }
  }

  private appendDirectivesAndInputsOfNode(node: TmplAstElement|TmplAstTemplate): void {
    // Collect all the inputs on the element.
    const claimedInputs = new Set<string>();
    const directives = this.tcb.boundTarget.getDirectivesOfNode(node);
    if (directives === null || directives.length === 0) {
      // If there are no directives, then all inputs are unclaimed inputs, so queue an operation
      // to add them if needed.
      if (node instanceof TmplAstElement) {
        this.opQueue.push(new TcbUnclaimedInputsOp(this.tcb, this, node, claimedInputs));
      }
      return;
    }

    const dirMap = new Map<TypeCheckableDirectiveMeta, number>();
    for (const dir of directives) {
      const dirIndex = this.opQueue.push(new TcbDirectiveOp(this.tcb, this, node, dir)) - 1;
      dirMap.set(dir, dirIndex);
    }
    this.dirOpMap.set(node, dirMap);

    // After expanding the directives, we might need to queue an operation to check any unclaimed
    // inputs.
    if (node instanceof TmplAstElement) {
      for (const dir of directives) {
        for (const fieldName of Object.keys(dir.inputs)) {
          const value = dir.inputs[fieldName];
          claimedInputs.add(Array.isArray(value) ? value[0] : value);
        }
      }

      this.opQueue.push(new TcbUnclaimedInputsOp(this.tcb, this, node, claimedInputs));
    }
  }
}

/**
 * Create the `ctx` parameter to the top-level TCB function.
 *
 * This is a parameter with a type equivalent to the component type, with all generic type
 * parameters listed (without their generic bounds).
 */
function tcbCtxParam(
    node: ClassDeclaration<ts.ClassDeclaration>, name: ts.EntityName): ts.ParameterDeclaration {
  let typeArguments: ts.TypeNode[]|undefined = undefined;
  // Check if the component is generic, and pass generic type parameters if so.
  if (node.typeParameters !== undefined) {
    typeArguments =
        node.typeParameters.map(param => ts.createTypeReferenceNode(param.name, undefined));
  }
  const type = ts.createTypeReferenceNode(name, typeArguments);
  return ts.createParameter(
      /* decorators */ undefined,
      /* modifiers */ undefined,
      /* dotDotDotToken */ undefined,
      /* name */ 'ctx',
      /* questionToken */ undefined,
      /* type */ type,
      /* initializer */ undefined);
}

/**
 * Process an `AST` expression and convert it into a `ts.Expression`, generating references to the
 * correct identifiers in the current scope.
 */
function tcbExpression(ast: AST, tcb: Context, scope: Scope): ts.Expression {
  // `astToTypescript` actually does the conversion. A special resolver `tcbResolve` is passed which
  // interprets specific expression nodes that interact with the `ImplicitReceiver`. These nodes
  // actually refer to identifiers within the current scope.
  return astToTypescript(ast, (ast) => tcbResolve(ast, tcb, scope), tcb.env.config);
}

/**
 * Call the type constructor of a directive instance on a given template node, inferring a type for
 * the directive instance from any bound inputs.
 */
function tcbCallTypeCtor(
    dir: TypeCheckableDirectiveMeta, tcb: Context, bindings: TcbBinding[]): ts.Expression {
  const typeCtor = tcb.env.typeCtorFor(dir);

  // Construct an array of `ts.PropertyAssignment`s for each input of the directive that has a
  // matching binding.
  const members = bindings.map(({field, expression}) => {
    if (!tcb.env.config.checkTypeOfBindings) {
      expression = tsCastToAny(expression);
    }
    return ts.createPropertyAssignment(field, expression);
  });

  // Call the `ngTypeCtor` method on the directive class, with an object literal argument created
  // from the matched inputs.
  return ts.createCall(
      /* expression */ typeCtor,
      /* typeArguments */ undefined,
      /* argumentsArray */[ts.createObjectLiteral(members)]);
}

interface TcbBinding {
  field: string;
  property: string;
  expression: ts.Expression;
}

function tcbGetInputBindingExpressions(
    el: TmplAstElement | TmplAstTemplate, dir: TypeCheckableDirectiveMeta, tcb: Context,
    scope: Scope): TcbBinding[] {
  const bindings: TcbBinding[] = [];
  // `dir.inputs` is an object map of field names on the directive class to property names.
  // This is backwards from what's needed to match bindings - a map of properties to field names
  // is desired. Invert `dir.inputs` into `propMatch` to create this map.
  const propMatch = new Map<string, string>();
  const inputs = dir.inputs;
  Object.keys(inputs).forEach(key => {
    Array.isArray(inputs[key]) ? propMatch.set(inputs[key][0], key) :
                                 propMatch.set(inputs[key] as string, key);
  });

  el.inputs.forEach(processAttribute);
  if (el instanceof TmplAstTemplate) {
    el.templateAttrs.forEach(processAttribute);
  }
  return bindings;

  /**
   * Add a binding expression to the map for each input/template attribute of the directive that has
   * a matching binding.
   */
  function processAttribute(attr: TmplAstBoundAttribute | TmplAstTextAttribute): void {
    if (attr instanceof TmplAstBoundAttribute && propMatch.has(attr.name)) {
      // Produce an expression representing the value of the binding.
      const expr = tcbExpression(attr.value, tcb, scope);
      // Call the callback.
      bindings.push({
        property: attr.name,
        field: propMatch.get(attr.name) !,
        expression: expr,
      });
    }
  }
}

/**
 * Resolve an `AST` expression within the given scope.
 *
 * Some `AST` expressions refer to top-level concepts (references, variables, the component
 * context). This method assists in resolving those.
 */
function tcbResolve(ast: AST, tcb: Context, scope: Scope): ts.Expression|null {
  if (ast instanceof PropertyRead && ast.receiver instanceof ImplicitReceiver) {
    // Check whether the template metadata has bound a target for this expression. If so, then
    // resolve that target. If not, then the expression is referencing the top-level component
    // context.
    const binding = tcb.boundTarget.getExpressionTarget(ast);
    if (binding !== null) {
      // This expression has a binding to some variable or reference in the template. Resolve it.
      if (binding instanceof TmplAstVariable) {
        return scope.resolve(binding);
      } else if (binding instanceof TmplAstReference) {
        const target = tcb.boundTarget.getReferenceTarget(binding);
        if (target === null) {
          throw new Error(`Unbound reference? ${binding.name}`);
        }

        if (target instanceof TmplAstElement) {
          return scope.resolve(target);
        } else if (target instanceof TmplAstTemplate) {
          // For direct template references.
          let value: ts.Expression = ts.createNull();
          value = ts.createAsExpression(value, ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword));
          value = ts.createAsExpression(value, tcb.env.referenceCoreType('TemplateRef', 1));
          value = ts.createParen(value);
          return value;
        } else {
          return scope.resolve(target.node, target.directive);
        }
      } else {
        throw new Error(`Unreachable: ${binding}`);
      }
    } else {
      // This is a PropertyRead(ImplicitReceiver) and probably refers to a property access on the
      // component context. Let it fall through resolution here so it will be caught when the
      // ImplicitReceiver is resolved in the branch below.
      return null;
    }
  } else if (ast instanceof ImplicitReceiver) {
    // AST instances representing variables and references look very similar to property reads from
    // the component context: both have the shape PropertyRead(ImplicitReceiver, 'propertyName').
    //
    // `tcbExpression` will first try to `tcbResolve` the outer PropertyRead. If this works, it's
    // because the `BoundTarget` found an expression target for the whole expression, and therefore
    // `tcbExpression` will never attempt to `tcbResolve` the ImplicitReceiver of that PropertyRead.
    //
    // Therefore if `tcbResolve` is called on an `ImplicitReceiver`, it's because no outer
    // PropertyRead resolved to a variable or reference, and therefore this is a property read on
    // the component context itself.
    return ts.createIdentifier('ctx');
  } else if (ast instanceof BindingPipe) {
    const expr = tcbExpression(ast.exp, tcb, scope);
    const pipe = tcb.getPipeByName(ast.name);
    const args = ast.args.map(arg => tcbExpression(arg, tcb, scope));
    return tsCallMethod(pipe, 'transform', [expr, ...args]);
  } else {
    // This AST isn't special after all.
    return null;
  }
}

export function requiresInlineTypeCheckBlock(node: ClassDeclaration<ts.ClassDeclaration>): boolean {
  // In order to qualify for a declared TCB (not inline) two conditions must be met:
  // 1) the class must be exported
  // 2) it must not have constrained generic types
  if (!checkIfClassIsExported(node)) {
    // Condition 1 is false, the class is not exported.
    return true;
  } else if (!checkIfGenericTypesAreUnbound(node)) {
    // Condition 2 is false, the class has constrained generic types
    return true;
  } else {
    return false;
  }
}
