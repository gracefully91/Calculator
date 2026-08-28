import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LinkBar } from './LinkBar'

describe('LinkBar', () => {
  it('displays t formatted to 2 decimal places', () => {
    render(<LinkBar t={3.14159} />)
    expect(screen.getByText(/현재 t = 3\.14/)).toBeInTheDocument()
  })

  it('reflects a changed t value on re-render', () => {
    const { rerender } = render(<LinkBar t={0} />)
    expect(screen.getByText(/현재 t = 0\.00/)).toBeInTheDocument()

    rerender(<LinkBar t={-2.5} />)
    expect(screen.getByText(/현재 t = -2\.50/)).toBeInTheDocument()
  })
})
