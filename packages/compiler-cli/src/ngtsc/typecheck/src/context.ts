import {Directive, R3TargetBinder, SelectorMatcher} from '@angular/compiler';
import {Node} from '@angular/compiler/src/render3/r3_ast';
import * as ts from 'typescript';

import {ImportManager} from '../../translator';

import {DirectiveTypecheckData, TypeCheckBlockMetadata, TypeCtorMetadata} from './api';
import {generateTypeCheckBlock} from './type_check_block';
import {generateTypeCtor} from './type_constructor';

interface Op {
  readonly node: ts.ClassDeclaration;
  readonly splitPoint: number;

  execute(im: ImportManager, sf: ts.SourceFile, printer: ts.Printer): string;
}

class TcbOp implements Op {
  constructor(readonly node: ts.ClassDeclaration, readonly meta: TypeCheckBlockMetadata) {}

  get splitPoint(): number { return this.node.end + 1; }

  execute(im: ImportManager, sf: ts.SourceFile, printer: ts.Printer): string {
    const tcb = generateTypeCheckBlock(this.node, this.meta, im);
    return printer.printNode(ts.EmitHint.Unspecified, tcb, sf);
  }
}

class TypeCtorOp implements Op {
  constructor(readonly node: ts.ClassDeclaration, readonly meta: TypeCtorMetadata) {}

  get splitPoint(): number { return this.node.end - 1; }

  execute(im: ImportManager, sf: ts.SourceFile, printer: ts.Printer): string {
    const tcb = generateTypeCtor(this.node, this.meta);
    return printer.printNode(ts.EmitHint.Unspecified, tcb, sf);
  }
}

function orderOps(op1: Op, op2: Op): number {
  return op1.splitPoint - op2.splitPoint;
}

export class TypeCheckContext {
  private typeCtors = new Set<ts.ClassDeclaration>();
  private opMap = new Map<ts.SourceFile, Op[]>();

  hasTypeCtor(node: ts.ClassDeclaration): boolean { return this.typeCtors.has(node); }

  addTypeCtor(sf: ts.SourceFile, node: ts.ClassDeclaration, ctorMeta: TypeCtorMetadata): void {
    if (this.hasTypeCtor(node)) {
      return;
    }
    if (!this.opMap.has(sf)) {
      this.opMap.set(sf, []);
    }
    const ops = this.opMap.get(sf) !;
    ops.push(new TypeCtorOp(node, ctorMeta));
  }

  addTypeCheckBlock(sf: ts.SourceFile, node: ts.ClassDeclaration, tcbMeta: TypeCheckBlockMetadata):
      void {
    if (!this.opMap.has(sf)) {
      this.opMap.set(sf, []);
    }
    const ops = this.opMap.get(sf) !;
    ops.push(new TcbOp(node, tcbMeta));
  }

  addTemplate<N>(
      node: ts.ClassDeclaration, template: Node[],
      matcher: SelectorMatcher<Directive<DirectiveTypecheckData>>): void {
    const binder = new R3TargetBinder(matcher);
    const bound = binder.bind({
        template,
    });
    const directives = bound.getUsedDirectives();
    console.error(
        'processed', node.name !.text, 'and found it used', directives.length, 'directives');
    directives.forEach(dir => {
      const dirNode = dir.directive.ref.node;
      this.addTypeCtor(dirNode.getSourceFile(), dirNode, {
        fnName: 'ngTypeCtor',
        body: !dirNode.getSourceFile().fileName.endsWith('.d.ts'),
        fields: {
          inputs: Array.from(dir.inputs.values()),
          outputs: Array.from(dir.outputs.values()),
          // TODO: support queries
          queries: [],
        },
      });
    });
    this.addTypeCheckBlock(node.getSourceFile(), node, {
      boundTarget: bound,
      fnName: `${node.name!.text}_TypeCheckBlock`,
    });
  }

  transform(sf: ts.SourceFile): ts.SourceFile {
    if (!this.opMap.has(sf)) {
      return sf;
    }

    const importManager = new ImportManager(false, '_i');

    const ops = this.opMap.get(sf) !.sort(orderOps);
    const textParts = splitStringAtPoints(sf.text, ops.map(op => op.splitPoint));

    const printer = ts.createPrinter({omitTrailingSemicolon: true});

    let str = textParts[0];

    ops.forEach((op, idx) => {
      const text = op.execute(importManager, sf, printer);
      str += text + textParts[idx + 1];
    });

    str = importManager.getAllImports(sf.fileName, null)
              .map(i => `import * as ${i.as} from '${i.name}';`)
              .join('\n') +
        '\n' + str;
    console.error(str);
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
