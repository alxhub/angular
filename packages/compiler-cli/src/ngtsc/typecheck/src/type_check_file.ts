
/// <reference types="node" />
import * as path from 'path';
import * as ts from 'typescript';

import {NoopImportRewriter, Reference, ReferenceEmitter} from '../../imports';
import {AbsoluteFsPath} from '../../path';
import {ClassDeclaration} from '../../reflection';
import {ImportManager} from '../../translator';

import {TypeCheckBlockMetadata, TypeCheckingConfig} from './api';
import {Environment} from './environment';
import {generateTypeCheckBlock} from './type_check_block';

export class TypeCheckFile extends Environment {
  private nextTcbId = 1;
  private tcbStatements: ts.Statement[] = [];

  constructor(private fileName: string, config: TypeCheckingConfig, refEmitter: ReferenceEmitter) {
    super(
        config, new ImportManager(new NoopImportRewriter(), 'i'), refEmitter,
        ts.createSourceFile(fileName, '', ts.ScriptTarget.Latest, true));
  }

  addTypeCheckBlock(
      ref: Reference<ClassDeclaration<ts.ClassDeclaration>>, meta: TypeCheckBlockMetadata): void {
    const fnId = ts.createIdentifier(`_tcb${this.nextTcbId++}`);
    const fn = generateTypeCheckBlock(this, ref, fnId, meta);
    this.tcbStatements.push(fn);
  }

  render(): ts.SourceFile {
    let source: string = this.importManager.getAllImports(this.fileName)
                             .map(i => `import * as ${i.qualifier} from '${i.specifier}';`)
                             .join('\n') +
        '\n\n';
    const printer = ts.createPrinter();
    for (const stmt of this.pipeInstStatements) {
      source += printer.printNode(ts.EmitHint.Unspecified, stmt, this.contextFile) + '\n';
    }
    source += '\n';
    for (const stmt of this.typeCtorStatements) {
      source += printer.printNode(ts.EmitHint.Unspecified, stmt, this.contextFile) + '\n';
    }
    source += '\n';
    for (const stmt of this.tcbStatements) {
      source += printer.printNode(ts.EmitHint.Unspecified, stmt, this.contextFile) + '\n';
    }

    return ts.createSourceFile(
        this.fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  }

  getPreludeStatements(): ts.Statement[] { return []; }
}

export function typeCheckFilePath(rootDirs: AbsoluteFsPath[]): AbsoluteFsPath {
  const shortest = rootDirs.concat([]).sort((a, b) => a.length - b.length)[0];
  return AbsoluteFsPath.fromUnchecked(path.posix.join(shortest, '__ng_typecheck__.ts'));
}
