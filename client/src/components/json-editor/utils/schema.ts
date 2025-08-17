// Schema utilities for JsonEditor
// Extracted for reuse and testability

export const typeLabelFromSchema = (sch: any | undefined): string | undefined => {
  if (!sch) return undefined;
  const t = sch.type;
  if (typeof t === 'string') {
    if (t === 'string') return 'str';
    if (t === 'integer') return 'int';
    if (t === 'number') return 'float';
    if (t === 'boolean') return 'bool';
    if (t === 'array') return 'arr';
    if (t === 'object') return 'obj';
    if (t === 'hinst') return 'hinst';
  }
  if (Array.isArray(t)) return t.map((x) => String(x)).join('|');
  if ((sch as any).oneOf) return 'union';
  return undefined;
};

// Given a root schema and a JSON path, descend to the schema node for that path.
export const getSchemaForPath = (schema: any | undefined, path: (string | number)[]): any | undefined => {
  if (!schema) return undefined;
  let node: any = schema;
  for (const seg of path) {
    if (node && node.oneOf && Array.isArray(node.oneOf)) {
      const objBranch = node.oneOf.find((b: any) => b && (b.type === 'object' || b.properties))
        ?? node.oneOf.find((b: any) => b && (b.type === 'array' || b.items))
        ?? node.oneOf[0];
      node = objBranch;
    }
    const t = node?.type;
    if ((t === 'object' || node?.properties) && node.properties) {
      const keyStr = String(seg);
      node = node.properties[keyStr];
    } else if (t === 'array' || node?.items) {
      node = node.items;
    } else {
      return undefined;
    }
    if (!node) return undefined;
  }
  return node;
};
