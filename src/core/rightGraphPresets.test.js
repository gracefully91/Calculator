import { describe, expect, it } from 'vitest'
import { buildPiecewiseFunction } from './piecewiseFunction'
import { numericalDerivative, RIGHT_GRAPH_MODE_LABELS, RIGHT_GRAPH_MODES } from './rightGraphPresets'

describe('right graph presets', () => {
  it('offers the derived presets plus an explicit custom-function mode', () => {
    expect(Object.keys(RIGHT_GRAPH_MODE_LABELS)).toEqual([
      RIGHT_GRAPH_MODES.INTERSECTION_COUNT,
      RIGHT_GRAPH_MODES.DERIVATIVE,
      RIGHT_GRAPH_MODES.CUSTOM,
    ])
  })

  it('computes the derivative preset numerically', () => {
    const fn = buildPiecewiseFunction({
      type: 'piecewise',
      pieces: [{ expr: 'x^2', domain: [null, null], closedAt: {} }],
    })
    expect(numericalDerivative(fn, 3)).toBeCloseTo(6, 3)
  })
})
