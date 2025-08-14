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

  const editorStyles: React.CSSProperties = {
    backgroundColor: '#fff',
    color: '#222',
    borderRadius: 8,
    padding: 16,
    border: '1px solid #e5e7eb'
  };

  const labelStyles: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 6
  };

  const inputStyles: React.CSSProperties = {
    width: '90%',
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #d1d5db',
    backgroundColor: '#fff',
    color: '#111827'
  };

  const smallButton: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: 12,
    borderRadius: 6,
    border: '1px solid #d1d5db',
    background: '#f9fafb',
    cursor: 'pointer'
  };

  const primaryButton: React.CSSProperties = {
    padding: '8px 14px',
    fontSize: 14,
    borderRadius: 6,
    border: '1px solid #2563eb',
    background: '#3b82f6',
    color: '#fff',
    cursor: 'pointer'
  };

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
        <details key={fieldKey} open>
          <summary style={{ ...labelStyles, cursor: 'pointer' }}>{String(label)}</summary>
          <div style={{ paddingLeft: 12, marginTop: 8 }}>
            {value.map((item, index) => (
              <div key={`${fieldKey}.${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  {typeof item === 'object' && item !== null ? (
                    renderField([...name, index], item)
                  ) : (
                    <input
                      style={inputStyles}
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
                  style={smallButton}
                  onClick={() => {
                    const newArr = value.slice();
                    newArr.splice(index, 1);
                    handleChangeAtPath(name, newArr);
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
            <button
              type="button"
              style={{ ...smallButton, marginTop: 4 }}
              onClick={() => {
                const newArr = [...value, ''];
                handleChangeAtPath(name, newArr);
              }}
            >
              Add Item
            </button>
          </div>
        </details>
      );
    }

    // Object handling
    if (typeof value === 'object' && value !== null) {
      return (
        <details key={fieldKey} open>
          <summary style={{ ...labelStyles, cursor: 'pointer' }}>{String(label)}</summary>
          <div style={{ paddingLeft: 12, marginTop: 8 }}>
            {Object.entries(value as JsonObject).map(([k, v]) => (
              <div key={`${fieldKey}.${k}`} style={{ marginBottom: 8 }}>
                {renderField([...name, k], v)}
              </div>
            ))}
          </div>
        </details>
      );
    }

    // Primitive handling
    return (
      <div key={fieldKey} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'justify' }}>
        <label style={{ ...labelStyles, marginBottom: 0, minWidth: 100 }}>{String(label)}</label>
        {typeof value === 'boolean' ? (
          <div>
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleChangeAtPath(name, e.target.checked)}
            />
          </div>
        ) : typeof value === 'number' ? (
          <div style={{ flex: 1 }}>
            <input
              type="number"
              style={inputStyles}
              value={Number.isFinite(value) ? String(value) : ''}
              onChange={(e) => {
                const num = e.target.value === '' ? 0 : Number(e.target.value);
                handleChangeAtPath(name, isNaN(num) ? 0 : num);
              }}
            />
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            <input
              type="text"
              style={inputStyles}
              value={String(value ?? '')}
              onChange={(e) => handleChangeAtPath(name, e.target.value)}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="json-editor" style={editorStyles}>
      {formData && Object.entries(formData).map(([key, value]) => (
        <div key={key} style={{ marginBottom: 8 }}>
          {renderField([key], value)}
        </div>
      ))}
      {(Object.entries(formData).length === 0) &&
        <p>No data to display</p>
      }
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 16 }}>
        <button
          type="button"
          style={primaryButton}
          onClick={() => onSave?.(formData)}
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default JsonEditor;
