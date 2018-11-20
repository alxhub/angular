import * as ts from 'typescript';

import {ModuleResolver} from '../../host';

export class ImportGraph {
  private map = new Map<ts.SourceFile, Set<ts.SourceFile>>();

  constructor(private resolver: ModuleResolver) {}

  importsOf(sf: ts.SourceFile): Set<ts.SourceFile> {
    if (!this.map.has(sf)) {
      this.map.set(sf, this.scanImports(sf));
    }
    return this.map.get(sf)!;
  }

  transitiveImportsOf(sf: ts.SourceFile): Set<ts.SourceFile> {
    const imports = new Set<ts.SourceFile>();
    this.transitiveImportsOfHelper(sf, imports);
    return imports;
  }

  private transitiveImportsOfHelper(sf: ts.SourceFile, results: Set<ts.SourceFile>): void {
    if (results.has(sf)) {
      return;
    }
    results.add(sf);
    for (const imported of this.importsOf(sf)) {
      this.transitiveImportsOfHelper(imported, results);
    }
  }


  addSyntheticImport(sf: ts.SourceFile, imported: ts.SourceFile): void {
    if (isLocalFile(imported)) {
      this.importsOf(sf).add(imported);
    }
  }

  private scanImports(sf: ts.SourceFile): Set<ts.SourceFile> {
    const imports = new Set<ts.SourceFile>();
    for (const stmt of sf.statements) {
      if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
        const moduleName = stmt.moduleSpecifier.text;
        const moduleFile = this.resolver.resolveModuleName(moduleName, sf);
        if (moduleFile !== null && isLocalFile(moduleFile)) {
          imports.add(moduleFile);
        }
      }
    }
    return imports;
  }
}

function isLocalFile(sf: ts.SourceFile): boolean {
  return !sf.fileName.endsWith('.d.ts');
}
