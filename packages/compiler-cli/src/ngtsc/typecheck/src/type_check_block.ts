import * as ts from 'typescript';

import {AST, BoundTarget, TmplAstNode, TmplAstElement, TmplAstBoundText, PropertyRead, ImplicitReceiver, TmplAstTemplate, Directive} from '@angular/compiler';

import {TypeCheckBlockMetadata, DirectiveTypecheckData} from './api';
import {astToTypescript} from './expression';
import {ImportMode, Reference} from '../../metadata';
import {ImportManager, translateExpression} from '../../translator';

type TypeCheckDirective = Directive<DirectiveTypecheckData>;

export function generateTypeCheckBlock(node: ts.ClassDeclaration, meta: TypeCheckBlockMetadata, im: ImportManager): ts.FunctionDeclaration {
  const tcb = new Context(meta.boundTarget, node.getSourceFile(), im);
  const scope = new Scope(tcb);
  const body = ts.createBlock(tcbBodyForNodes(meta.boundTarget.target.template!, tcb, scope));

  return ts.createFunctionDeclaration(
    /* decorators */ undefined,
    /* modifiers */ undefined,
    /* asteriskToken */ undefined,
    /* name */ meta.fnName,
    /* typeParameters */ node.typeParameters,
    /* parameters */ [tcbCtxParam(node)],
    /* type */ undefined,
    /* body */ body,
  );
}

/**
 * Create the `ctx` parameter to the top-level TCB function.
 */
function tcbCtxParam(node: ts.ClassDeclaration): ts.ParameterDeclaration {
  let typeArguments: ts.TypeNode[]|undefined = undefined;
  if (node.typeParameters !== undefined) {
    typeArguments = node.typeParameters.map(param => ts.createTypeReferenceNode(param.name, undefined));
  }
  const type = ts.createTypeReferenceNode(node.name!, typeArguments);
  return ts.createParameter(
    /* decorators */ undefined,
    /* modifiers */ undefined,
    /* dotDotDotToken */ undefined,
    /* name */ 'ctx',
    /* questionToken */ undefined,
    /* type */ type,
    /* initializer */ undefined,
  );
}

function tcbBodyForNodes(nodes: TmplAstNode[], tcb: Context, scope: Scope): ts.Statement[] {
  const statements: ts.Statement[] = [];
  tcbProcessNodes(nodes, tcb, statements, scope);
  return statements;
}

class Scope {
  private elementData = new Map<TmplAstElement|TmplAstTemplate, TcbElementData>();
  private templateCtx = new Map<TmplAstTemplate, ts.Identifier>();

  constructor(private tcb: Context, private parent: Scope|null = null) {}

  getElementId(el: TmplAstElement): ts.Identifier|null {
    const data = this.getElementData(el, false);
    if (data !== null && data.htmlNode !== null) {
      return data.htmlNode;
    }
    return this.parent !== null ? this.parent.getElementId(el) : null;
  }

  getDirectiveId(el: TmplAstElement|TmplAstTemplate, dir: TypeCheckDirective): ts.Identifier|null {
    const data = this.getElementData(el, false);
    if (data !== null && data.directives !== null && data.directives.has(dir)) {
      return data.directives.get(dir)!;
    }
    return this.parent !== null ? this.parent.getDirectiveId(el, dir) : null;
  }

  getTemplateCtx(tmpl: TmplAstTemplate): ts.Identifier|null {
    return this.templateCtx.get(tmpl) || (this.parent !== null ? this.parent.getTemplateCtx(tmpl) : null);
  }

  allocateElementId(el: TmplAstElement): ts.Identifier {
    const data = this.getElementData(el, true);
    if (data.htmlNode === null) {
      data.htmlNode = this.tcb.allocateId();
    }
    return data.htmlNode;
  }

  allocateDirectiveId(el: TmplAstElement|TmplAstTemplate, dir: TypeCheckDirective): ts.Identifier {
    const data = this.getElementData(el, true);
    if (data.directives === null) {
      data.directives = new Map<TypeCheckDirective, ts.Identifier>();
    }
    if (!data.directives.has(dir)) {
      data.directives.set(dir, this.tcb.allocateId());
    }
    return data.directives.get(dir)!;
  }

  allocateTemplateCtx(tmpl: TmplAstTemplate): ts.Identifier {
    if (!this.templateCtx.has(tmpl)) {
      this.templateCtx.set(tmpl, this.tcb.allocateId());
    }
    return this.templateCtx.get(tmpl)!;
  }

  private getElementData(el: TmplAstElement|TmplAstTemplate, alloc: true): TcbElementData;
  private getElementData(el: TmplAstElement|TmplAstTemplate, alloc: false): TcbElementData|null;
  private getElementData(el: TmplAstElement|TmplAstTemplate, alloc: boolean): TcbElementData|null {
    if (alloc && !this.elementData.has(el)) {
      this.elementData.set(el, {htmlNode: null, directives: null});
    }
    return this.elementData.get(el) || null;
  }
}

interface TcbElementData {
  htmlNode: ts.Identifier|null;
  directives: Map<TypeCheckDirective, ts.Identifier>|null;
}

class Context {
  private nextId = 1;
  
  constructor(readonly boundTarget: BoundTarget<DirectiveTypecheckData>, private sourceFile: ts.SourceFile, private importManager: ImportManager) {}

  allocateId(): ts.Identifier {
    return ts.createIdentifier(`_t${this.nextId++}`);
  }

  resolve(ast: AST, scope: Scope): ts.Identifier|null {
    // Short circuit if this isn't a property read.
    // TODO: handle property writes
    if (!(ast instanceof PropertyRead && ast.receiver instanceof ImplicitReceiver)) {
      return null;
    }
    // TODO: handle resolution of contexts.
    return ts.createIdentifier('ctx');
  }

  reference(ref: Reference<ts.Node>): ts.Expression {
    const ngExpr = ref.toExpression(this.sourceFile);
    if (ngExpr === null) {
      throw new Error(`Unreachable directive: ${ref.node}`);
    }
    return translateExpression(ngExpr, this.importManager);
  }
}

function tcbProcessElement(el: TmplAstElement, tcb: Context, statements: ts.Statement[], scope: Scope): ts.Identifier {
  let id = scope.getElementId(el);
  if (id !== null) {
    return id;
  }
  id = scope.allocateElementId(el);
  const initializer = tsCreateElement(el.name);
  statements.push(tsCreateVariable(id, initializer));
  return id;
}

function tcbProcessDirectives(el: TmplAstElement|TmplAstTemplate, tcb: Context, statements: ts.Statement[], scope: Scope): void {
  const directives = tcb.boundTarget.getDirectivesOfNode(el);
  if (directives === null) {
    return;
  }
  directives.forEach(dir => tcbProcessDirective(el, dir, tcb, statements, scope));
}

function tcbProcessDirective(el: TmplAstElement|TmplAstTemplate, dir: TypeCheckDirective, tcb: Context, statements: ts.Statement[], scope: Scope): ts.Identifier {
  const id = scope.allocateDirectiveId(el, dir);
  const initializer = tcbCallTypeCtor(el, dir, tcb, scope);
  statements.push(tsCreateVariable(id, initializer));
  return null!;
}

function tcbProcessNodes(nodes: TmplAstNode[], tcb: Context, statements: ts.Statement[], scope: Scope): void {
  nodes.forEach(node => {
    if (node instanceof TmplAstElement) {
      tcbProcessElement(node, tcb, statements, scope);
      tcbProcessDirectives(node, tcb, statements, scope);
      tcbProcessNodes(node.children, tcb, statements, scope);
    } else if (node instanceof TmplAstTemplate) {
      tcbProcessTemplateDeclaration(node, tcb, statements, scope);
    } else if (node instanceof TmplAstBoundText) {
      const expr = tcbExpression(node.value, tcb, scope);
      statements.push(ts.createStatement(expr));
    }
  });
}

function tcbProcessTemplateDeclaration(tmpl: TmplAstTemplate, tcb: Context, statements: ts.Statement[], scope: Scope) {
  // Create a new Scope to represent bindings captured in the template.
  const tmplScope = new Scope(tcb, scope);

  // Allocate a template ctx variable and declare it with an 'any' type.
  const ctx = tmplScope.allocateTemplateCtx(tmpl);
  const type = ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
  statements.push(tsDeclareVariable(ctx, type));

  // Process directives on the template.
  tcbProcessDirectives(tmpl, tcb, statements, scope);

  // Process the template itself (inside the inner Scope).
  const tmplStatements: ts.Statement[] = [];
  tcbProcessNodes(tmpl.children, tcb, tmplStatements, tmplScope);

  let guard: ts.Expression = ts.createTrue();
  const directives = tcb.boundTarget.getDirectivesOfNode(tmpl);
  if (directives !== null) {
    guard = directives.reduce((partialGuard, dir) => {
      const dirInstId = scope.getDirectiveId(tmpl, dir)!;
      const dirId = tcb.reference(dir.directive.ref);
      dir.directive.ngTemplateGuards.forEach(inputName => {
        const boundInput = tmpl.inputs.find(i => i.name === inputName);
        if (boundInput !== undefined) {
          const expr = tcbExpression(boundInput.value, tcb, scope);
          const guardInvoke = tsCallMethod(dirId, `ngTemplateGuard_${inputName}`, [
            dirInstId,
            expr,
          ]);
          partialGuard = ts.createBinary(
            partialGuard,
            ts.SyntaxKind.AmpersandAmpersandToken,
            guardInvoke
          );
        }
      });
      return partialGuard;
    }, guard);
  }

  // Construct an 'if' block for the template.
  const tmplIf = ts.createIf(
    /* expression */ guard,
    /* thenStatement */ ts.createBlock(tmplStatements),
  );
  statements.push(tmplIf);
}

function tcbExpression(ast: AST, tcb: Context, scope: Scope): ts.Expression {
  return astToTypescript(ast, (ast) => tcb.resolve(ast, scope));
}

function tcbCallTypeCtor(el: TmplAstElement|TmplAstTemplate, dir: TypeCheckDirective, tcb: Context, scope: Scope): ts.Expression {
  const dirId = tcb.reference(dir.directive.ref);
  return tsCallMethod(
    /* receiver */ dirId,
    /* methodName */ 'ngTypeCtor',
    /* args */ [ts.createObjectLiteral()],
  );
}

function tsCreateElement(tagName: string): ts.Expression {
  const createElement = ts.createPropertyAccess(
    /* expression */ ts.createIdentifier('document'),
    'createElement'
  );
  return ts.createCall(
    /* expression */ createElement,
    /* typeArguments */ undefined,
    /* argumentsArray */ [ts.createLiteral(tagName)],
  );
}

function tsDeclareVariable(id: ts.Identifier, type: ts.TypeNode): ts.VariableStatement {
  const decl = ts.createVariableDeclaration(
    /* name */ id,
    /* type */ type,
    /* initializer */ undefined,
  );
  return ts.createVariableStatement(
    /* modifiers */ [
      //ts.createModifier(ts.SyntaxKind.ConstKeyword)
    ],
    /* declarationList */ [decl],
  );
}


function tsCreateVariable(id: ts.Identifier, initializer: ts.Expression): ts.VariableStatement {
  const decl = ts.createVariableDeclaration(
    /* name */ id,
    /* type */ undefined,
    /* initializer */ initializer,
  );
  return ts.createVariableStatement(
    /* modifiers */ [
      //ts.createModifier(ts.SyntaxKind.ConstKeyword)
    ],
    /* declarationList */ [decl],
  );
}

function tsCallMethod(receiver: ts.Expression, methodName: string, args: ts.Expression[] = []) {
  const typeCtor = ts.createPropertyAccess(receiver, methodName);
  return ts.createCall(
    /* expression */ typeCtor,
    /* typeArguments */ undefined,
    /* argumentsArray */ args
  );  
}