import {Reference} from '../../imports';
import {DirectiveMeta, MetadataReader} from '../../metadata';
import {ClassDeclaration} from '../../reflection';

export function flattenInheritedMetadata(
    reader: MetadataReader, dir: Reference<ClassDeclaration>): DirectiveMeta {
  const topMeta = reader.getDirectiveMetadata(dir);
  if (topMeta === null) {
    throw new Error(`Metadata not found for directive: ${dir.debugName}`);
  }

  let inputs: {[key: string]: string | [string, string]} = {};
  let outputs: {[key: string]: string} = {};
  let isDynamic = false;

  const addMetadata = (meta: DirectiveMeta): void => {
    if (meta.baseClass === 'dynamic') {
      isDynamic = true;
    } else if (meta.baseClass !== null) {
      const baseMeta = reader.getDirectiveMetadata(meta.baseClass);
      if (baseMeta !== null) {
        addMetadata(baseMeta);
      } else {
        // Missing metadata for the base class means it's effectively dynamic.
        isDynamic = true;
      }
    }
    inputs = {...inputs, ...meta.inputs};
    outputs = {...outputs, ...meta.outputs};
  };

  addMetadata(topMeta);

  return {
    ...topMeta,
    inputs,
    outputs,
    baseClass: isDynamic ? 'dynamic' : null,
  };
}
