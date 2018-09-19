import * as ts from 'typescript';

import {TmplAstNode, TmplAstElement, Directive} from '@angular/compiler';

import {TypeCheckBlockMetadata, DirectiveTypecheckData} from './api';

type TypeCheckDirective = Directive<DirectiveTypecheckData>;

export function generateTypeCheckBlock(node: ts.ClassDeclaration, meta: TypeCheckBlockMetadata): ts.FunctionDeclaration {
  return ts.createFunctionDeclaration(
    /* decorators */ undefined,
    /* modifiers */ undefined,
    /* asteriskToken */ undefined,
    /* name */ meta.fnName,
    /* typeParameters */ node.typeParameters,
    /* parameters */ [createCtxParam(node)],
    /* type */ undefined,
    /* body */ ts.createBlock([]),
  );
}

/**
 * Create the `ctx` parameter to the top-level TCB function.
 */
function createCtxParam(node: ts.ClassDeclaration): ts.ParameterDeclaration {
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

function generateTypeCheckBody(node: TmplAstNode[], context: TcbContext) {
}

interface TcbContext {

}

interface TcbContext {
  allocateId(): ts.Identifier;
  addStatement(stmt: ts.Statement): void;
  getElementId(el: TmplAstElement): ts.Identifier|null;
  getDirectiveId(el: TmplAstElement, dir: TypeCheckDirective): ts.Identifier|null;
}

interface TcbElementData {
  htmlNode: ts.Identifier|null;
  directives: Map<TypeCheckDirective, ts.Identifier>|null;
}

class RootTcbContext implements TcbContext {
  private statements: ts.Statement[] = [];
  private nextId = 1;

  addStatement(stmt: ts.Statement): void {
    this.statements.push(stmt);
  }

  getElementId(el: TmplAstElement): null {
    return null;
  }

  getDirectiveId(el: TmplAstElement, dir: TypeCheckDirective): null {
    return null;
  }

  allocateId(): ts.Identifier {
    return ts.createIdentifier(`_t${this.nextId++}`);
  }
}

class NestedTcbContext implements TcbContext {
  private elementData = new Map<TmplAstElement, TcbElementData>();
  constructor(private delegate: TcbContext) {}

  allocateId(): ts.Identifier {
    return this.delegate.allocateId();
  }

  addStatement(stmt: ts.Statement) {
    // Statements always propagate up to the top level.
    this.delegate.addStatement(stmt);
  }

  writeElement(el: TmplAstElement): ts.Identifier {
    const data = this.getElementData(el, true);
    if (data.htmlNode !== null) {
      return data.htmlNode;
    }

    const id = data.htmlNode = this.allocateId();

    const element = tsCreateElement(el.name);

    

    return null!;
  }

  getElementId(el: TmplAstElement): ts.Identifier|null {
    const data = this.getElementData(el, false);
    if (data !== null && data.htmlNode !== null) {
      return data.htmlNode;
    }
    return this.delegate.getElementId(el);
  }

  getDirectiveId(el: TmplAstElement, dir: TypeCheckDirective): ts.Identifier|null {
    const data = this.getElementData(el, false);
    if (data !== null && data.directives !== null && data.directives.has(dir)) {
      return data.directives.get(dir)!;
    }
    return this.delegate.getDirectiveId(el, dir);
  }

  writeDirective(el: TmplAstElement, dir: TypeCheckDirective): ts.Identifier {
    return null!;
  }

  allocateElementId(el: TmplAstElement): ts.Identifier {
    return null!;
  }
  allocateDirectiveId(el: TmplAstElement, dir: TypeCheckDirective): ts.Identifier {
    return null!;
  }

  private getElementData(el: TmplAstElement, alloc: true): TcbElementData;
  private getElementData(el: TmplAstElement, alloc: false): TcbElementData|null;
  private getElementData(el: TmplAstElement, alloc: boolean): TcbElementData|null {
    if (alloc && !this.elementData.has(el)) {
      this.elementData.set(el, {htmlNode: null, directives: null});
    }
    return this.elementData.get(el) || null;
  }
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