import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EquationInput } from './EquationInput'

describe('EquationInput', () => {
  it('calls onChange with the raw text as the user types', async () => {
    const onChange = vi.fn()
    render(<EquationInput value="" onChange={onChange} error={null} />)
    const editor = screen.getByRole('textbox')
    await userEvent.type(editor, 'x')
    expect(onChange).toHaveBeenCalled()
  })

  it('shows the error message when error prop is set', () => {
    render(<EquationInput value="x +* 1" onChange={() => {}} error="Unexpected token" />)
    expect(screen.getByText(/Unexpected token/)).toBeInTheDocument()
  })
})
