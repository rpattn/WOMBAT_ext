import React from 'react';
import './JsonEditor.css';

type JsonPrimitive = string | number | boolean | null;
type JsonArray = JsonValue[];
export type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonPrimitive | JsonArray | JsonObject;

// Lightweight JSON editor without external UI libraries

interface JsonEditorProps {
    data: JsonObject;
    schema?: any;
    onChange?: (data: JsonObject) => void;
    onSave?: (data: JsonObject) => void;
}

const JsonEditor: React.FC<JsonEditorProps> = ({ data, schema, onChange, onSave }) => {
    const [formData, setFormData] = React.useState<JsonObject>(data);
    const didMountRef = React.useRef(false);
    const skipNextOnChangeRef = React.useRef(false);
    const [errors, setErrors] = React.useState<Record<string, string[]>>({});

    // Sync internal state when incoming data changes
    React.useEffect(() => {
        // Mark that the next formData effect is from an external prop sync
        skipNextOnChangeRef.current = true;
        setFormData(data);
    }, [data]);

    // Notify parent after local state changes, but not on initial mount or external prop sync
    React.useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true;
            return;
        }
        if (skipNextOnChangeRef.current) {
            skipNextOnChangeRef.current = false;
            return;
        }
        onChange?.(formData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData]);

    // styles moved to JsonEditor.css

    // ----------------------------
    // Validation helpers (no AJV)
    // ----------------------------
    const pathToKey = (path: (string | number)[]) => path.map(String).join('.');

    const pushErr = (map: Record<string, string[]>, path: (string | number)[], msg: string) => {
        const k = pathToKey(path);
        if (!map[k]) map[k] = [];
        map[k].push(msg);
    };

    const isEmpty = (v: any) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

    const validateNumber = (v: any, sch: any, path: (string | number)[], out: Record<string, string[]>) => {
        if (typeof v !== 'number' || Number.isNaN(v)) {
            pushErr(out, path, 'Expected number');
            return;
        }
        if (sch.type === 'integer' && !Number.isInteger(v)) {
            pushErr(out, path, 'Expected integer');
        }
        if (typeof sch.minimum === 'number' && v < sch.minimum) pushErr(out, path, `Minimum is ${sch.minimum}`);
        if (typeof sch.maximum === 'number' && v > sch.maximum) pushErr(out, path, `Maximum is ${sch.maximum}`);
        if (typeof sch.exclusiveMinimum === 'number' && v <= sch.exclusiveMinimum) pushErr(out, path, `Must be > ${sch.exclusiveMinimum}`);
        if (typeof sch.exclusiveMaximum === 'number' && v >= sch.exclusiveMaximum) pushErr(out, path, `Must be < ${sch.exclusiveMaximum}`);
        if (typeof sch.multipleOf === 'number' && (v / sch.multipleOf) % 1 !== 0) pushErr(out, path, `Must be a multiple of ${sch.multipleOf}`);
    };

    const validateString = (v: any, sch: any, path: (string | number)[], out: Record<string, string[]>) => {
        if (typeof v !== 'string') {
            pushErr(out, path, 'Expected string');
            return;
        }
        if (typeof sch.minLength === 'number' && v.length < sch.minLength) pushErr(out, path, `Minimum length is ${sch.minLength}`);
        if (typeof sch.maxLength === 'number' && v.length > sch.maxLength) pushErr(out, path, `Maximum length is ${sch.maxLength}`);
        if (typeof sch.pattern === 'string') {
            try {
                const re = new RegExp(sch.pattern);
                if (!re.test(v)) pushErr(out, path, `Must match pattern ${sch.pattern}`);
            } catch {
                // ignore bad pattern
            }
        }
    };

    const validateArray = (v: any, sch: any, path: (string | number)[], out: Record<string, string[]>) => {
        if (!Array.isArray(v)) {
            pushErr(out, path, 'Expected array');
            return;
        }
        if (typeof sch.minItems === 'number' && v.length < sch.minItems) pushErr(out, path, `At least ${sch.minItems} items required`);
        if (typeof sch.maxItems === 'number' && v.length > sch.maxItems) pushErr(out, path, `At most ${sch.maxItems} items allowed`);
        if (sch.uniqueItems) {
            const seen = new Set(v.map((x: any) => JSON.stringify(x)));
            if (seen.size !== v.length) pushErr(out, path, 'Array items must be unique');
        }
        if (sch.items) {
            v.forEach((item: any, idx: number) => validateValue(item, sch.items, [...path, idx], out));
        }
    };

    const validateObject = (v: any, sch: any, path: (string | number)[], out: Record<string, string[]>) => {
        if (typeof v !== 'object' || v === null || Array.isArray(v)) {
            pushErr(out, path, 'Expected object');
            return;
        }
        const props = sch.properties || {};
        const required: string[] = Array.isArray(sch.required) ? sch.required : [];
        for (const req of required) {
            if (isEmpty((v as any)[req])) pushErr(out, [...path, req], 'Required');
        }
        for (const [k, childSchema] of Object.entries<any>(props)) {
            if ((v as any)[k] !== undefined) validateValue((v as any)[k], childSchema, [...path, k], out);
        }
    };

    const validateEnum = (v: any, sch: any, path: (string | number)[], out: Record<string, string[]>) => {
        if (Array.isArray(sch.enum) && !sch.enum.includes(v)) {
            pushErr(out, path, `Must be one of: ${sch.enum.join(', ')}`);
        }
    };

    const validateOneOf = (v: any, variants: any[], path: (string | number)[], out: Record<string, string[]>) => {
        let anyPass = false;
        for (const variant of variants) {
            const tmp: Record<string, string[]> = {};
            validateValue(v, variant, path, tmp);
            if (Object.keys(tmp).length === 0) { anyPass = true; break; }
        }
        if (!anyPass) pushErr(out, path, 'Does not match any allowed schema');
    };

    const validateValue = (v: any, sch: any, path: (string | number)[], out: Record<string, string[]>) => {
        if (!sch) return;
        // handle union
        if (Array.isArray(sch.oneOf) && sch.oneOf.length > 0) {
            validateOneOf(v, sch.oneOf, path, out);
            return;
        }

        // handle multi-type e.g., { type: ["integer", "number"] }
        if (Array.isArray(sch.type) && sch.type.length > 0) {
            const variants = sch.type.map((tt: any) => ({ ...sch, type: tt }));
            validateOneOf(v, variants, path, out);
            return;
        }

        // enum
        if (Array.isArray(sch.enum)) validateEnum(v, sch, path, out);

        const t = sch.type;
        switch (t) {
            case 'integer':
            case 'number':
                validateNumber(v, sch, path, out);
                break;
            case 'string':
                validateString(v, sch, path, out);
                break;
            case 'boolean':
                if (typeof v !== 'boolean') pushErr(out, path, 'Expected boolean');
                break;
            case 'array':
                validateArray(v, sch, path, out);
                break;
            case 'object':
                validateObject(v, sch, path, out);
                break;
            case 'hinst':
                // Treat custom type 'hinst' like a string with optional pattern/min/max from schema
                validateString(v, sch, path, out);
                break;
            default:
                // If no explicit type, try to infer from subschemas
                if (sch.properties) validateObject(v, { type: 'object', ...sch }, path, out);
                else if (sch.items) validateArray(v, { type: 'array', ...sch }, path, out);
        }
    };

    const validateForm = React.useCallback((value: JsonObject, sch: any | undefined) => {
        const out: Record<string, string[]> = {};
        if (sch) validateValue(value, sch, [], out);
        setErrors(out);
    }, []);

    // Revalidate when data or schema changes
    React.useEffect(() => {
        validateForm(formData, schema);
    }, [formData, schema, validateForm]);

    // Utilities to update deep values immutably
    const setDeepValue = (obj: JsonObject, path: (string | number)[], value: JsonValue): JsonObject => {
        if (path.length === 0) return obj;
        const [head, ...rest] = path;
        const clone: any = Array.isArray(obj) ? [...(obj as any)] : { ...obj };
        if (rest.length === 0) {
            (clone as any)[head as any] = value as any;
            return clone;
        }
        const next = (clone as any)[head as any];
        (clone as any)[head as any] = setDeepValue(
            (typeof next === 'object' && next !== null ? next : {} as any) as JsonObject,
            rest,
            value
        );
        return clone;
    };

    const handleChangeAtPath = (path: (string | number)[], value: JsonValue) => {
        setFormData(prev => setDeepValue(prev, path, value));
    };

    const typeLabelFromSchema = (sch: any | undefined): string | undefined => {
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
        if (sch.oneOf) return 'union';
        return undefined;
    };

    const getSchemaForPath = (path: (string | number)[]): any | undefined => {
        if (!schema) return undefined;
        let node: any = schema;
        for (const seg of path) {
            // If node is union, try to pick an object/array branch preferentially
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
                // For arrays, descend into items regardless of index value
                node = node.items;
                // do not attempt to index properties by numeric index here; next loop segment will handle nested keys
            } else {
                // unknown structure
                return undefined;
            }
            if (!node) return undefined;
        }
        return node;
    };

    const renderField = (name: (string | number)[], value: JsonValue) => {
        if (value === null) return null;
        const label = name[name.length - 1];
        const fieldKey = name.join('.');
        // derive schema at any depth (still displayed minimally)
        const nodeSchema = getSchemaForPath(name);
        const typeLabel = typeLabelFromSchema(nodeSchema);
        const desc = nodeSchema?.description as string | undefined;
        const fieldErrors = errors[fieldKey] || [];

        // Array handling
        if (Array.isArray(value)) {
            return (
                <div key={fieldKey} className="je-section">
                    <details open>
                        <summary className="je-label je-summary" title={desc || ''}>
                            {String(label)}{typeLabel ? <span className="je-type-badge">{typeLabel}</span> : null}
                        </summary>
                        <div className="je-pl-12 je-mt-8">
                            {value.map((item, index) => (
                                <div key={`${fieldKey}.${index}`} className="je-row-tight je-mb-8">
                                    <div className="je-grow">
                                        {typeof item === 'object' && item !== null ? (
                                            renderField([...name, index], item)
                                        ) : (
                                            (() => {
                                                const itemKey = `${fieldKey}.${index}`;
                                                const itemErrors = errors[itemKey] || [];
                                                return (
                                                    <>
                                                        <input
                                                            className={`je-input ${itemErrors.length ? 'je-input-error' : ''}`}
                                                            value={String(item ?? '')}
                                                            onChange={(e) => {
                                                                const newArr = [...value];
                                                                newArr[index] = e.target.value;
                                                                handleChangeAtPath(name, newArr);
                                                            }}
                                                        />
                                                        {itemErrors.length > 0 && (
                                                            <div className="je-error-text">
                                                                {itemErrors.map((m, i) => (<div key={i}>{m}</div>))}
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        onClick={() => {
                                            const newArr = value.slice();
                                            newArr.splice(index, 1);
                                            handleChangeAtPath(name, newArr);
                                        }}
                                    >
                                        X
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                className="btn btn-success je-mt-4"
                                onClick={() => {
                                    const newArr = [...value];
                                    const newItem = value.length > 0
                                        ? JSON.parse(JSON.stringify(value[value.length - 1]))
                                        : '';
                                    newArr.push(newItem as any);
                                    handleChangeAtPath(name, newArr);
                                }}
                            >
                                +
                            </button>
                            {fieldErrors.length > 0 && (
                                <div className="je-error-text">
                                    {fieldErrors.map((m, i) => (<div key={i}>{m}</div>))}
                                </div>
                            )}
                        </div>
                    </details>
                </div>
            );
        }

        // Object handling
        if (typeof value === 'object' && value !== null) {
            return (
                <div key={fieldKey} className="je-section">
                    <details open>
                        <summary className="je-label je-summary" title={desc || ''}>
                            {String(label)}{typeLabel ? <span className="je-type-badge">{typeLabel}</span> : null}
                        </summary>
                        <div className="je-pl-12 je-mt-8">
                            {Object.entries(value as JsonObject).map(([k, v]) => (
                                <div key={`${fieldKey}.${k}`} className="je-mb-8">
                                    {renderField([...name, k], v)}
                                </div>
                            ))}
                        </div>
                    </details>
                </div>
            );
        }

        // Primitive handling
        return (
            <div key={fieldKey} className="je-row">
                <label className="je-label je-label-inline je-min-150" title={desc || ''}>
                    {String(label)}{typeLabel ? <span className="je-type-badge">{typeLabel}</span> : null}
                </label>
                {typeof value === 'boolean' ? (
                    <div>
                        <input
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(e) => handleChangeAtPath(name, e.target.checked)}
                        />
                    </div>
                ) : typeof value === 'number' ? (
                    <div className="je-grow">
                        <input
                            type="number"
                            className={`je-input ${fieldErrors.length ? 'je-input-error' : ''}`}
                            value={Number.isFinite(value) ? String(value) : ''}
                            onChange={(e) => {
                                const num = e.target.value === '' ? 0 : Number(e.target.value);
                                handleChangeAtPath(name, isNaN(num) ? 0 : num);
                            }}
                        />
                        {fieldErrors.length > 0 && (
                            <div className="je-error-text">
                                {fieldErrors.map((m, i) => (<div key={i}>{m}</div>))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="je-grow">
                        <input
                            type="text"
                            className={`je-input ${fieldErrors.length ? 'je-input-error' : ''}`}
                            value={String(value ?? '')}
                            onChange={(e) => handleChangeAtPath(name, e.target.value)}
                        />
                        {fieldErrors.length > 0 && (
                            <div className="je-error-text">
                                {fieldErrors.map((m, i) => (<div key={i}>{m}</div>))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const countNestedErrors = (prefix: string) => {
        const p = prefix ? `${prefix}.` : '';
        return Object.entries(errors).reduce((acc, [k, v]) => acc + (k === prefix || k.startsWith(p) ? v.length : 0), 0);
    };

    const hasErrors = Object.keys(errors).length > 0;
    const schemaLabel = React.useMemo(() => {
        if (!schema) return '';
        const title = (schema && typeof schema.title === 'string') ? schema.title : '';
        const id = (schema && typeof schema.$id === 'string') ? schema.$id : '';
        return title || id || 'provided schema';
    }, [schema]);

    return (
        <div className="json-editor json-editor-container">
            {(Object.entries(formData).length === 0) ?
                <p>Open a .yaml file to edit it</p> :
                <div className="je-flex je-justify-start">
                    <button
                        type="button"
                        className="btn btn-success"
                        disabled={hasErrors}
                        title={hasErrors ? 'Fix validation errors before saving' : ''}
                        onClick={() => onSave?.(formData)}
                    >
                        Save
                    </button>
                </div>
            }
            {formData && Object.entries(formData).map(([key, value]) => (
                <div key={key} className="je-mb-8">
                    <div>
                        {renderField([key], value)}
                        {countNestedErrors(key) > 0 && (
                            <div className="je-error-text je-mt-4">{countNestedErrors(key)} error(s) in this section</div>
                        )}
                    </div>
                </div>
            ))}
            {!hasErrors && schema && Object.keys(formData || {}).length > 0 && (
                <div className="je-valid-note je-mt-8">All fields valid — checked against {schemaLabel}.</div>
            )}
        </div>
    );
};

export default JsonEditor;
