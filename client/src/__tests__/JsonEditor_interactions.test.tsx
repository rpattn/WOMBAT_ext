import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import JsonEditor, { type JsonObject } from '../components/JsonEditor'

describe('JsonEditor interactions', () => {
  it('shows empty prompt when no data', () => {
    render(<JsonEditor data={{} as JsonObject} />)
    expect(screen.getByText('Open a .yaml file to edit it')).toBeInTheDocument()
  })

  it('calls onChange for primitive edits and supports boolean/number', () => {
    const onChange = vi.fn()
    render(<JsonEditor data={{ a: 1, b: false, c: 'x' }} onChange={onChange} />)

    // number field
    const num = screen.getByDisplayValue('1') as HTMLInputElement
    fireEvent.change(num, { target: { value: '2' } })
    // checkbox
    const chk = screen.getByRole('checkbox') as HTMLInputElement
    fireEvent.click(chk)
    // text
    const txt = screen.getByDisplayValue('x') as HTMLInputElement
    fireEvent.change(txt, { target: { value: 'y' } })

    // onChange is debounced via effect, but should have been called >=1 times
    expect(onChange).toHaveBeenCalled()
    const last = onChange.mock.lastCall?.[0]
    expect(last).toMatchObject({ a: 2, b: true, c: 'y' })
  })

  it('handles array add/remove and onSave', () => {
    const onChange = vi.fn()
    const onSave = vi.fn()
    render(<JsonEditor data={{ arr: ['a'] }} onChange={onChange} onSave={onSave} />)

    // click + to add another item
    const addBtn = screen.getAllByText('+')[0]
    fireEvent.click(addBtn)

    // two inputs for arr now
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
    expect(inputs.length).toBeGreaterThanOrEqual(2)

    // remove first item by clicking X near first array row button (button with text X)
    const removeBtn = screen.getAllByText('X')[0]
    fireEvent.click(removeBtn)

    // Save button should call onSave with current state
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalled()
  })
})
