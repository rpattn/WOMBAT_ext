import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/test-utils'
import LibraryPanel from '../components/LibraryPanel'

const sampleFiles = {
  yaml_files: ['project\\config\\base.yaml'],
  csv_files: ['project\\plant\\layout.csv'],
  html_files: [],
  png_files: [],
}

describe('LibraryPanel', () => {
  test('renders file tree and triggers handlers', async () => {
    const user = userEvent.setup()
    const onFileSelect = vi.fn()
    const onAddFile = vi.fn()
    const onDeleteFile = vi.fn()
    const onReplaceFile = vi.fn()
    const onDownloadFile = vi.fn()

    renderWithProviders(
      <LibraryPanel
        libraryFiles={sampleFiles as any}
        selectedFile=""
        projectName="my-project"
        onFileSelect={onFileSelect}
        onAddFile={onAddFile}
        onDeleteFile={onDeleteFile}
        onReplaceFile={onReplaceFile}
        onDownloadFile={onDownloadFile}
      />
    )

    // Header and counts
    expect(screen.getByText(/library files/i)).toBeInTheDocument()
    expect(screen.getByText(/1 YAML, 1 CSV, 0 HTML, 0 PNG/i)).toBeInTheDocument()

    // Click on file to select
    const fileNode = screen.getByText('base.yaml')
    await user.click(fileNode)
    expect(onFileSelect).toHaveBeenCalledWith('project\\config\\base.yaml')

    // Hover actions are visible; use the "Download" button by aria-label
    const row = fileNode.closest('.tree-file')!
    const actions = within(row as HTMLElement).getByRole('button', { name: /download file/i, hidden: true })
    await user.click(actions)
    expect(onDownloadFile).toHaveBeenCalledWith('project\\config\\base.yaml')
  })
})
