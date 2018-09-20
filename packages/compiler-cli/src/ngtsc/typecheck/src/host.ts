import * as ts from 'typescript';

export class AuxiliaryProgramHost implements ts.CompilerHost {
  private sfCache = new Map<string, ts.SourceFile>();

  constructor(program: ts.Program, private delegate: ts.CompilerHost, private augment: (file: ts.SourceFile) => ts.SourceFile) {
    program.getSourceFiles().forEach(file => {
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
      const augSf = this.augment(sf);
      this.sfCache.set(fileName, augSf);
      return augSf;
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