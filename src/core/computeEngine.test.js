import { describe, expect, it } from 'vitest'
import { toMathJson } from './computeEngine'
import { tryCompileExpression } from './mathEngine'

describe('Compute Engine adapter', () => {
  it('turns the existing ASCII expression format into semantic MathJSON', () => {
    const result = toMathJson('a*(x-2)*(x-b)+9')
    expect(result).toMatchObject({ ok: true, latex: expect.any(String) })
    expect(result.mathJson).toEqual([
      'Add',
      ['Multiply', 'a', ['Add', 'x', -2], ['Add', ['Negate', 'b'], 'x']],
      9,
    ])
  })

  it('preserves function semantics by converting ASCII to LaTeX before parsing', () => {
    expect(toMathJson('abs(x)').mathJson).toEqual(['Abs', 'x'])
    expect(toMathJson('sqrt(x)').mathJson).toEqual(['Sqrt', 'x'])
  })

  it('attaches MathJSON without changing the current mathjs evaluator contract', () => {
    const result = tryCompileExpression('2*x^2-1')
    expect(result.ok).toBe(true)
    expect(result.compiled.evaluate({ x: 3 })).toBe(17)
    expect(result.mathJson).toEqual(['Add', ['Multiply', 2, ['Power', 'x', 2]], -1])
  })
})
