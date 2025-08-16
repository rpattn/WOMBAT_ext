import SavedLibrariesDropdown from './SavedLibrariesDropdown'

export type SavedLibrariesBarProps = {
  libraries: string[]
  value: string
  onChange: (val: string) => void
  onDelete?: (val: string) => void
  children?: React.ReactNode
}

export default function SavedLibrariesBar({ libraries, value, onChange, onDelete, children }: SavedLibrariesBarProps) {
  return (
    <div className="row" style={{ marginBottom: '0.75rem', alignItems: 'center' }}>
      <div className="col">
        <SavedLibrariesDropdown
          libraries={libraries}
          value={value}
          onChange={onChange}
        >
          {value && (
            <button
              className="btn btn-outline-danger"
              onClick={() => {
                if (!value) return
                if (!onDelete) return
                onDelete(value)
              }}
            >Delete</button>
          )}
        </SavedLibrariesDropdown>
        {children}
      </div>
    </div>
  )
}
