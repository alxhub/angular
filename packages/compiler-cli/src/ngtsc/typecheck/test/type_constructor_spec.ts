import * as ts from 'typescript';

import {makeProgram} from '../../testing/in_memory_typescript';
import {AugmentedInMemoryHost, addTypeCheckBlockFn, identity} from './util';

describe('ngtsc typechecking', () => {
  describe('ctors', () => {
    it('compiles a basic type constructor', () => {
      const augment = addTypeCheckBlockFn('TestClass', {
        fnName: 'TestClass_TypeCtor',
        fields: {
          inputs: ['value'],
          outputs: [],
          queries: [],
        },
      });

      const {program} = makeProgram([
        {name: 'main.ts', contents: `
class TestClass<T extends string> {
  value: T;
}

TestClass_TypeCtor({value: 'test'});
        `}
      ], undefined, new AugmentedInMemoryHost(augment), true);
    });
  });
});