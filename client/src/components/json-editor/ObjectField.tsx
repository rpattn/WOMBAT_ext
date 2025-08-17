import React from 'react';
import { typeLabelFromSchema } from './utils/schema';
import type { JsonObject, JsonValue } from './utils/path';

type Props = {
  name: (string | number)[];
  value: JsonObject;
  schemaNode: any;
  renderField: (name: (string | number)[], value: JsonValue) => React.ReactNode;
};

const ObjectField: React.FC<Props> = ({ name, value, schemaNode, renderField }) => {
  const label = name[name.length - 1];
  const fieldKey = name.join('.');
  const typeLabel = typeLabelFromSchema(schemaNode);
  const desc = schemaNode?.description as string | undefined;
  const entries = Object.entries(value || {});

  return (
    <div key={fieldKey} className="je-section">
      <details open>
        <summary className="je-label je-summary" title={desc || ''}>
          {String(label)}{typeLabel ? <span className="je-type-badge">{typeLabel}</span> : null}
        </summary>
        <div className="je-pl-12 je-mt-8">
          {entries.map(([k, v]) => (
            <div key={`${fieldKey}.${k}`} className="je-mb-8">
              {renderField([...name, k], v as any)}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
};

export default React.memo(ObjectField);
