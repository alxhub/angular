import * as ts from 'typescript';

import {InMemoryHost} from '../../testing/in_memory_typescript';
import { TypeCtorMetadata } from '../src/api';
import { generateTypeCtor } from '../src/type_constructor';

export class AugmentedInMemoryHost extends InMemoryHost {
    constructor(private augment: (file: ts.SourceFile) => ts.SourceFile) {
      super();
    }

    getSourceFile(
        fileName: string, languageVersion: ts.ScriptTarget,
        onError?: ((message: string) => void)|undefined,
        shouldCreateNewSourceFile?: boolean|undefined): ts.SourceFile|undefined {
    const sf = super.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    if (sf !== undefined) {
      return this.augment(sf);
    } else {
      return undefined;
    }
  }
}

export function addTypeCheckBlockFn(className: string, meta: TypeCtorMetadata): (sf: ts.SourceFile) => ts.SourceFile {
  return (sf: ts.SourceFile) => {
    const decl = sf
      .statements
      .filter(ts.isClassDeclaration)
      .find(decl => decl.name !== undefined && decl.name.text === className);
    if (decl !== undefined) {
      // Figure out the end of the file.
      let pos = sf.end + 1;
      const newStatements = sf.statements.reduce((stmts, stmt) => {
        stmts.push(stmt);
        if (stmt === decl) {
          const ctor = generateTypeCtor(decl, meta);
          ctor.pos = pos;
          ctor.end = pos++;
          stmts.push(ctor);
        }
        return stmts;
      }, [] as ts.Statement[]);
      sf = ts.getMutableClone(sf);
      sf.statements = ts.createNodeArray(newStatements);
    }
    return sf;
  };
}

export function identity(sf: ts.SourceFile): ts.SourceFile {
  return sf;
}