type Props = {
  libraries: string[];
  value: string | '';
  onChange: (value: string) => void;
  label?: string;
  children?: React.ReactNode;
};

export default function SavedLibrariesDropdown({ libraries, value, onChange, label = 'Saved Libraries', children }: Props) {
  const hasItems = Array.isArray(libraries) && libraries.length > 0;
  return (
    <div className="saved-libs" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <label className="saved-libs-label" style={{ marginBottom: '5px' }}>
        <span className="saved-libs-label-text">{label}</span>
        <select
          className="saved-libs-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {/* Empty value represents the working session (unsaved/current) */}
          <option value="">{hasItems ? 'Working session (current)' : 'No saved libraries found'}</option>
          {libraries.map((dir) => (
            <option key={dir} value={dir}>{dir}</option>
          ))}
        </select>
      </label>
      {children && value && (
        <div className="saved-libs-actions" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>{children}</div>
      )}
    </div>
  );
}
