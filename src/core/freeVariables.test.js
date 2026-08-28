import { describe, it, expect } from 'vitest'
import { detectFreeVariables } from './freeVariables'

describe('detectFreeVariables', () => {
  it('finds parameters excluding x and known built-in function names', () => {
    const vars = detectFreeVariables(['a*(x-2)*(x-b)+9', '2*x^3-6*x+1'], ['x'])
    expect(vars.sort()).toEqual(['a', 'b'])
  })

  it('returns an empty array when there are no free variables', () => {
    expect(detectFreeVariables(['x^2 + abs(x)'], ['x'])).toEqual([])
  })

  it('does not treat a builtin function name used as a call (e.g. sqrt(x)) as a free variable', () => {
    expect(detectFreeVariables(['sqrt(x) + min(1, 2)'], ['x'])).toEqual([])
  })

  it('ignores expressions that fail to parse instead of throwing', () => {
    expect(() => detectFreeVariables(['a*(', '2*x'], ['x'])).not.toThrow()
    expect(detectFreeVariables(['a*(', '2*x'], ['x'])).toEqual([])
  })

  it('deduplicates a free variable shared across multiple expressions instead of listing it once per expression', () => {
    expect(detectFreeVariables(['a*x', 'a*x+1'], ['x'])).toEqual(['a'])
  })

  it('finds a free variable nested inside a function call argument, not just at the top level', () => {
    expect(detectFreeVariables(['sin(a*x)'], ['x'])).toEqual(['a'])
    // Also exercises a free variable passed as a plain argument (not part of
    // an operator expression) to a nested, undefined function call -- the
    // `parent.fn === n` structural check correctly excludes `f`/`g`
    // themselves (the names being called, at any nesting depth) while still
    // finding `a`, an ordinary argument.
    expect(detectFreeVariables(['f(g(x), a)'], ['x'])).toEqual(['a'])
  })
})
