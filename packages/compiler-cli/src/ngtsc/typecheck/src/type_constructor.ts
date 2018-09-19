import * as ts from 'typescript';

import {TypeCtorMetadata} from './api';

export function generateTypeCtor(node: ts.ClassDeclaration, meta: TypeCtorMetadata): ts.MethodDeclaration {
  const id = node.name!;
  const rawTypeArgs = node.typeParameters !== undefined ?
  node.typeParameters.map(param =>
      ts.createTypeReferenceNode(param.name, undefined)) :
  undefined;

  const rawType: ts.TypeNode = ts.createTypeReferenceNode(id, rawTypeArgs);

  let initType: ts.TypeNode;

  const keys: string[] = [
    ...meta.fields.inputs, ...meta.fields.outputs, ...meta.fields.queries,
  ];
  if (keys.length === 0) {
    initType = ts.createTypeLiteralNode([]);
  } else {
    const keyTypeUnion = ts.createUnionTypeNode(keys.map(key =>
        ts.createLiteralTypeNode(ts.createStringLiteral(key))));
  
    const pickType = ts.createTypeReferenceNode('Pick', [rawType, keyTypeUnion]);
    initType = ts.createTypeReferenceNode('Partial', [pickType]);
  }

  const body = meta.body ? ts.createBlock([
    ts.createReturn(ts.createNonNullExpression(ts.createNull())),
  ]) : undefined;

  const initParam = ts.createParameter(
    /* decorators */ undefined,
    /* modifiers */ undefined,
    /* dotDotDotToken */ undefined,
    /* name */ 'init',
    /* questionToken */ undefined,
    /* type */ initType,
    /* initializer */ undefined,
  );

  return ts.createMethod(
    /* decorators */ undefined,
    /* modifiers */ [ts.createModifier(ts.SyntaxKind.StaticKeyword)],
    /* asteriskToken */ undefined,
    /* name */ meta.fnName,
    /* questionToken */ undefined,
    /* typeParameters */ node.typeParameters,
    /* parameters */ [initParam],
    /* type */ rawType,
    /* body */ body,
  );
}
