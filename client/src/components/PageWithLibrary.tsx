import type { ReactNode } from 'react'
import SavedLibrariesDropdown from './SavedLibrariesDropdown'
import { useApiContext } from '../context/ApiContext'

export type PageWithLibraryProps = {
  title: string
  sidebar?: ReactNode
  children: ReactNode
  projectLabel?: string
  projectActions?: ReactNode
}

export default function PageWithLibrary({ title, sidebar, children, projectLabel = 'Project', projectActions }: PageWithLibraryProps) {
  const {
    savedLibraries,
    selectedSavedLibrary,
    setSelectedSavedLibrary,
    loadSaved,
  } = useApiContext()

  return (
    <div className="app-container app-full" style={{ gap: 12 }}>
      <h2>{title}</h2>

      <div className="section" style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        padding: 'var(--space-8)'
      }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>{projectLabel}</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="saved-libs" style={{ maxWidth: 520 }}>
            <SavedLibrariesDropdown
              libraries={savedLibraries}
              value={selectedSavedLibrary}
              onChange={(val: string) => {
                setSelectedSavedLibrary(val)
                try { window.localStorage.setItem('lastSavedLibraryName', val || '') } catch {}
                if (val) { loadSaved(val).catch(() => {}) }
              }}
            />
          </div>
          {projectActions && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {projectActions}
            </div>
          )}
        </div>
      </div>

      <div className="row stack-sm" style={{ gap: 16, alignItems: 'flex-start' }}>
        {sidebar && (
          <aside style={{ minWidth: 320, flex: '0 0 380px' }} className="panel">
            {sidebar}
          </aside>
        )}
        <main style={{ flex: 1, minWidth: 320 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
