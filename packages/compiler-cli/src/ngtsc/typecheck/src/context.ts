import * as ts from 'typescript';
import {Directive, R3TargetBinder, SelectorMatcher} from '@angular/compiler';
import {Node} from '@angular/compiler/src/render3/r3_ast';

import { TypeCtorMetadata, DirectiveTypecheckData } from './api';
import {generateTypeCtor} from './type_constructor';

interface TypeCtorOp {
  node: ts.ClassDeclaration;
  meta: TypeCtorMetadata;
}

function orderOps(op1: {node: ts.ClassDeclaration}, op2: {node: ts.ClassDeclaration}): number {
  return op1.node.pos - op2.node.pos;
}

export class TypeCheckContext {
  private typeCtors = new Set<ts.ClassDeclaration>();
  private typeCtorMap = new Map<ts.SourceFile, TypeCtorOp[]>();

  hasTypeCtor(node: ts.ClassDeclaration): boolean {
    return this.typeCtors.has(node);
  }

  addTypeCtor(sf: ts.SourceFile, node: ts.ClassDeclaration, ctorMeta: TypeCtorMetadata): void {
    if (this.hasTypeCtor(node)) {
      throw new Error(`Did too much work to produce type ctor metadata for ${node}`);
    }
    if (!this.typeCtorMap.has(sf)) {
      this.typeCtorMap.set(sf, []);
    }
    const ops = this.typeCtorMap.get(sf)!;
    ops.push({
      node,
      meta: ctorMeta,
    });
  }

  addTemplate<N>(node: ts.ClassDeclaration, template: Node[], matcher: SelectorMatcher<Directive<DirectiveTypecheckData>>): void {
    const binder = new R3TargetBinder(matcher);
    const bound = binder.bind({
      template,
    });
    const directives = bound.getUsedDirectives();
    console.error('processed', node.name!.text, 'and found it used', directives.length, 'directives');
    directives.forEach(dir => {
      this.addTypeCtor(node.getSourceFile(), node, {
        fnName: 'ngTypeCtor',
        body: !node.getSourceFile().fileName.endsWith('.d.ts'),
        fields: {
          inputs: [],
          outputs: [],
          queries: [],
        }
      })
    });
  }

  transform(sf: ts.SourceFile): ts.SourceFile {
    if (!this.typeCtorMap.has(sf)) {
      return sf;
    }

    const ops = this.typeCtorMap.get(sf)!.sort(orderOps);
    const textParts = splitStringAtPoints(sf.text, ops.map(op => op.node.end - 1));

    const printer = ts.createPrinter({omitTrailingSemicolon: true});

    let str = textParts[0];

    ops.forEach((op, idx) => {
      const ctor = generateTypeCtor(op.node, op.meta);
      const text = printer.printNode(ts.EmitHint.Unspecified, ctor, sf);
      str += text + textParts[idx + 1];
    });

    console.error('str', str);

    return ts.createSourceFile(sf.fileName, str, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  }
}

function splitStringAtPoints(str: string, points: number[]): string[] {
  const splits: string[] = [];
  let start = 0;
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    splits.push(str.substring(start, point));
    start = point;
  }
  splits.push(str.substring(start));
  return splits;
}
