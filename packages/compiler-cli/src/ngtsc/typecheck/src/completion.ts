/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {AbsoluteSourceSpan, AST, CssSelector, PropertyRead, TmplAstElement, TmplAstReference, TmplAstTemplate, TmplAstVariable} from '@angular/compiler/src/compiler';
import * as ts from 'typescript';

import {AbsoluteFsPath} from '../../file_system';
import {ComponentScopeReader} from '../../scope';
import {BindingCompletion, BindingCompletionMap, CompletionKind, GlobalCompletion, ReferenceCompletion, ShimLocation, VariableCompletion} from '../api';
import {DirectiveInScope} from '../api/in_scope';

import {ExpressionIdentifier, findFirstMatchingNode} from './comments';
import {TemplateData} from './context';


export class CompletionEngine {
  private globalCompletionCache = new Map<TmplAstTemplate|null, GlobalCompletion>();
  private bindingCompletionCache = new Map<TmplAstElement|TmplAstTemplate, BindingCompletionMap>();
  private expressionCompletionCache = new Map<AST, ShimLocation|null>();

  constructor(
      private tcb: ts.Node, private data: TemplateData, private shimPath: AbsoluteFsPath,
      private component: ts.ClassDeclaration, private scopeReader: ComponentScopeReader) {}

  getGlobalCompletions(context: TmplAstTemplate|null): GlobalCompletion|null {
    // Global completions are the union of two separate pieces: a `ContextComponentCompletion` which
    // is created from an expression within the TCB, and a list of named entities (variables and
    // references) which are visible within the given `context` template.

    const globalRead = findFirstMatchingNode(this.tcb, {
      filter: ts.isPropertyAccessExpression,
      withExpressionIdentifier: ExpressionIdentifier.COMPONENT_COMPLETION
    });

    if (globalRead === null) {
      return null;
    }

    const completion: GlobalCompletion = {
      componentContext: {
        shimPath: this.shimPath,
        positionInShimFile: globalRead.name.getStart(),
      },
      templateContext: new Map<string, ReferenceCompletion|VariableCompletion>(),
    };

    for (const node of this.data.boundTarget.getEntitiesInTemplateScope(context)) {
      if (node instanceof TmplAstReference) {
        completion.templateContext.set(node.name, {
          kind: CompletionKind.Reference,
          node,
        });
      } else {
        completion.templateContext.set(node.name, {
          kind: CompletionKind.Variable,
          node,
        });
      }
    }

    return completion;
  }

  getBindingCompletions(el: TmplAstElement|TmplAstTemplate, typeChecker: ts.TypeChecker):
      BindingCompletionMap {
    const map: BindingCompletionMap = new Map<string, BindingCompletion>();

    const directives = this.data.boundTarget.getDirectivesOfNode(el);
    if (directives !== null) {
      for (const dir of directives) {
        const tsSymbol = typeChecker.getSymbolAtLocation(dir.ref.node);
        const dirClassType = typeChecker.getTypeAtLocation(dir.ref.node);
        if (tsSymbol === undefined) {
          continue;
        }

        const dirInScope: DirectiveInScope = {
          isComponent: dir.isComponent,
          selector: dir.selector!,
          tsSymbol,
          isStructural: false,
        };

        for (const [property, field] of dir.inputs) {
          map.set(property, {
            kind: CompletionKind.Input,
            directive: dirInScope,
            name: property,
            field: dirClassType.getProperty(field) ?? null,
            bananaInABox: dir.outputs.hasBindingPropertyName(property + 'Change'),
          });
        }

        for (const [property, field] of dir.outputs) {
          map.set(property, {
            kind: CompletionKind.Output,
            directive: dirInScope,
            name: property,
            field: dirClassType.getProperty(field) ?? null,
          });
        }
      }
    }

    this.bindingCompletionCache.set(el, map);
    return map;
  }

  getExpressionCompletion(ast: AST): ShimLocation|null {
    if (this.expressionCompletionCache.has(ast)) {
      return this.expressionCompletionCache.get(ast)!;
    } else if (ast instanceof PropertyRead) {
      return this.getNamedAccessCompletion(ast);
    } else {
      return null;
    }

    // a.b| a?.b
    //   .bar()
    //   .bar(a, ) (parameter list hover info)
    // a.b()
    // a | b|:?:?:?
    // a|
    // !|  UnaryNot(  [PropertyRead(ImplicityReceiver)]  )
  }

  private getNamedAccessCompletion(ast: NamedAccessAST): ShimLocation|null {
    return null;
  }
}

type NamedAccessAST = AST&{
  nameSpan: AbsoluteSourceSpan;
  name: string
};