import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { GraphCanvas } from './GraphCanvas'

describe('GraphCanvas', () => {
  it('renders a canvas element without crashing', () => {
    const { container } = render(<GraphCanvas curves={[]} points={[]} />)
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('renders at the requested pixel size', () => {
    const { container } = render(
      <GraphCanvas curves={[]} points={[]} width={320} height={240} />
    )
    const canvas = container.querySelector('canvas')
    expect(canvas).toHaveAttribute('width', '320')
    expect(canvas).toHaveAttribute('height', '240')
  })

  it('does not crash when given curves and points to draw', () => {
    // jsdom has no real 2d canvas context, so this mainly proves the
    // component tolerates a null context (getContext('2d') returns null
    // in jsdom) without throwing during the draw effect.
    const curves = [{ fn: (x) => x * x, range: { xMin: -5, xMax: 5 } }]
    const points = [{ x: 1, y: 1, closed: true }]
    expect(() =>
      render(<GraphCanvas curves={curves} points={points} />)
    ).not.toThrow()
  })

  it('calls onCanvasClick with the event and current view on click', () => {
    const onCanvasClick = vi.fn()
    const { container } = render(
      <GraphCanvas curves={[]} points={[]} onCanvasClick={onCanvasClick} />
    )
    const canvas = container.querySelector('canvas')
    fireEvent.click(canvas)
    expect(onCanvasClick).toHaveBeenCalledTimes(1)
    const [, view] = onCanvasClick.mock.calls[0]
    expect(view).toMatchObject({
      xMin: -8,
      xMax: 8,
      yMin: -8,
      yMax: 8,
      width: 400,
      height: 400,
    })
  })

  it('accumulates a full drag sequence across multiple mousemoves (dragStart must survive re-renders)', () => {
    // Regression test for the dragStart-as-plain-variable bug: each
    // mousemove calls setWorldView, which re-renders the component. If
    // dragStart is a plain `let` in the component body (not a ref), the
    // re-render creates a fresh closure with dragStart reset to null, so
    // every mousemove after the first silently no-ops instead of
    // continuing the pan. With a ref-backed dragStart, the drag keeps
    // accumulating relative to the original mousedown position/view.
    const onCanvasClick = vi.fn()
    const { container } = render(
      <GraphCanvas curves={[]} points={[]} onCanvasClick={onCanvasClick} />
    )
    const canvas = container.querySelector('canvas')

    fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(canvas, { clientX: 110, clientY: 100 })
    fireEvent.mouseMove(canvas, { clientX: 120, clientY: 100 })
    fireEvent.mouseMove(canvas, { clientX: 130, clientY: 100 })
    fireEvent.mouseUp(canvas, { clientX: 130, clientY: 100 })

    fireEvent.click(canvas)
    const [, view] = onCanvasClick.mock.calls.at(-1)

    // Default view is xMin/xMax = -8/8 (range 16), width 400.
    // Total dx after 3 moves = (130-100)/400 * 16 = 1.2
    expect(view.xMin).toBeCloseTo(-9.2)
    expect(view.xMax).toBeCloseTo(6.8)
  })
})
