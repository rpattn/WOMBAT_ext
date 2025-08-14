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
    <div className="saved-libs" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <label style={{ display: 'inline-flex', alignItems: 'center', marginBottom: 0 }}>
        <span style={{ marginRight: 8 }}>{label}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ padding: '6px 8px', minWidth: 240 }}
        >
          <option value="">{hasItems ? 'Select a saved library…' : 'No saved libraries found'}</option>
          {libraries.map((dir) => (
            <option key={dir} value={dir}>{dir}</option>
          ))}
        </select>
      </label>
      {children}
    </div>
  );
}
