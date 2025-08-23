import type { ReactNode } from 'react'
import { } from 'react'
import SavedLibrariesDropdown from './SavedLibrariesDropdown'
import { useApiContext } from '../context/ApiContext'
import ResizeWrapper from './ResizeWrapper'

export type PageWithLibraryProps = {
  title: string
  sidebar?: ReactNode
  children: ReactNode
  projectLabel?: string
  projectActions?: ReactNode
  projectPlacement?: 'header' | 'sidebar'
}

export default function PageWithLibrary({ title, sidebar, children, projectLabel = 'Project', projectActions, projectPlacement = 'header' }: PageWithLibraryProps) {
  const {
    savedLibraries,
    selectedSavedLibrary,
    setSelectedSavedLibrary,
    loadSaved,
    restoreWorking,
  } = useApiContext()

  // (dropdown now rendered inline in the sidebar when projectPlacement==='sidebar')

  return (
    <div className="app-container app-full" style={{ gap: 12 }}>
      <h2>{title}</h2>

      <div className="row stack-sm" style={{ gap: 0, alignItems: 'stretch' }}>
        {sidebar && (
          <ResizeWrapper
            minWidth={260}
            maxWidth={800}
            defaultWidth={380}
            lsKey={'pageWithLibrary.sidebarWidth'}
            addFillerPane={false}
            collapsible={true}
            defaultCollapsed={false}
          >
            <>
              {projectPlacement === 'sidebar' && (
                <div>
                  <h3 className="panel-title">{projectLabel}</h3>
                  <div className="panel-body">
                    <SavedLibrariesDropdown
                      libraries={savedLibraries}
                      value={selectedSavedLibrary}
                      onChange={(val: string) => {
                        setSelectedSavedLibrary(val)
                        try { window.localStorage.setItem('lastSavedLibraryName', val || '') } catch {}
                        if (val) {
                          loadSaved(val).catch(() => {})
                        } else {
                          // switching back to working session: restore from server-side backup
                          restoreWorking().catch(() => {})
                        }
                      }}
                    >
                      {projectActions}
                    </SavedLibrariesDropdown>
                  </div>
                </div>
              )}
              {sidebar}
            </>
          </ResizeWrapper>
        )}
        <main style={{ flex: 1, minWidth: 320}}>
          {children}
          {projectPlacement !== 'sidebar' && projectActions && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              {projectActions}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
