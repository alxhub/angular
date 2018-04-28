import * as ts from 'typescript';

export type Type = string | TypeArray | TypeReference | Any;

export interface TypeArray extends Array<Type> {}

export interface Any {
  _any: true;
}

export const ANY: Any = {
  _any: true,
};

export class TypeReference {
  constructor(readonly module: string|undefined, readonly name: string, readonly parameters: Type[]) {}
}

export function reflectType(type: ts.TypeNode, checker: ts.TypeChecker): Type {
  if (ts.isTypeReferenceNode(type)) {
    return reflectReference(type, checker);
  } else if (ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal)) {
    return type.literal.text;
  } else if (ts.isTupleTypeNode(type)) {
    return type.elementTypes.map(elementType => reflectType(elementType, checker));
  } else {
    return ANY;
  }
}

function reflectReference(type: ts.TypeReferenceNode, checker: ts.TypeChecker): Type {
  let module: string|undefined = undefined;
  let name: string|undefined = undefined;
  if (ts.isIdentifier(type.typeName)) {
    module = reflectIdentifierToImport(type.typeName, checker);
    name = type.typeName.text;
  } else if (ts.isQualifiedName(type.typeName)) {
    if (!ts.isIdentifier(type.typeName.left)) {
      return ANY;
    }
    module = reflectIdentifierToImport(type.typeName.left, checker);
    name = type.typeName.right.text;
  } else {
    return ANY;
  }
  return new TypeReference(
    module,
    name,
    type.typeArguments !== undefined ?
      type.typeArguments.map(arg => reflectType(arg, checker)) :
      []
  );
}

function reflectIdentifierToImport(id: ts.Identifier, checker: ts.TypeChecker): string|undefined {
  const symbol = checker.getSymbolAtLocation(id);
  if (symbol === undefined || symbol.declarations === undefined || symbol.declarations.length === 0) {
    return undefined;
  }
  const decl = symbol.declarations[0];
  if (ts.isNamespaceImport(decl)) {
    return (decl.parent!.parent!.moduleSpecifier as ts.Identifier).text;
  } else if (ts.isImportSpecifier(decl)) {
    return (decl.parent!.parent!.parent!.moduleSpecifier as ts.Identifier).text;
  } else {
    return undefined;
  }
}