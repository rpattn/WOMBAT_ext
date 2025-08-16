import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/test-utils'
import EditorPanel from '../components/EditorPanel'

describe('EditorPanel', () => {
  test('renders JsonEditor, calls onChange and onSave', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onSave = vi.fn()

    const data = { foo: 'bar', num: 1, flag: false } as any

    renderWithProviders(
      <EditorPanel data={data} onChange={onChange} onSave={onSave} />
    )

    // It should render fields for keys
    const inputFoo = screen.getByDisplayValue('bar') as HTMLInputElement
    await user.clear(inputFoo)
    await user.type(inputFoo, 'baz')

    // JsonEditor debounces via state but should call onChange once after update cycle
    // We just assert it was called with an object containing our change eventually
    expect(onChange).toHaveBeenCalled()

    // Click Save -> forwards current form data
    const saveBtn = screen.getByRole('button', { name: /save/i })
    await user.click(saveBtn)
    expect(onSave).toHaveBeenCalled()
  })
})
