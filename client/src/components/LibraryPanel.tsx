import FileSelector from './FileSelector'
import SelectedFileInfo from './SelectedFileInfo'
import type { LibraryFiles } from '../types'

export type LibraryPanelProps = {
  libraryFiles: LibraryFiles | null | undefined
  selectedFile: string
  projectName?: string
  onFileSelect: (filePath: string) => void
  onAddFile: (filePath: string, content: any) => void
  onDeleteFile: (filePath: string) => void
  onReplaceFile: (filePath: string) => void
  onDownloadFile: (filePath: string) => void
}

export default function LibraryPanel(props: LibraryPanelProps) {
  const { libraryFiles, selectedFile, projectName, onFileSelect, onAddFile, onDeleteFile, onReplaceFile, onDownloadFile } = props
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
      />
      <SelectedFileInfo selectedFile={selectedFile} />
    </div>
  )
}
