import FileSelector from './FileSelector'
import SelectedFileInfo from './SelectedFileInfo'
import type { LibraryFiles } from '../types'
import { memo } from 'react'

export type LibraryPanelProps = {
  libraryFiles: LibraryFiles | null | undefined
  selectedFile: string
  projectName?: string
  defaultExpandFolders?: Array<string>
  onFileSelect: (filePath: string) => void
  onAddFile: (filePath: string, content: any) => void
  onDeleteFile: (filePath: string) => void
  onReplaceFile: (filePath: string) => void
  onDownloadFile: (filePath: string) => void
}

function LibraryPanel(props: LibraryPanelProps) {
  const { libraryFiles, selectedFile, projectName, defaultExpandFolders, onFileSelect, onAddFile, onDeleteFile, onReplaceFile, onDownloadFile } = props
  return (
    <div className="col">
      <FileSelector
        onFileSelect={onFileSelect}
        selectedFile={selectedFile}
        libraryFiles={libraryFiles ?? undefined}
        projectName={projectName}
        onAddFile={onAddFile}
        onDeleteFile={onDeleteFile}
        onReplaceFile={onReplaceFile}
        onDownloadFile={onDownloadFile}
        defaultExpandFolders={defaultExpandFolders}
      />
      <SelectedFileInfo selectedFile={selectedFile} />
    </div>
  )
}

export default memo(LibraryPanel)
