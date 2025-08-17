import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CsvPreview from '../components/CsvPreview'

const csv = `name,age,city\nAlice,30,Paris\nBob,25,London\nCharlie,40,New York\n`;

describe('CsvPreview', () => {
  it('renders table with headers and rows; supports filter and sort', async () => {
    const user = userEvent.setup()
    render(<CsvPreview preview={csv} filePath={'people.csv'} />)

    // Title and stats
    expect(screen.getByText(/CSV Viewer/i)).toBeInTheDocument()

    // Headers derived from first row
    const ths = screen.getAllByRole('columnheader')
    expect(ths.map(th => th.textContent?.trim())).toContain('name')

    // Rows
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()

    // Filter
    await user.type(screen.getByLabelText(/filter rows/i), 'Alice')
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Bob')).toBeNull()

    // Clear filter and test sort
    await user.clear(screen.getByLabelText(/filter rows/i))
    // Click Age header to sort asc then desc
    const ageIdx = ths.findIndex(th => (th.textContent || '').includes('age'))
    await user.click(ths[ageIdx]) // asc
    const rowsAsc = screen.getAllByRole('row').slice(1) // exclude header
    expect(rowsAsc[0]).toHaveTextContent('Bob')
    await user.click(ths[ageIdx]) // desc
    const rowsDesc = screen.getAllByRole('row').slice(1)
    expect(rowsDesc[0]).toHaveTextContent('Charlie')
  })

  it('returns null when not CSV or empty', () => {
    const { container, rerender } = render(<CsvPreview preview={null} filePath={'file.txt'} />)
    expect(container.firstChild).toBeNull()
    rerender(<CsvPreview preview={''} filePath={'file.csv'} />)
    expect(container.firstChild).toBeNull()
  })
})
