import React from 'react';
import './JsonEditor.css';

type JsonPrimitive = string | number | boolean | null;
type JsonArray = JsonValue[];
export type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonPrimitive | JsonArray | JsonObject;

// Lightweight JSON editor without external UI libraries

interface JsonEditorProps {
    data: JsonObject;
    onChange?: (data: JsonObject) => void;
    onSave?: (data: JsonObject) => void;
}

const JsonEditor: React.FC<JsonEditorProps> = ({ data, onChange, onSave }) => {
    const [formData, setFormData] = React.useState<JsonObject>(data);
    const didMountRef = React.useRef(false);
    const skipNextOnChangeRef = React.useRef(false);

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

    const renderField = (name: (string | number)[], value: JsonValue) => {
        if (value === null) return null;
        const label = name[name.length - 1];
        const fieldKey = name.join('.');

        // Array handling
        if (Array.isArray(value)) {
            return (
                <div key={fieldKey} className="je-section">
                    <details open>
                        <summary className="je-label je-summary">{String(label)}</summary>
                        <div className="je-pl-12 je-mt-8">
                            {value.map((item, index) => (
                                <div key={`${fieldKey}.${index}`} className="je-row-tight je-mb-8">
                                    <div className="je-grow">
                                        {typeof item === 'object' && item !== null ? (
                                            renderField([...name, index], item)
                                        ) : (
                                            <input
                                                className="je-input"
                                                value={String(item ?? '')}
                                                onChange={(e) => {
                                                    const newArr = [...value];
                                                    newArr[index] = e.target.value;
                                                    handleChangeAtPath(name, newArr);
                                                }}
                                            />
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
                        <summary className="je-label je-summary">{String(label)}</summary>
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
                <label className="je-label je-label-inline je-min-150">{String(label)}</label>
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
                            className="je-input"
                            value={Number.isFinite(value) ? String(value) : ''}
                            onChange={(e) => {
                                const num = e.target.value === '' ? 0 : Number(e.target.value);
                                handleChangeAtPath(name, isNaN(num) ? 0 : num);
                            }}
                        />
                    </div>
                ) : (
                    <div className="je-grow">
                        <input
                            type="text"
                            className="je-input"
                            value={String(value ?? '')}
                            onChange={(e) => handleChangeAtPath(name, e.target.value)}
                        />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="json-editor json-editor-container">
            {(Object.entries(formData).length === 0) ?
                <p>Open a .yaml file to edit it</p> :
                <div className="je-flex je-justify-start">
                    <button
                        type="button"
                        className="btn btn-success"
                        onClick={() => onSave?.(formData)}
                    >
                        Save
                    </button>
                </div>
            }
            {formData && Object.entries(formData).map(([key, value]) => (
                <div key={key} className="je-mb-8">
                    {renderField([key], value)}
                </div>
            ))}
        </div>
    );
};

export default JsonEditor;
