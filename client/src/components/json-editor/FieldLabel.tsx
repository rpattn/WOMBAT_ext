import React from 'react';

type Props = {
  label: string | number;
  typeLabel?: string;
  title?: string;
  htmlFor?: string;
};

const FieldLabel: React.FC<Props> = ({ label, typeLabel, title, htmlFor }) => (
  <label className="je-label je-label-inline je-min-150" title={title || ''} htmlFor={htmlFor}>
    {String(label)}{typeLabel ? <span className="je-type-badge">{typeLabel}</span> : null}
  </label>
);

export default React.memo(FieldLabel);
