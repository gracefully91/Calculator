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

  it('tolerates an extra `id` field on pieces (Panel.jsx row-keying identity) without erroring or leaking it into normalized output', () => {
    // Panel.jsx (Task 11 code review) tags each piece with a stable `id` for
    // React row keys -- not part of this schema. Confirm that field passes
    // through harmlessly: normalizedPieces is built as a literal
    // { expr, domain, closedAt } object, so an unrecognized `id` on the input
    // is simply never read, not copied into the normalized piece, and
    // doesn't trip any validation check.
    const withIds = {
      type: 'piecewise',
      pieces: [
        { id: 7, expr: 'x', domain: [null, null], closedAt: {} },
      ],
    }
    const result = validatePiecewise(withIds)
    expect(result.ok).toBe(true)
    expect(result.normalized.pieces[0]).not.toHaveProperty('id')
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

  it('rejects a non-array domain instead of passing it through', () => {
    // Task 4's piecewiseFunction.js does `const [min, max] = piece.domain`, which
    // throws "5 is not iterable" on a non-array domain. Catch the shape mismatch here.
    const result = validatePiecewise({
      type: 'piecewise',
      pieces: [{ expr: 'x', domain: 5, closedAt: {} }],
    })
    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rejects a domain array with the wrong length or non-numeric bounds', () => {
    const wrongLength = validatePiecewise({
      type: 'piecewise',
      pieces: [{ expr: 'x', domain: [null, 1, 2], closedAt: {} }],
    })
    expect(wrongLength.ok).toBe(false)

    const nonNumeric = validatePiecewise({
      type: 'piecewise',
      pieces: [{ expr: 'x', domain: ['a', null], closedAt: {} }],
    })
    expect(nonNumeric.ok).toBe(false)
  })

  it('rejects an inverted domain (min > max)', () => {
    // Doesn't crash anything, but silently describes an empty/dead piece that never
    // applies — almost certainly a typo, so it should fail validation instead.
    const result = validatePiecewise({
      type: 'piecewise',
      pieces: [{ expr: 'x', domain: [5, 1], closedAt: {} }],
    })
    expect(result.ok).toBe(false)
  })

  it('rejects two pieces that are both closed at a shared boundary point', () => {
    // domain:[null,2] closed on the right AND domain:[2,null] closed on the left
    // both include x=2, which would give x=2 two different y-values.
    const bothClosed = {
      type: 'piecewise',
      pieces: [
        { expr: 'x', domain: [null, 2], closedAt: { left: null, right: true } },
        { expr: 'x+1', domain: [2, null], closedAt: { left: true, right: null } },
      ],
    }
    const result = validatePiecewise(bothClosed)
    expect(result.ok).toBe(false)
  })

  it('rejects two pieces both implicitly closed (closedAt omitted/null) at a shared boundary point', () => {
    // Same ill-defined-function scenario as the explicit-true test above, but via
    // the *default* closedAt (omitted, normalized to null) on both sides. Per the
    // established convention (Task 3's per-field defaulting, piecewiseFunction.js's
    // contains()), null means closed, same as explicit true -- so this must be
    // rejected too. Regression test for a gap where the overlap check used a
    // truthy check (`closedAt.right && closedAt.left`) instead of `!== false`,
    // silently letting this exact shape through as ok:true. A user who adds a
    // piece via Panel's "조각 추가" (whose new piece defaults to
    // closedAt: { left: null, right: null }) and only types matching domain
    // bounds -- never touching a boundary checkbox -- would hit this.
    const bothImplicitlyClosed = {
      type: 'piecewise',
      pieces: [
        { expr: 'x', domain: [null, 2], closedAt: {} },
        { expr: 'x+1', domain: [2, null], closedAt: {} },
      ],
    }
    const result = validatePiecewise(bothImplicitlyClosed)
    expect(result.ok).toBe(false)
  })

  it('still accepts a shared boundary when only one side is closed', () => {
    // Regression guard for the fix above: exactly one side closed at the touching
    // point is a valid partition of the domain and must keep passing.
    const oneClosedOneOpen = {
      type: 'piecewise',
      pieces: [
        { expr: 'x', domain: [null, 2], closedAt: { left: null, right: true } },
        { expr: 'x+1', domain: [2, null], closedAt: { left: false, right: null } },
      ],
    }
    const result = validatePiecewise(oneClosedOneOpen)
    expect(result.ok).toBe(true)
  })

  it('defaults closedAt per-field so a partial object does not leave undefined fields', () => {
    // Whole-object defaulting (piece.closedAt ?? {...}) leaves the *other* field as
    // undefined when only one field is provided, which breaks JSON.stringify
    // round-tripping (undefined properties are dropped, not serialized as null).
    const result = validatePiecewise({
      type: 'piecewise',
      pieces: [{ expr: 'x', domain: [null, null], closedAt: { right: true } }],
    })
    expect(result.ok).toBe(true)
    expect(result.normalized.pieces[0].closedAt).toEqual({ left: null, right: true })
    expect(JSON.parse(JSON.stringify(result.normalized.pieces[0].closedAt))).toEqual({
      left: null,
      right: true,
    })
  })
})
