import React from 'react';
import FieldLabel from './FieldLabel';
import ErrorList from './ErrorList';
import { typeLabelFromSchema } from './utils/schema';
import type { JsonValue } from './utils/path';

type Props = {
  name: (string | number)[];
  value: Exclude<JsonValue, object | any[]>; // primitive
  schemaNode: any;
  errors: Record<string, string[]>;
  onChangeAtPath: (path: (string | number)[], value: JsonValue) => void;
};

const PrimitiveField: React.FC<Props> = ({ name, value, schemaNode, errors, onChangeAtPath }) => {
  const label = name[name.length - 1];
  const fieldKey = name.join('.');
  const typeLabel = typeLabelFromSchema(schemaNode);
  const desc = schemaNode?.description as string | undefined;
  const fieldErrors = errors[fieldKey] || [];
  const inputId = `je-${fieldKey.replace(/\./g, '-')}`;
  const errorId = fieldErrors.length ? `${inputId}-errors` : undefined;

  return (
    <div key={fieldKey} className="je-row">
      <FieldLabel label={label} typeLabel={typeLabel} title={desc} htmlFor={inputId} />
      {typeof value === 'boolean' ? (
        <div>
          <input
            type="checkbox"
            id={inputId}
            checked={Boolean(value)}
            onChange={(e) => onChangeAtPath(name, e.target.checked)}
          />
        </div>
      ) : typeof value === 'number' ? (
        <div className="je-grow">
          <input
            type="number"
            className={`je-input ${fieldErrors.length ? 'je-input-error' : ''}`}
            value={Number.isFinite(value) ? String(value) : ''}
            id={inputId}
            aria-invalid={fieldErrors.length > 0}
            aria-describedby={errorId}
            onChange={(e) => {
              const num = e.target.value === '' ? 0 : Number(e.target.value);
              onChangeAtPath(name, isNaN(num) ? 0 : num);
            }}
          />
          <ErrorList id={errorId} errors={fieldErrors} />
        </div>
      ) : (
        <div className="je-grow">
          {Array.isArray(schemaNode?.enum) && schemaNode.enum.length > 0 ? (
            <select
              className={`je-input ${fieldErrors.length ? 'je-input-error' : ''}`}
              value={String(value ?? '')}
              id={inputId}
              aria-invalid={fieldErrors.length > 0}
              aria-describedby={errorId}
              onChange={(e) => onChangeAtPath(name, e.target.value)}
            >
              {schemaNode.enum.map((opt: any, oi: number) => (
                <option key={oi} value={String(opt)}>{String(opt)}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className={`je-input ${fieldErrors.length ? 'je-input-error' : ''}`}
              value={String(value ?? '')}
              id={inputId}
              aria-invalid={fieldErrors.length > 0}
              aria-describedby={errorId}
              onChange={(e) => onChangeAtPath(name, e.target.value)}
            />
          )}
          <ErrorList id={errorId} errors={fieldErrors} />
        </div>
      )}
    </div>
  );
};

export default React.memo(PrimitiveField);
