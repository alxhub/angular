/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {AbsoluteFsPath, FileSystem} from '../../../src/ngtsc/file_system';

export interface PackageJsonWriter {
  /**
   * Record a change to a field in the package.json.
   */
  write(packageJsonPath: AbsoluteFsPath, path: string[], value: unknown): void;
}

export class DirectPackageJsonWriter implements PackageJsonWriter {
  constructor(private fs: FileSystem) {}
  write(packageJsonPath: AbsoluteFsPath, path: string[], value: unknown): void {
    console.error('json writer for', path, 'attempting to read file', packageJsonPath);
    try {
      let json: any;
      if (this.fs.exists(packageJsonPath)) {
        json = JSON.parse(this.fs.readFile(packageJsonPath));
      } else {
        json = {};
      }
      console.error('read!');
      let obj = json;
      const lastProperty = path.pop() !;
      for (const field of path) {
        if (!obj.hasOwnProperty(field)) {
          obj[field] = {};
        }
        obj = obj[field];
      }
      obj[lastProperty] = value;
      console.error('wrote', path, '.', lastProperty, '=', value, 'to', packageJsonPath);
      this.fs.ensureDir(this.fs.dirname(packageJsonPath));
      this.fs.writeFile(packageJsonPath, JSON.stringify(json, null, 2));
    } catch (e) {
      console.error(e);
      debugger;
    }
  }
}
