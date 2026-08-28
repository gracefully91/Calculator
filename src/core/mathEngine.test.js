import { describe, it, expect } from 'vitest'
import { tryCompileExpression } from './mathEngine'

describe('tryCompileExpression', () => {
  it('compiles and evaluates a polynomial', () => {
    const result = tryCompileExpression('2*x^3 - 6*x + 1')
    expect(result.ok).toBe(true)
    expect(result.compiled.evaluate({ x: 1 })).toBeCloseTo(-3)
  })

  it('supports abs/min/max out of the box', () => {
    expect(tryCompileExpression('abs(x)').compiled.evaluate({ x: -4 })).toBe(4)
    expect(tryCompileExpression('min(x, 2)').compiled.evaluate({ x: 5 })).toBe(2)
  })

  it('supports extra scope variables (parameters)', () => {
    const result = tryCompileExpression('a*(x-2)*(x-b)+9')
    expect(result.compiled.evaluate({ x: 4, a: 3, b: 6 })).toBeCloseTo(-3)
  })

  it('returns ok:false with a message on invalid syntax', () => {
    const result = tryCompileExpression('2*x +* 3')
    expect(result.ok).toBe(false)
    expect(typeof result.error).toBe('string')
  })
})
