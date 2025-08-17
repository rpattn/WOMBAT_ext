import React from 'react';
import { typeLabelFromSchema } from './utils/schema';
import ErrorList from './ErrorList';
import type { JsonValue } from './utils/path';

type Props = {
  name: (string | number)[];
  value: JsonValue[];
  schemaNode: any;
  errors: Record<string, string[]>;
  onChangeAtPath: (path: (string | number)[], value: JsonValue) => void;
  renderField: (name: (string | number)[], value: JsonValue) => React.ReactNode;
};

const ArrayField: React.FC<Props> = ({ name, value, schemaNode, errors, onChangeAtPath, renderField }) => {
  const label = name[name.length - 1];
  const fieldKey = name.join('.');
  const typeLabel = typeLabelFromSchema(schemaNode);
  const desc = schemaNode?.description as string | undefined;
  const fieldErrors = errors[fieldKey] || [];

  const onRemove = (index: number) => {
    const newArr = value.slice();
    newArr.splice(index, 1);
    onChangeAtPath(name, newArr);
  };

  const onAdd = () => {
    const itemSchema = (schemaNode as any)?.items;
    const enumOpts: any[] | undefined = Array.isArray(itemSchema?.enum) ? itemSchema.enum : undefined;
    const newItem = enumOpts && enumOpts.length > 0
      ? String(enumOpts[0])
      : (value.length > 0 ? JSON.parse(JSON.stringify(value[value.length - 1])) : '' as any);
    const newArr = [...value, newItem as any];
    onChangeAtPath(name, newArr);
  };

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
                    const itemSchema = (schemaNode as any)?.items;
                    const enumOpts: any[] | undefined = Array.isArray(itemSchema?.enum) ? itemSchema.enum : undefined;
                    if (enumOpts && enumOpts.length > 0) {
                      return (
                        <>
                          <select
                            className={`je-input ${itemErrors.length ? 'je-input-error' : ''}`}
                            value={String(item ?? '')}
                            onChange={(e) => {
                              const newArr = [...value];
                              newArr[index] = e.target.value;
                              onChangeAtPath(name, newArr);
                            }}
                          >
                            {enumOpts.map((opt, oi) => (
                              <option key={oi} value={String(opt)}>{String(opt)}</option>
                            ))}
                          </select>
                          <ErrorList errors={itemErrors} id={`${itemKey.replace(/\./g, '-')}-errors`} />
                        </>
                      );
                    }
                    return (
                      <>
                        <input
                          className={`je-input ${itemErrors.length ? 'je-input-error' : ''}`}
                          value={String(item ?? '')}
                          aria-invalid={itemErrors.length > 0}
                          aria-describedby={itemErrors.length ? `${itemKey.replace(/\./g, '-')}-errors` : undefined}
                          onChange={(e) => {
                            const newArr = [...value];
                            newArr[index] = e.target.value;
                            onChangeAtPath(name, newArr);
                          }}
                        />
                        <ErrorList errors={itemErrors} id={`${itemKey.replace(/\./g, '-')}-errors`} />
                      </>
                    );
                  })()
                )}
              </div>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => onRemove(index)}
              >
                X
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-success je-mt-4"
            onClick={onAdd}
          >
            +
          </button>
          <ErrorList errors={fieldErrors} />
        </div>
      </details>
    </div>
  );
};

export default React.memo(ArrayField);
