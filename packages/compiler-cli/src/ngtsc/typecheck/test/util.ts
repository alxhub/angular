import * as ts from 'typescript';

import {getDeclaration, InMemoryHost} from '../../testing/in_memory_typescript';
import { TypeCtorMetadata } from '../src/api';
import { generateTypeCtor } from '../src/type_constructor';

export class AugmentingHost implements ts.CompilerHost {
  private sfCache = new Map<string, ts.SourceFile>();

  constructor(program: ts.Program, private delegate: ts.CompilerHost, private augment: (file: ts.SourceFile) => ts.SourceFile) {
    program.getSourceFiles().forEach(file => {
      console.error('caching', file.fileName);
      this.sfCache.set(file.fileName, file);
    });
  }
  getSourceFile(
      fileName: string, languageVersion: ts.ScriptTarget,
      onError?: ((message: string) => void)|undefined,
      shouldCreateNewSourceFile?: boolean|undefined): ts.SourceFile|undefined {
    let sf: ts.SourceFile|undefined = this.sfCache.get(fileName);
    if (sf === undefined) {
      sf = this.delegate.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
      sf && this.sfCache.set(fileName, sf);
    } else {
    }
    if (sf !== undefined) {
      return this.augment(sf);
    } else {
      return undefined;
    }
  }

  getDefaultLibFileName(options: ts.CompilerOptions): string {
    return this.delegate.getDefaultLibFileName(options);
  }

  writeFile(fileName: string, data: string, writeByteOrderMark: boolean, onError: ((message: string) => void) | undefined, sourceFiles: ReadonlyArray<ts.SourceFile>): void {
    return this.delegate.writeFile(fileName, data, writeByteOrderMark, onError, sourceFiles);
  }

  getCurrentDirectory(): string {
    return this.delegate.getCurrentDirectory();
  }

  getDirectories(path: string): string[] {
    return this.delegate.getDirectories(path);
  }

  getCanonicalFileName(fileName: string): string {
    return this.delegate.getCanonicalFileName(fileName);
  }

  useCaseSensitiveFileNames(): boolean {
    return this.delegate.useCaseSensitiveFileNames();
  }

  getNewLine(): string {
    return this.delegate.getNewLine();
  }

  fileExists(fileName: string): boolean {
    return this.delegate.fileExists(fileName);
  }

  readFile(fileName: string): string | undefined {
    return this.delegate.readFile(fileName);
  }
}

export function augmentSf(className: string, meta: TypeCtorMetadata): (file: ts.SourceFile) => ts.SourceFile {
  return (sf: ts.SourceFile) => {
      const decl = sf
      .statements
      .filter(ts.isClassDeclaration)
      .find(decl => decl.name !== undefined && decl.name.text === className);
    if (decl === undefined) {
      return sf;
    }
    const ctor = generateTypeCtor(decl, meta);
    const printer = ts.createPrinter();
    const text = printer.printNode(ts.EmitHint.Unspecified, ctor, sf);

    const intro = sf.text.substring(0, decl.end);
    const outro = sf.text.substring(decl.end);
    const fullText = intro + '\n' + text + '\n' + outro;
    console.error(`wrote ${sf.fileName} augmentation:\n${fullText}`)
    return ts.createSourceFile(sf.fileName, fullText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  }
}

export function identity(sf: ts.SourceFile): ts.SourceFile {
  return sf;
}

export const LIB_D_TS = {
  name: 'lib.d.ts',
  contents: `
    type Partial<T> = { [P in keyof T]?: T[P]; };
    type Pick<T, K extends keyof T> = { [P in K]: T[P]; };
    type NonNullable<T> = T extends null | undefined ? never : T;`
};
