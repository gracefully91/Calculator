import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ObjectList } from './ObjectList'

const COLORS = ['red', 'green', 'blue']

describe('ObjectList', () => {
  it('renders one row per piece with its expression and a swatch, and reflects visibility in the eye icon', () => {
    const pieces = [
      { id: 1, expr: 'x^2' },
      { id: 2, expr: 'x+1' },
    ]
    render(
      <ObjectList
        pieces={pieces}
        isVisible={(id) => id !== 2}
        onToggle={vi.fn()}
        colors={COLORS}
      />,
    )
    expect(screen.getByText('x^2')).toBeInTheDocument()
    expect(screen.getByText('x+1')).toBeInTheDocument()
    // visible piece 1 shows the open eye, hidden piece 2 shows the
    // slashed/closed eye -- distinct glyphs, not just distinct booleans.
    const toggle1 = screen.getByLabelText('toggle visibility 1')
    const toggle2 = screen.getByLabelText('toggle visibility 2')
    expect(toggle1.textContent).toBe('👁️')
    expect(toggle2.textContent).toBe('👁️‍🗨️')
  })

  it('calls onToggle with the piece id (not its array index) when the eye icon is clicked', async () => {
    const onToggle = vi.fn()
    const pieces = [
      { id: 5, expr: 'x' },
      { id: 9, expr: 'x^2' },
    ]
    render(<ObjectList pieces={pieces} isVisible={() => true} onToggle={onToggle} colors={COLORS} />)
    await userEvent.click(screen.getByLabelText('toggle visibility 2'))
    expect(onToggle).toHaveBeenCalledWith(9)
    expect(onToggle).not.toHaveBeenCalledWith(1)
  })

  it('cycles through the color palette via modulo instead of returning undefined once pieces outnumber colors', () => {
    const pieces = [
      { id: 1, expr: 'x' },
      { id: 2, expr: 'x' },
      { id: 3, expr: 'x' },
      { id: 4, expr: 'x' }, // 4th piece, only 3 colors supplied -> wraps to colors[0]
    ]
    const { container } = render(
      <ObjectList pieces={pieces} isVisible={() => true} onToggle={vi.fn()} colors={COLORS} />,
    )
    const swatches = container.querySelectorAll('span[aria-hidden="true"]')
    expect(swatches).toHaveLength(4)
    expect(swatches[0].style.background).toBe('red')
    expect(swatches[1].style.background).toBe('green')
    expect(swatches[2].style.background).toBe('blue')
    expect(swatches[3].style.background).toBe('red') // wrapped back around, not blank/undefined
  })
})
