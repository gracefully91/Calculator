import { describe, expect, it } from 'vitest'
import { parseProblemAnalysis } from './problemAnalysisImport'

describe('problem analysis import', () => {
  it('parses a browser LLM response into linked-graph state', () => {
    const result = parseProblemAnalysis('{"left":{"pieces":[{"expr":"a*x^2","domain":[-2,2],"closedAt":{}}]},"right":{"mode":"custom","expression":"x^3"},"parameters":{"a":3},"t":-1,"explanation":"example"}')
    expect(result).toEqual({
      ok: true,
      analysis: {
        pieces: [{ expr: 'a*x^2', domain: [-2, 2], independent: false, closedAt: { left: null, right: null } }],
        rightMode: 'custom', rightExpression: 'x^3', params: { a: 3 }, t: -1, explanation: 'example',
      },
    })
  })

  it('rejects a malformed graph before it can be applied', () => {
    expect(parseProblemAnalysis('{"left":{"pieces":[{"expr":"x +* 2"}]}}').ok).toBe(false)
  })
})
