import * as ts from 'typescript';

import {getDeclaration, makeProgram} from '../../testing/in_memory_typescript';
import {AugmentingHost, augmentSf, LIB_D_TS} from './util';
import {TypeCheckContext} from '../src/context';

describe('ngtsc typechecking', () => {
  describe('ctors', () => {
    it('compiles a basic type constructor', () => {
      const ctx = new TypeCheckContext();
      const files = [
        LIB_D_TS,
        {name: 'main.ts', contents: `
class TestClass<T extends string> {
  value: T;
}

TestClass.ngTypeCtor({value: 'test'});
        `}
      ];
      const {program, host} = makeProgram(files, undefined, undefined, false);
      const TestClass = getDeclaration(program, 'main.ts', 'TestClass', ts.isClassDeclaration);
      ctx.addTypeCtor(
        program.getSourceFile('main.ts')!,
        TestClass, {
        fnName: 'ngTypeCtor',
        fields: {
          inputs: ['value'],
          outputs: [],
          queries: [],
        },
      });
      const augHost = new AugmentingHost(program, host, (sf: ts.SourceFile) => ctx.transform(sf));
      makeProgram(files, undefined, augHost, true);
    });
  });
});
