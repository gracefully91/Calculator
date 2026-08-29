import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MathKeyboardToggle } from './MathKeyboardToggle'

afterEach(() => {
  delete window.mathVirtualKeyboard
})

describe('MathKeyboardToggle', () => {
  it('opens the one shared MathLive keyboard when it is hidden', async () => {
    const show = vi.fn()
    window.mathVirtualKeyboard = { visible: false, show, hide: vi.fn() }
    render(<MathKeyboardToggle />)

    await userEvent.click(screen.getByRole('button', { name: 'toggle math keyboard' }))

    expect(show).toHaveBeenCalledWith({ animate: true })
  })

  it('closes the shared MathLive keyboard when it is already visible', async () => {
    const hide = vi.fn()
    window.mathVirtualKeyboard = { visible: true, show: vi.fn(), hide }
    render(<MathKeyboardToggle />)

    await userEvent.click(screen.getByRole('button', { name: 'toggle math keyboard' }))

    expect(hide).toHaveBeenCalledWith({ animate: true })
  })
})
