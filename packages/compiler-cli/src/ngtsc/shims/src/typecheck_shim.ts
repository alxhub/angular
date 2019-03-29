import * as ts from 'typescript';

import {AbsoluteFsPath} from '../../path';

import {ShimGenerator} from './host';

export class TypeCheckShimGenerator implements ShimGenerator {
  constructor(private typeCheckFile: AbsoluteFsPath) {
    console.error('type check file is', typeCheckFile);
  }

  recognize(fileName: AbsoluteFsPath): boolean { return fileName === this.typeCheckFile; }

  generate(genFileName: AbsoluteFsPath, readFile: (fileName: string) => ts.SourceFile | null):
      ts.SourceFile|null {
    return ts.createSourceFile(
        genFileName, 'export const USED_FOR_NG_TYPE_CHECKING = true;', ts.ScriptTarget.Latest, true,
        ts.ScriptKind.TS);
  }
}
