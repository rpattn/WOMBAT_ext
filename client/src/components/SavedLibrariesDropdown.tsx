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
    <div className="saved-libs">
      <label className="saved-libs-label">
        <span className="saved-libs-label-text">{label}</span>
        <select
          className="saved-libs-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{hasItems ? 'Select a saved library…' : 'No saved libraries found'}</option>
          {libraries.map((dir) => (
            <option key={dir} value={dir}>{dir}</option>
          ))}
        </select>
      </label>
      {children && (
        <div className="saved-libs-actions">{children}</div>
      )}
    </div>
  );
}
