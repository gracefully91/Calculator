import { describe, expect, it } from 'vitest'
import { fitSketchStrokes } from './sketchFitter'

describe('fitSketchStrokes', () => {
  it('chooses a quadratic candidate for a hand-drawn parabola and preserves its domain', () => {
    const result = fitSketchStrokes([{ points: [{ x: -2, y: 4.04 }, { x: -1, y: 1.01 }, { x: 0, y: -0.02 }, { x: 1, y: 0.98 }, { x: 2, y: 4.03 }] }])
    expect(result.candidates[0].degree).toBe(2)
    expect(result.pieces[0]).toMatchObject({ domain: [-2, 2], independent: false })
    expect(result.pieces[0].expr).toContain('x^2')
    expect(result.candidates[0].rmse).toBeLessThan(0.05)
  })

  it('keeps multiple sketched curves independent', () => {
    const result = fitSketchStrokes([
      { points: [{ x: -1, y: -1 }, { x: 1, y: 1 }] },
      { points: [{ x: -1, y: 1 }, { x: 1, y: -1 }] },
    ])
    expect(result.pieces).toHaveLength(2)
    expect(result.pieces[0].independent).toBe(false)
    expect(result.pieces[1].independent).toBe(true)
  })
})
