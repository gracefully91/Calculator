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

  it('zooms in (narrower view, same center) on wheel with negative deltaY', () => {
    const onCanvasClick = vi.fn()
    const { container } = render(
      <GraphCanvas curves={[]} points={[]} onCanvasClick={onCanvasClick} />
    )
    const canvas = container.querySelector('canvas')

    fireEvent.wheel(canvas, { deltaY: -100 })
    fireEvent.click(canvas)
    const [, view] = onCanvasClick.mock.calls.at(-1)

    // Default view is -8..8 (range 16) on both axes. deltaY < 0 -> scale
    // 0.9, so halfW/halfH shrink from 8 to 7.2, centered on 0.
    expect(view.xMin).toBeCloseTo(-7.2)
    expect(view.xMax).toBeCloseTo(7.2)
    expect(view.yMin).toBeCloseTo(-7.2)
    expect(view.yMax).toBeCloseTo(7.2)
    expect(view.xMax - view.xMin).toBeLessThan(16)
    expect(view.yMax - view.yMin).toBeLessThan(16)
    expect((view.xMin + view.xMax) / 2).toBeCloseTo(0)
    expect((view.yMin + view.yMax) / 2).toBeCloseTo(0)
  })

  it('zooms out (wider view, same center) on wheel with positive deltaY', () => {
    const onCanvasClick = vi.fn()
    const { container } = render(
      <GraphCanvas curves={[]} points={[]} onCanvasClick={onCanvasClick} />
    )
    const canvas = container.querySelector('canvas')

    fireEvent.wheel(canvas, { deltaY: 100 })
    fireEvent.click(canvas)
    const [, view] = onCanvasClick.mock.calls.at(-1)

    // deltaY > 0 -> scale 1.1, so halfW/halfH grow from 8 to 8.8, centered on 0.
    expect(view.xMin).toBeCloseTo(-8.8)
    expect(view.xMax).toBeCloseTo(8.8)
    expect(view.yMin).toBeCloseTo(-8.8)
    expect(view.yMax).toBeCloseTo(8.8)
    expect(view.xMax - view.xMin).toBeGreaterThan(16)
    expect(view.yMax - view.yMin).toBeGreaterThan(16)
    expect((view.xMin + view.xMax) / 2).toBeCloseTo(0)
    expect((view.yMin + view.yMax) / 2).toBeCloseTo(0)
  })
})

describe('GraphCanvas — horizontalLine (draggable y=t)', () => {
  // Default view is xMin/xMax/yMin/yMax = -8/8, width/height = 400.
  // worldToScreen puts y=0 at screen y = 400 - ((0-(-8))/16)*400 = 200.
  const LINE_Y = 0
  const LINE_SCREEN_Y = 200

  it('dragging from on top of the line calls onDrag with the new world y, not a pan', () => {
    const onDrag = vi.fn()
    const onCanvasClick = vi.fn()
    const { container } = render(
      <GraphCanvas
        curves={[]}
        points={[]}
        onCanvasClick={onCanvasClick}
        horizontalLine={{ y: LINE_Y, onDrag }}
      />
    )
    const canvas = container.querySelector('canvas')

    // mousedown within the 8px hit threshold of the line's screen y.
    fireEvent.mouseDown(canvas, { clientX: 200, clientY: LINE_SCREEN_Y + 3 })
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 100 })
    fireEvent.mouseUp(canvas, { clientX: 200, clientY: 100 })

    expect(onDrag).toHaveBeenCalled()
    // screenToWorld(view, 0, 100) -> y = -8 + ((400-100)/400)*16 = 4
    expect(onDrag.mock.calls.at(-1)[0]).toBeCloseTo(4)

    // The drag must not have panned GraphCanvas's own worldView.
    fireEvent.click(canvas)
    const [, view] = onCanvasClick.mock.calls.at(-1)
    expect(view.xMin).toBeCloseTo(-8)
    expect(view.xMax).toBeCloseTo(8)
  })

  it('keeps line-drag mode for the whole gesture even once the cursor moves far from the line (mode decided once at mousedown)', () => {
    const onDrag = vi.fn()
    const onCanvasClick = vi.fn()
    const { container } = render(
      <GraphCanvas
        curves={[]}
        points={[]}
        onCanvasClick={onCanvasClick}
        horizontalLine={{ y: LINE_Y, onDrag }}
      />
    )
    const canvas = container.querySelector('canvas')

    fireEvent.mouseDown(canvas, { clientX: 200, clientY: LINE_SCREEN_Y })
    // Cursor moves far away from the line's original screen y (390, well
    // outside the 8px threshold) -- should still be treated as a line drag,
    // not flip to panning.
    fireEvent.mouseMove(canvas, { clientX: 350, clientY: 390 })
    fireEvent.mouseUp(canvas, { clientX: 350, clientY: 390 })

    expect(onDrag).toHaveBeenCalled()
    // screenToWorld(view, 0, 390) -> y = -8 + ((400-390)/400)*16 = -7.6
    expect(onDrag.mock.calls.at(-1)[0]).toBeCloseTo(-7.6)

    // Still no pan.
    fireEvent.click(canvas)
    const [, view] = onCanvasClick.mock.calls.at(-1)
    expect(view.xMin).toBeCloseTo(-8)
    expect(view.xMax).toBeCloseTo(8)
  })

  it('keeps pan mode for the whole gesture even once the cursor crosses the line mid-drag (mode decided once at mousedown)', () => {
    const onDrag = vi.fn()
    const onCanvasClick = vi.fn()
    const { container } = render(
      <GraphCanvas
        curves={[]}
        points={[]}
        onCanvasClick={onCanvasClick}
        horizontalLine={{ y: LINE_Y, onDrag }}
      />
    )
    const canvas = container.querySelector('canvas')

    // mousedown well away from the line's screen y (50 vs 200) -> pan mode.
    fireEvent.mouseDown(canvas, { clientX: 100, clientY: 50 })
    // Cursor crosses exactly over the line's screen y mid-gesture -- must
    // NOT flip into line-drag mode.
    fireEvent.mouseMove(canvas, { clientX: 130, clientY: LINE_SCREEN_Y })
    fireEvent.mouseUp(canvas, { clientX: 130, clientY: LINE_SCREEN_Y })

    expect(onDrag).not.toHaveBeenCalled()

    fireEvent.click(canvas)
    const [, view] = onCanvasClick.mock.calls.at(-1)
    // Pan did happen: dx = (130-100)/400 * 16 = 1.2
    expect(view.xMin).toBeCloseTo(-9.2)
    expect(view.xMax).toBeCloseTo(6.8)
  })

  it('treats a mousedown far from the line as a normal pan start (no onDrag call)', () => {
    const onDrag = vi.fn()
    const { container } = render(
      <GraphCanvas curves={[]} points={[]} horizontalLine={{ y: LINE_Y, onDrag }} />
    )
    const canvas = container.querySelector('canvas')

    fireEvent.mouseDown(canvas, { clientX: 100, clientY: 50 })
    fireEvent.mouseMove(canvas, { clientX: 110, clientY: 60 })
    fireEvent.mouseUp(canvas, { clientX: 110, clientY: 60 })

    expect(onDrag).not.toHaveBeenCalled()
  })

  it('draws nothing extra and behaves like before when horizontalLine is omitted', () => {
    const onCanvasClick = vi.fn()
    const { container } = render(
      <GraphCanvas curves={[]} points={[]} onCanvasClick={onCanvasClick} />
    )
    const canvas = container.querySelector('canvas')

    // mousedown at what would be the line's screen y if a line were present
    // -- with no horizontalLine prop, this must behave as an ordinary pan.
    fireEvent.mouseDown(canvas, { clientX: 100, clientY: LINE_SCREEN_Y })
    fireEvent.mouseMove(canvas, { clientX: 110, clientY: LINE_SCREEN_Y })
    fireEvent.mouseUp(canvas, { clientX: 110, clientY: LINE_SCREEN_Y })

    fireEvent.click(canvas)
    const [, view] = onCanvasClick.mock.calls.at(-1)
    // dx = (110-100)/400 * 16 = 0.4
    expect(view.xMin).toBeCloseTo(-8.4)
    expect(view.xMax).toBeCloseTo(7.6)
  })
})
