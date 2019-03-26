import {DirectiveMeta as T2DirectiveMeta} from '@angular/compiler';

import {Reference} from '../../imports';
import {ClassDeclaration} from '../../reflection';

export interface NgModuleMeta {
  ref: Reference<ClassDeclaration>;
  declarations: Reference<ClassDeclaration>[];
  imports: Reference<ClassDeclaration>[];
  exports: Reference<ClassDeclaration>[];
}

export interface DirectiveMeta extends T2DirectiveMeta {
  ref: Reference<ClassDeclaration>;
  /**
   * Unparsed selector of the directive.
   */
  selector: string;
  queries: string[];
  ngTemplateGuards: string[];
  hasNgTemplateContextGuard: boolean;
  baseClass: Reference<ClassDeclaration>|'dynamic'|null;
}

/**
 * Metadata for a given pipe within an NgModule's scope.
 */
export interface PipeMeta {
  ref: Reference<ClassDeclaration>;
  name: string;
}

export interface MetadataReader {
  getDirectiveMetadata(node: Reference<ClassDeclaration>): DirectiveMeta|null;
  getNgModuleMetadata(node: Reference<ClassDeclaration>): NgModuleMeta|null;
  getPipeMetadata(node: Reference<ClassDeclaration>): PipeMeta|null;
}

export interface MetadataRegistry {
  /**
   * Add directive metadata to the registry.
   */
  registerDirectiveMetadata(meta: DirectiveMeta): void;

  registerNgModuleMetadata(meta: NgModuleMeta): void;

  registerPipeMetadata(meta: PipeMeta): void;
}
