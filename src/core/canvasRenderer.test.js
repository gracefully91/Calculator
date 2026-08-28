import { describe, it, expect, vi } from 'vitest'
import { drawAxes, drawCurve, drawPointMarker } from './canvasRenderer'

function createMockCtx() {
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
  }
}

const view = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, width: 400, height: 400 }

describe('drawAxes', () => {
  it('draws x and y axis lines', () => {
    const ctx = createMockCtx()
    drawAxes(ctx, view)
    expect(ctx.moveTo).toHaveBeenCalled()
    expect(ctx.lineTo).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })
})

describe('drawCurve', () => {
  it('samples the function and strokes a path', () => {
    const ctx = createMockCtx()
    drawCurve(ctx, view, (x) => x * x, { xMin: -5, xMax: 5 }, 50)
    expect(ctx.moveTo).toHaveBeenCalledTimes(1)
    expect(ctx.lineTo.mock.calls.length).toBeGreaterThan(10)
    expect(ctx.stroke).toHaveBeenCalled()
  })

  it('skips NaN segments without throwing', () => {
    const ctx = createMockCtx()
    const f = (x) => (x > 0 ? x : NaN)
    expect(() => drawCurve(ctx, view, f, { xMin: -5, xMax: 5 }, 20)).not.toThrow()
  })

  it('skips segments where fn throws without throwing itself', () => {
    const ctx = createMockCtx()
    const f = (x) => {
      if (x < 0) throw new Error('Undefined symbol a')
      return x
    }
    expect(() => drawCurve(ctx, view, f, { xMin: -5, xMax: 5 }, 20)).not.toThrow()
    expect(ctx.moveTo).toHaveBeenCalled()
    expect(ctx.lineTo).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })

  it('does not throw when range is degenerate (xMax <= xMin)', () => {
    const ctx = createMockCtx()
    expect(() => drawCurve(ctx, view, (x) => x, { xMin: 5, xMax: 5 }, 20)).not.toThrow()
    expect(() => drawCurve(ctx, view, (x) => x, { xMin: 5, xMax: -5 }, 20)).not.toThrow()
  })

  it('does not throw when samples is 0 or negative', () => {
    const ctx = createMockCtx()
    expect(() => drawCurve(ctx, view, (x) => x, { xMin: -5, xMax: 5 }, 0)).not.toThrow()
    expect(() => drawCurve(ctx, view, (x) => x, { xMin: -5, xMax: 5 }, -3)).not.toThrow()
  })
})

describe('drawPointMarker', () => {
  it('draws a filled circle for a closed point', () => {
    const ctx = createMockCtx()
    drawPointMarker(ctx, view, 0, 0, { closed: true })
    expect(ctx.arc).toHaveBeenCalled()
    expect(ctx.fill).toHaveBeenCalled()
  })

  it('draws a stroked (open) circle for an open point', () => {
    const ctx = createMockCtx()
    drawPointMarker(ctx, view, 0, 0, { closed: false })
    expect(ctx.arc).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })
})
