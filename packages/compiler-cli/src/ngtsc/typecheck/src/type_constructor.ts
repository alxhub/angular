import * as ts from 'typescript';
import {R3ComponentMetadata, WrappedNodeExpr} from '@angular/compiler';

import {ComponentTcbRequest, ComponentTcbResponse, TypeCtorMetadata} from './api';

export function generateTypeCtor(node: ts.ClassDeclaration, meta: TypeCtorMetadata): ts.FunctionDeclaration {
  const id = node.name!;

  const keys: string[] = [
    ...meta.fields.inputs, ...meta.fields.outputs, ...meta.fields.queries,
  ];
  const keyTypeUnion = ts.createUnionTypeNode(keys.map(key =>
      ts.createLiteralTypeNode(ts.createStringLiteral(key))));

  const rawTypeArgs = node.typeParameters !== undefined ?
      node.typeParameters.map(param =>
          ts.createTypeReferenceNode(param.name, undefined)) :
      undefined;
    
  const rawType: ts.TypeNode = ts.createTypeReferenceNode(id, rawTypeArgs);

  const pickType = ts.createTypeReferenceNode('Pick', [rawType, keyTypeUnion]);
  const partialType = ts.createTypeReferenceNode('Partial', [pickType]);

  const body = ts.createBlock([
    ts.createReturn(ts.createNonNullExpression(ts.createNull())),
  ]);

  const initParam = ts.createParameter(
    /* decorators */ undefined,
    /* modifiers */ undefined,
    /* dotDotDotToken */ undefined,
    /* name */ 'init',
    /* questionToken */ undefined,
    /* type */ partialType,
    /* initializer */ undefined,
  );

  return ts.createFunctionDeclaration(
    /* decorators */ undefined,
    /* modifiers */ undefined,
    /* asteriskToken */ undefined,
    /* name */ meta.fnName,
    /* typeParameters */ node.typeParameters,
    /* parameters */ [initParam],
    /* type */ rawType,
    /* body */ body,
  );
}
