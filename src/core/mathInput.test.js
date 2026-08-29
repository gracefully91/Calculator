import { describe, expect, it } from 'vitest'
import { latexToExpression } from './mathInput'

describe('latexToExpression', () => {
  it('keeps named functions callable for the existing evaluator', () => {
    expect(latexToExpression('\\sqrt{x}+\\sin\\left(x\\right)')).toBe('sqrt(x)+sin(x)')
  })

  it('restores multiplication for parameter-parenthesis notation', () => {
    expect(latexToExpression('a\\left(x-2\\right)\\left(x-b\\right)+9')).toBe('a*(x-2)*(x-b)+9')
  })
})
