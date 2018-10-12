import * as ts from 'typescript';

import {ImportMode} from './api';

export function pickIdentifier(
    context: ts.SourceFile, primary: ts.Identifier, secondaries: ts.Identifier[],
    mode: ImportMode): ts.Identifier|null {
  context = ts.getOriginalNode(context) as ts.SourceFile;

  if (ts.getOriginalNode(primary).getSourceFile() === context) {
    return primary;
  } else if (mode === ImportMode.UseExistingImport) {
    return secondaries.find(id => ts.getOriginalNode(id).getSourceFile() === context) || null;
  } else {
    return null;
  }
}
