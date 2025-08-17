import React from 'react';

type Props = {
  id?: string;
  errors: string[];
};

const ErrorList: React.FC<Props> = ({ id, errors }) => {
  if (!errors || errors.length === 0) return null;
  return (
    <div className="je-error-text" id={id}>
      {errors.map((m, i) => (<div key={i}>{m}</div>))}
    </div>
  );
};

export default React.memo(ErrorList);
