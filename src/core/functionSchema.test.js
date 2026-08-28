import { describe, it, expect } from 'vitest'
import { validatePiecewise } from './functionSchema'

const validDef = {
  type: 'piecewise',
  pieces: [
    { expr: '2*x^3-6*x+1', domain: [null, 2], closedAt: { left: null, right: true } },
    { expr: 'a*(x-2)*(x-b)+9', domain: [2, null], closedAt: { left: false, right: null } },
  ],
}

describe('validatePiecewise', () => {
  it('accepts a well-formed definition', () => {
    const result = validatePiecewise(validDef)
    expect(result.ok).toBe(true)
    expect(result.normalized.pieces).toHaveLength(2)
  })

  it('rejects a definition with no pieces', () => {
    const result = validatePiecewise({ type: 'piecewise', pieces: [] })
    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rejects a piece with an invalid expr', () => {
    const bad = { type: 'piecewise', pieces: [{ expr: '2*x +* 3', domain: [null, null], closedAt: {} }] }
    const result = validatePiecewise(bad)
    expect(result.ok).toBe(false)
  })

  it('rejects overlapping domains', () => {
    const overlapping = {
      type: 'piecewise',
      pieces: [
        { expr: 'x', domain: [null, 3], closedAt: { left: null, right: true } },
        { expr: 'x', domain: [1, null], closedAt: { left: true, right: null } },
      ],
    }
    const result = validatePiecewise(overlapping)
    expect(result.ok).toBe(false)
  })

  it('rejects a piece with a missing/empty expr instead of silently accepting it', () => {
    // tryCompileExpression('') returns ok:true (compiles to a no-op that evaluates to
    // undefined) — see mathEngine's known quirk. validatePiecewise must not let a
    // missing expr slip through as a "valid" piece.
    const missingExpr = {
      type: 'piecewise',
      pieces: [{ domain: [null, null], closedAt: {} }],
    }
    const result = validatePiecewise(missingExpr)
    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)

    const emptyExpr = {
      type: 'piecewise',
      pieces: [{ expr: '', domain: [null, null], closedAt: {} }],
    }
    const result2 = validatePiecewise(emptyExpr)
    expect(result2.ok).toBe(false)
  })
})
