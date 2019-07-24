/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {AbsoluteFsPath, FileSystem} from '../../../src/ngtsc/file_system';
import {Logger} from '../logging/logger';
import {NGCC_VERSION} from '../packages/build_marker';
import {EntryPointPackageJson, getEntryPointFormat} from '../packages/entry_point';
import {makeEntryPointBundle} from '../packages/entry_point_bundle';
import {Transformer} from '../packages/transformer';
import {PathMappings} from '../utils';
import {FileWriter} from '../writing/file_writer';
import {PackageJsonWriter} from '../writing/package_json_writer';

import {Task} from './api';

export class NgccTaskCompiler {
  private transformer = new Transformer(this.fileSystem, this.logger);

  constructor(
      private fileSystem: FileSystem, private fileWriter: FileWriter,
      private packageJsonWriter: PackageJsonWriter, private pathMappings: PathMappings|null,
      private logger: Logger) {}

  compile(task: Task): void {
    const {entryPoint, formatProperties, processDts} = task;

    // Are we compiling the Angular core?
    const isCore = entryPoint.name === '@angular/core';

    const entryPointPackageJson = entryPoint.packageJson;

    // We only need to use the first property to compile the format - all the other properties are
    // aliases and only need to be marked as completed.
    const formatProperty = formatProperties[0];

    // Can't fail; already determined in the initial setup of the task.
    const format = getEntryPointFormat(this.fileSystem, entryPoint, formatProperty) !;
    const formatPath = (entryPointPackageJson as any)[formatProperty] as string;

    // We don't break if this if statement fails because we still want to mark
    // the property as processed even if its underlying format has been built already.
    const bundle = makeEntryPointBundle(
        this.fileSystem, entryPoint, formatPath, isCore, formatProperty, format, processDts,
        this.pathMappings || undefined, true);

    if (bundle) {
      this.logger.info(`Compiling ${entryPoint.name} : ${formatProperty} as ${format}`);
      const transformedFiles = this.transformer.transform(bundle);
      this.fileWriter.writeBundle(entryPoint, bundle, transformedFiles);
    } else {
      this.logger.warn(
          `Skipping ${entryPoint.name} : ${format} (no valid entry point file for this format).`);
    }

    const packageJsonPath = this.fileSystem.resolve(entryPoint.path, 'package.json');
    console.error(`Done compiling ${entryPoint.name}, ${formatProperties}`);
    for (const property of formatProperties) {
      this.markAsProcessed(packageJsonPath, property);
    }
    if (processDts) {
      this.markAsProcessed(packageJsonPath, 'typings');
    }
  }

  private markAsProcessed(packageJsonPath: AbsoluteFsPath, property: keyof EntryPointPackageJson):
      void {
    this.packageJsonWriter.write(
        packageJsonPath, ['__processed_by_ivy_ngcc__', property], NGCC_VERSION);
  }
}
