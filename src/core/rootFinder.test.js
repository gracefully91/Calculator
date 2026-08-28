import { describe, it, expect } from 'vitest'
import { buildPiecewiseFunction } from './piecewiseFunction'
import { findRoots, solutionCount } from './rootFinder'

describe('findRoots / solutionCount — basic parabola', () => {
  const f = buildPiecewiseFunction(
    { type: 'piecewise', pieces: [{ expr: 'x^2', domain: [null, null], closedAt: {} }] },
    {}
  )

  it('finds two roots for x^2 = 4', () => {
    const roots = findRoots(f, 4, [-10, 10])
    expect(roots).toHaveLength(2)
    expect(roots[0]).toBeCloseTo(-2, 3)
    expect(roots[1]).toBeCloseTo(2, 3)
  })

  it('finds one (tangent) root for x^2 = 0', () => {
    expect(solutionCount(f, 0, [-10, 10])).toBe(1)
  })

  it('finds zero roots for x^2 = -1', () => {
    expect(solutionCount(f, -1, [-10, 10])).toBe(0)
  })
})

describe('solutionCount — 52번 문제 회귀 테스트', () => {
  const def = {
    type: 'piecewise',
    pieces: [
      { expr: '2*x^3-6*x+1', domain: [null, 2], closedAt: { left: null, right: true } },
      { expr: '3*(x-2)*(x-6)+9', domain: [2, null], closedAt: { left: false, right: null } },
    ],
  }
  const f = buildPiecewiseFunction(def, {})
  const range = [-10, 10]

  it('matches L(t) table for the left cubic piece alone', () => {
    const leftOnly = buildPiecewiseFunction(
      { type: 'piecewise', pieces: [def.pieces[0]] },
      {}
    )
    expect(solutionCount(leftOnly, -4, range)).toBe(1)
    expect(solutionCount(leftOnly, -3, range)).toBe(2)
    expect(solutionCount(leftOnly, 0, range)).toBe(3)
    expect(solutionCount(leftOnly, 5, range)).toBe(2)
    expect(solutionCount(leftOnly, 6, range)).toBe(0)
  })

  it('matches R(t) table for the right parabola piece alone (a=3,b=6, m=-3)', () => {
    const rightOnly = buildPiecewiseFunction(
      { type: 'piecewise', pieces: [def.pieces[1]] },
      {}
    )
    expect(solutionCount(rightOnly, -4, range)).toBe(0)
    expect(solutionCount(rightOnly, -3, range)).toBe(1)
    expect(solutionCount(rightOnly, 0, range)).toBe(2)
    expect(solutionCount(rightOnly, 9, range)).toBe(1)
  })

  it('combined g(t)=L(t)+R(t) has the g(k-)+g(k)+g(k+)=9 signal only at k=-3', () => {
    const below = solutionCount(f, -3 - 1e-3, range)
    const at = solutionCount(f, -3, range)
    const above = solutionCount(f, -3 + 1e-3, range)
    expect(below).toBe(1)
    expect(at).toBe(3)
    expect(above).toBe(5)
    expect(below + at + above).toBe(9)
  })
})

describe('findRoots / solutionCount — degenerate pieces', () => {
  it('collapses a constant piece exactly equal to t to a bounded representative instead of one phantom root per sample', () => {
    const f = buildPiecewiseFunction(
      { type: 'piecewise', pieces: [{ expr: '3', domain: [-10, 10], closedAt: { left: true, right: true } }] },
      {}
    )
    const roots = findRoots(f, 3, [-10, 10])
    // Mathematically there are infinitely many solutions (the whole
    // interval); rootFinder collapses this documented degenerate case to
    // the interval's two endpoints rather than ~1000 near-duplicate
    // sample-spaced "roots".
    expect(roots).toEqual([-10, 10])
    expect(solutionCount(f, 3, [-10, 10])).toBe(2)
  })

  it('does not report roots for a constant piece that does not equal t', () => {
    const f = buildPiecewiseFunction(
      { type: 'piecewise', pieces: [{ expr: '3', domain: [-10, 10], closedAt: { left: true, right: true } }] },
      {}
    )
    expect(solutionCount(f, 5, [-10, 10])).toBe(0)
  })

  it('does not report a phantom root at a pole/singularity inside the domain', () => {
    const f = buildPiecewiseFunction(
      { type: 'piecewise', pieces: [{ expr: '1/(x-1)', domain: [-5, 5], closedAt: { left: true, right: true } }] },
      {}
    )
    // 1/(x-1) = 0 has no real solution; the sign flip from +Infinity to
    // -Infinity across the asymptote at x=1 must not be mistaken for a
    // genuine root.
    expect(findRoots(f, 0, [-5, 5])).toEqual([])
    expect(solutionCount(f, 0, [-5, 5])).toBe(0)
  })

  it('still finds genuine roots on either side of a pole', () => {
    // 1/(x-1) = 1  =>  x = 2 ;  1/(x-1) = -1  =>  x = 0
    const f = buildPiecewiseFunction(
      { type: 'piecewise', pieces: [{ expr: '1/(x-1)', domain: [-5, 5], closedAt: { left: true, right: true } }] },
      {}
    )
    const rootsPos = findRoots(f, 1, [-5, 5])
    expect(rootsPos).toHaveLength(1)
    expect(rootsPos[0]).toBeCloseTo(2, 3)

    const rootsNeg = findRoots(f, -1, [-5, 5])
    expect(rootsNeg).toHaveLength(1)
    expect(rootsNeg[0]).toBeCloseTo(0, 3)
  })
})
