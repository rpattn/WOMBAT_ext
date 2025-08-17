import { getSchemaForPath } from './schema';

export const createCachedGetSchemaForPath = (schema: any | undefined) => {
  const cache = new Map<string, any>();
  return (path: (string | number)[]) => {
    const key = path.map(String).join('.');
    if (cache.has(key)) return cache.get(key);
    const node = getSchemaForPath(schema, path);
    cache.set(key, node);
    return node;
  };
};
