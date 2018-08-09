/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as fs from 'fs';
import * as ts from 'typescript';

import {posix as path} from 'path';

/**
 * Extracts the package part of a module specifier, dropping the "deep" part of the import.
 *
 * Examples: @angular/forms -> @angular/forms
 *           @angular/common/http -> @angular/common
 *           typescript -> typescript
 *           foo/bar -> foo
 */
const IMPORT_TO_PATH = /^(?:@[^\/]+\/)?[^\/]+/;

export interface NpmPackage {
  /**
   * Package name (e.g. @angular/core).
   */
  name: string;

  /**
   * Full path to the package on disk.
   */
  path: string;

  /**
   * Map of entry point names to information.
   */
  entryPoints: Map<string, ApfEntryPoint>;

  /**
   * If the package is in another package's node_modules, what package is the parent?
   */
  parent: NpmPackage|null;

  /**
   * If the package has a child node_modules directory, a map of all the packages in there
   * to their `NpmPackage` structures.
   */
  nodeModules: Map<string, NpmPackage>|null;

  /**
   * Set of package on which this package depends.
   */
  dependencies: Set<NpmPackage>;

  /**
   * Order of compilation for entry points within this package, due to cross-entry point
   * dependencies.
   */
  entryPointOrder: string[];
}

export class PackageResolverHost {
  exists(file: string): boolean {
    return fs.existsSync(file);
  }

  read(file: string): string {
    return fs.readFileSync(file, 'utf8');
  }

  subdirs(dir: string): string[] {
    return fs
      .readdirSync(dir)
      .filter(name => fs.lstatSync(path.join(dir, name)).isDirectory());
  }
}

export interface ApfEntryPoint {
  packagePath: string;
  path: string;
  fesm2015: string;
  fesm5: string;
  esm2015: string;
  esm5: string;
  typings: string;
}

export class PackageResolver {
  constructor(readonly host: PackageResolverHost) {}

  private scanNodeModules(nodeModulesPath: string, parent: NpmPackage): Map<string, NpmPackage> {
    const modules = new Map<string, NpmPackage>();
    const consider = (pkgName: string) => {
      const dirPath = path.join(nodeModulesPath, pkgName);
      const entryPoints = this.getEntryPointsOfPackage(dirPath, pkgName);
      if (entryPoints === null) {
        // Not an APF package.
        return;
      }

      modules.set(pkgName, {
        name: pkgName,
        path: dirPath,
        parent,
        entryPoints,
        nodeModules: null,
        dependencies: new Set<NpmPackage>(),
        entryPointOrder: [],
      })
    };

    this
      .host
      .subdirs(nodeModulesPath)
      .filter(dirName => !dirName.startsWith('.'))
      .forEach(dirName => {
        if (dirName.startsWith('@')) {
          this.host.subdirs(path.join(nodeModulesPath, dirName)).forEach(consider);
        } else {
          consider(dirName);
        }
      });

    return modules;
  }

  private getEntryPointsOfPackage(pkg: string, pkgName: string): Map<string, ApfEntryPoint>|null {
    return null;
  }

  findEntryPointsOfPackage(pkg: string): ApfEntryPoint[] {
    return forEachDir(this.host, pkg, dir => {
      return {} as ApfEntryPoint|null;
    }, (entryPoints, entryPoint) => {
      if (entryPoint !== null) {
        entryPoints.push(entryPoint);
      }
      return entryPoints;
    }, [] as ApfEntryPoint[])
  }

  apfEntryPointInfo(pkg: string, entryPoint: string): ApfEntryPoint|null {
    const packageJsonPath = path.join(entryPoint, 'package.json');
    if (!this.host.exists(packageJsonPath)) {
      return null;
    }
    const {fesm2015, fesm5, esm2015, esm5, typings} = JSON.parse(this.host.read(packageJsonPath));
    if (!isString(fesm2015) || !isString(fesm5) || !isString(esm2015) || !isString(esm5) || !isString(typings)) {
      return null;
    }
    return {packagePath: pkg, path: entryPoint, fesm2015, fesm5, esm2015, esm5, typings};
  }

  isApfPackage(dir: string): boolean {
    return forEachDir(this.host, dir, entryPoint => {
      const info = this.apfEntryPointInfo(entryPoint);
      if (info === null) {
        // package.json does not contain the correct fields.
        return false;
      }
      const metadata = path.resolve(entryPoint, info.typings.replace(/\.d\.ts$/, '.metadata.json'));
      return this.host.exists(metadata);
    }, logicalOr, false);
  }

  needsCompile(pkg: string): boolean {
    return true;
  }

  compilationOrder(pkgs: string[]): string[] {
    return []; 
  }

  getDependenciesOfPackage(pkg: string): Set<string> {
    const entryPoints = this.findEntryPointsOfPackage(pkg);
    return new Set<string>();
  }

  getPackageOfImport(contextPackage: string, specifier: string): string|null {
    const importedPackageMatch = IMPORT_TO_PATH.exec(specifier);
    if (importedPackageMatch === null) {
      return null;
    }
    const importedPackage = importedPackageMatch[0];

    return null;
  }

  getImportsOfEntryPoint(entryPoint: ApfEntryPoint): Set<string> {
    const fesm2015 = path.resolve(entryPoint.path, entryPoint.fesm2015);
    const sf = ts.createSourceFile(fesm2015, this.host.read(fesm2015), ts.ScriptTarget.ES2015, false, ts.ScriptKind.JS);
    return sf.statements.reduce((deps, stmt) => {
        if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
          const module = stmt.moduleSpecifier.text;
          deps.add(module);
        }
        return deps;
      },
      new Set<string>()
    );
  }

  
}

function isString(value: any): value is string {
  return typeof value === 'string';
}

function forEachDir<T, R>(host: PackageResolverHost, dir: string, fn: (dir: string) => T, accumulate: (prev: R, current: T) => R, initial: R): R {
  let value: R = initial;
  return host
    .subdirs(dir)
    .filter(dir => !dir.endsWith('/node_modules'))
    .reduce((current, subdir) => {
      const result = fn(subdir);
      return forEachDir(host, subdir, fn, accumulate, accumulate(value, result));
    }, initial);
  return value;
}

function logicalOr(left: boolean, right: boolean): boolean {
  return left || right;
}