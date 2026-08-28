import { describe, it, expect } from 'vitest'
import { buildPiecewiseFunction } from './piecewiseFunction'

const def = {
  type: 'piecewise',
  pieces: [
    { expr: '2*x^3-6*x+1', domain: [null, 2], closedAt: { left: null, right: true } },
    { expr: 'a*(x-2)*(x-b)+9', domain: [2, null], closedAt: { left: false, right: null } },
  ],
}

describe('buildPiecewiseFunction', () => {
  it('evaluates the correct piece depending on x', () => {
    const f = buildPiecewiseFunction(def, { a: 3, b: 6 })
    expect(f.evaluateAt(1)).toBeCloseTo(-3) // left piece
    expect(f.evaluateAt(4)).toBeCloseTo(-3) // right piece vertex
  })

  it('respects open/closed boundary at x=2', () => {
    const f = buildPiecewiseFunction(def, { a: 3, b: 6 })
    expect(f.evaluateAt(2)).toBeCloseTo(5) // closed on the left piece -> included
    expect(Number.isNaN(f.evaluateAt(2.0000001))).toBe(false) // right piece open but 2.0000001 > 2 so included
  })

  it('returns NaN outside every domain (should not normally happen with -Inf/+Inf pieces)', () => {
    const singlePiece = {
      type: 'piecewise',
      pieces: [{ expr: 'x', domain: [0, 1], closedAt: { left: true, right: true } }],
    }
    const f = buildPiecewiseFunction(singlePiece, {})
    expect(Number.isNaN(f.evaluateAt(5))).toBe(true)
  })

  it('throws a clear error at build time when a piece expression fails to compile', () => {
    // buildPiecewiseFunction is called directly by some callers (e.g. LinkedFunctionPanel)
    // without an intervening validatePiecewise() call, so it should not silently assume
    // every expr compiles -- it should fail loudly and early rather than crash later
    // inside evaluateAt() with a confusing "cannot read properties of undefined" error.
    const badDef = {
      type: 'piecewise',
      pieces: [{ expr: '2*x +* 3', domain: [null, null], closedAt: { left: null, right: null } }],
    }
    expect(() => buildPiecewiseFunction(badDef, {})).toThrow(/piece 0/)
  })
})
