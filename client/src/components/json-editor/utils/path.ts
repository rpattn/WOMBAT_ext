// Utilities for JSON editor path operations
// Extracted from JsonEditor.tsx for reuse and testability

export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = JsonValue[];
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

// Immutably set a deep value at a given path within a JSON-like object
export const setDeepValue = (obj: JsonObject, path: (string | number)[], value: JsonValue): JsonObject => {
  if (path.length === 0) return obj;
  const [head, ...rest] = path;
  const clone: any = Array.isArray(obj) ? [...(obj as any)] : { ...obj };
  if (rest.length === 0) {
    (clone as any)[head as any] = value as any;
    return clone;
  }
  const next = (clone as any)[head as any];
  (clone as any)[head as any] = setDeepValue(
    (typeof next === 'object' && next !== null ? next : ({} as any)) as JsonObject,
    rest,
    value
  );
  return clone;
};
