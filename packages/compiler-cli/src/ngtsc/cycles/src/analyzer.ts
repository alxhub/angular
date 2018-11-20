import * as ts from 'typescript';

import {ModuleResolver} from '../../host';
import {ImportGraph} from './imports';

export class CycleAnalyzer {
  constructor(private importGraph: ImportGraph) {}

  wouldCreateCycle(from: ts.SourceFile, to: ts.SourceFile): boolean {
    // Import of 'from' -> 'to' is illegal if an edge 'to' -> 'from' already exists.
    return this.importGraph.transitiveImportsOf(to).has(from);
  }

  recordSyntheticImport(from: ts.SourceFile, to: ts.SourceFile): void {
    this.importGraph.addSyntheticImport(from, to);
  }
}
