/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript';
import * as path from 'path';
import { staticallyResolve, AllowReferences, Reference, reflectDecorator, Decorator, ResolvedValue, reflectObjectLiteral } from '../../metadata';

export interface ModuleScope {
  compilationScope: SelectorScope;
  exportScope: SelectorScope;
}

export interface SelectorScope {
  directives: DirectiveInScope[];
  pipes: PipeInScope[];
}

export interface DirectiveInScope {
  importFrom: ImportFrom;
  identifier: string;
  selector: string|null;
}

export interface PipeInScope {
  importFrom: ImportFrom;
  identifier: string;
  name: string;
}

export interface ImportFrom {
  absolutely?: string;
  relatively?: string;
}

export class ScopeMap {
  private modules = new Map<ts.ClassDeclaration, ModuleScope>();
  private scopeByClass = new Map<ts.ClassDeclaration, SelectorScope>();
  
  constructor(private checker: ts.TypeChecker) {}

  analyze(sf: ts.SourceFile): ModuleScope[] {
    if (sf.fileName.endsWith('.d.ts')) {
      throw new Error(`Cannot handle .d.ts files`);
    } else {
      console.error('analyze for modules', sf.fileName);
      return this.analyzeTypescript(sf);
    }
  }

  getScopeForDirective(directive: ts.ClassDeclaration): SelectorScope|undefined {
    return this.scopeByClass.get(directive);
  }

  private analyzeTypescript(sf: ts.SourceFile): ModuleScope[] {
    const scopes: ModuleScope[] = [];

    const visitClassDeclaration = (node: ts.ClassDeclaration): void => {
      console.error('visiting class', node.name!.text);
      if (node.decorators === undefined) {
        console.error('no decorators');
        return;
      }
      const decorators = node
        .decorators
        .map(decorator => reflectDecorator(decorator, this.checker))
        .filter(decorator => decorator !== null && decorator.from === '@angular/core') as Decorator[];
      if (decorators.length === 0) {
        console.error('no core decorators');
        return;
      } else if (decorators.length > 1) {
        throw new Error(`Too many Angular decorators.`);
      }
      const decorator = decorators[0];
      if (decorator.name !== 'NgModule') {
        console.error('not ngmodule');
        return;
      }
      if (decorator.args.length !== 1) {
        throw new Error(`@NgModule without one argument`);
      }
      const arg = decorator.args[0];
      if (!ts.isObjectLiteralExpression(arg)) {
        throw new Error(`@NgModule without literal argument`);
      }

      const ngModule = reflectObjectLiteral(arg);
      scopes.push(this.computeModuleScope(node, ngModule));
    };

    const visit = (node: ts.Node): void => {
      if (ts.isClassDeclaration(node)) {
        visitClassDeclaration(node);
      }
      ts.forEachChild(node, visit);
    };

    visit(sf);
    return scopes;
  }

  computeModuleScope(declaration: ts.ClassDeclaration, ngModule: Map<string, ts.Expression>): ModuleScope {
    if (this.modules.has(declaration)) {
      return this.modules.get(declaration)!;
    }
    const moduleScope: ModuleScope = {
      compilationScope: this.computeCompilationScope(declaration, ngModule),
      exportScope: this.computeExportScope(declaration, ngModule),
    };
    this.modules.set(declaration, moduleScope);
    return moduleScope;
  }

  private computeCompilationScope(declaration: ts.ClassDeclaration, ngModule: Map<string, ts.Expression>): SelectorScope {
    const scope: SelectorScope = {
      directives: [],
      pipes: [],
    };
    const moduleName = declaration.name !== undefined ? declaration.name.text : '(anonymous module)';
    // Look for declared components and pipes.
    if (ngModule.has('declarations')) {
      // There are declarations, resolve them to an array of references.
      const declarations = staticallyResolve(ngModule.get('declarations')!, this.checker, AllowReferences.Yes);
      if (!Array.isArray(declarations)) {
        throw new Error(`Unsupported format of declarations, expected array, got ${declarations}`);
      }
      declarations.forEach(declared => this.processDeclaration(scope, declared, moduleName));
      
      if (ngModule.has('imports')) {
        const imports = staticallyResolve(ngModule.get('imports')!, this.checker, AllowReferences.Yes);
        if (!Array.isArray(imports)) {
          throw new Error(`Unsupported format of imports, expected array, got ${imports}`);
        }
        imports.forEach(imported => this.processImport(scope, imported, moduleName));
      }
    }
    return scope;
  }

  private processDeclaration(scope: SelectorScope, declared: ResolvedValue, moduleName: string): void {
    // Recurse into any sub-arrays.
    if (Array.isArray(declared)) {
      declared.forEach(subDeclaration => this.processDeclaration(scope, subDeclaration, moduleName));
      return;
    }

    // Check that the declaration refers to a ts.ClassDeclaration.
    if (!(declared instanceof Reference)) {
      throw new Error(`Unexpected value ${declared} in declarations of module ${moduleName}`);
    } else if (!ts.isClassDeclaration(declared.node)) {
      throw new Error(`Unexpected reference in declarations of module ${moduleName} - expected ClassDeclaration, got ${ts.SyntaxKind[declared.node.kind]}`);
    }

    const declaredClass = declared.node;
    const name = declaredClass.name !== undefined ? declaredClass.name.text : '(anonymous class)';

    if (declaredClass.getSourceFile().fileName.endsWith('.d.ts')) {
      throw new Error(`Class ${name} in declarations of ${moduleName} is not part of the current compilation unit`);
    }

    const decorator = this.getOnlyAngularDecoratorOfClass(declaredClass, moduleName, 'declarations');

    if (decorator.name === 'Pipe') {
      scope.pipes.push(this.processPipe(declaredClass, decorator.arg));
    } else if (decorator.name === 'Component' || decorator.name === 'Directive') {
      scope.directives.push(this.processDirective(declaredClass, decorator.arg));
    } else {
      throw new Error(`Class ${name} in declarations of ${moduleName} has a decorator of type ${decorator.name} and is not a pipe or directive.`);
    }
    console.error(`map component ${declaredClass.name!.text} to scope!`);
    this.scopeByClass.set(declaredClass, scope);
  }

  private processImport(scope: SelectorScope, imported: ResolvedValue, moduleName: string): void {
     // Recurse into any sub-arrays.
     if (Array.isArray(imported)) {
      imported.forEach(subDeclaration => this.processDeclaration(scope, subDeclaration, moduleName));
      return;
    }

    // Check that the declaration refers to a ts.ClassDeclaration.
    if (!(imported instanceof Reference)) {
      throw new Error(`Unexpected value ${imported} in imports of module ${moduleName}`);
    } else if (!ts.isClassDeclaration(imported.node)) {
      throw new Error(`Unexpected reference in imports of module ${moduleName} - expected ClassDeclaration, got ${ts.SyntaxKind[imported.node.kind]}`);
    }

    const importedClass = imported.node;
    const name = importedClass.name !== undefined ? importedClass.name.text : '(anonymous class)';
    
    const decorator = this.getOnlyAngularDecoratorOfClass(importedClass, moduleName, 'imports');
    if (decorator.name !== 'NgModule') {
      throw new Error(`Class ${name} in imports of ${moduleName} is @${decorator.name}, expected @NgModule`);
    }

    const importedScope = this.computeModuleScope(importedClass, decorator.arg);
    scope.directives.push(...importedScope.exportScope.directives);
    scope.pipes.push(...importedScope.exportScope.pipes);
  }

  private processPipe(pipeClass: ts.ClassDeclaration, pipe: Map<string, ts.Expression>): PipeInScope {
    if (pipeClass.name === undefined) {
      throw new Error(`Pipe class must have a name`);
    }

    if (!pipe.has('name')) {
      throw new Error(`name is a required field of pipes`)
    }
    const name = staticallyResolve(pipe.get('name')!, this.checker);
    if (typeof name !== 'string') {
      throw new Error(`Pipe name must be a string, got ${name}`);
    }

    return {
      name,
      identifier: pipeClass.name.text,
      importFrom: {
        relatively: pipeClass.getSourceFile().fileName,
      },
    };
  }

  private processDirective(directiveClass: ts.ClassDeclaration, directive: Map<string, ts.Expression>): DirectiveInScope {
    if (directiveClass.name === undefined) {
      throw new Error(`Pipe class must have a name`);
    }

    const selector = directive.has('selector') ? staticallyResolve(directive.get('selector')!, this.checker) : null;
    if (selector !== null && typeof selector !== 'string') {
      throw new Error(`Directive selector must be a string, got ${selector}`);
    }

    return {
      selector,
      identifier: directiveClass.name.text,
      importFrom: {
        relatively: directiveClass.getSourceFile().fileName,
      },
    };
  }

  private computeExportScope(declaration: ts.ClassDeclaration, ngModule: Map<string, ts.Expression>): SelectorScope {
    return null!;
  }

  private getOnlyAngularDecoratorOfClass(target: ts.ClassDeclaration, moduleName: string, field: string): {name: string, arg: Map<string, ts.Expression>} {
    const className = target.name !== undefined ? target.name.text : '(anonymous class)';

    // Look for Angular decorators on the class.
    if (target.decorators === undefined) {
      throw new Error(`Class ${className} in field of ${moduleName} is neither a pipe nor a directive`);
    }
    const decorators = target
      .decorators
      .map(decorator => reflectDecorator(decorator, this.checker))
      .filter(decorator => decorator !== null && decorator.from === '@angular/core') as Decorator[];

    // There should only be one Angular decorator.
    if (decorators.length > 1) {
      throw new Error(`Class ${className} in field of ${moduleName} has more than one Angular decorator`);
    } else if (decorators.length === 0) {
      throw new Error(`Class ${className} in field of ${moduleName} has no Angular decorators`);
    }

    const decorator = decorators[0];
    if (decorator.args.length !== 1) {
      throw new Error(`Class ${className} in field of ${moduleName} has Angular decorator @${decorator.name} with wrong number of arguments`);
    }
    const argExpr = decorator.args[0];
    if (!ts.isObjectLiteralExpression(argExpr)) {
      throw new Error(`Class ${className} in field of ${moduleName} has Angular decorator @${decorator.name} with non-literal arguments`);
    }
    const arg = reflectObjectLiteral(argExpr);

    return {name: decorator.name, arg};
  }
}

export function getImportPath(from: string, to: string): string {
  const relative = path.relative(from, to);
  console.error(`relative(${from}, ${to}) = ${relative}`);
  const importPath = relative.replace(/(\.d)?\.ts$/g, '');
  console.error(`result = ${importPath}`);
  return importPath;
}
