import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/test-utils'
import SavedLibrariesBar from '../components/SavedLibrariesBar'

describe('SavedLibrariesBar', () => {
  test('renders dropdown and triggers onChange and onDelete', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onDelete = vi.fn()

    renderWithProviders(
      <SavedLibrariesBar
        libraries={["alpha", "beta"]}
        value="alpha"
        onChange={onChange}
        onDelete={onDelete}
      />
    )

    // Dropdown present with current value
    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('alpha')

    // Change selection
    await user.selectOptions(select, 'beta')
    expect(onChange).toHaveBeenCalledWith('beta')

    // Delete button visible and clickable
    const delBtn = screen.getByRole('button', { name: /delete/i })
    await user.click(delBtn)
    expect(onDelete).toHaveBeenCalledWith('alpha')
  })
})
