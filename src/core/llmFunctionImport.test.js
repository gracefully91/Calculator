import { describe, expect, it } from 'vitest'
import { buildSketchPrompt, parseLlmFunctionResponse } from './llmFunctionImport'

describe('LLM function import', () => {
  it('builds a compact prompt from graph-coordinate sketch points', () => {
    const prompt = buildSketchPrompt([{ points: [{ x: -1.23456, y: 2 }, { x: 3.33339, y: 4 }] }])
    expect(prompt).toContain('[-1.235,2]')
    expect(prompt).toContain('[3.333,4]')
    expect(prompt).toContain('independent:true')
  })

  it('accepts a fenced JSON response and validates its function pieces', () => {
    const result = parseLlmFunctionResponse('```json\n{"pieces":[{"expr":"x^2","domain":[-2,2],"closedAt":{}}]}\n```')
    expect(result).toEqual({
      ok: true,
      pieces: [{ expr: 'x^2', domain: [-2, 2], independent: false, closedAt: { left: null, right: null } }],
    })
  })

  it('rejects non-JSON or invalid expressions before they can replace the graph', () => {
    expect(parseLlmFunctionResponse('대충 포물선입니다')).toEqual({ ok: false, error: 'LLM 응답에서 JSON 객체를 읽지 못했습니다.' })
    expect(parseLlmFunctionResponse('{"pieces":[{"expr":"x +* 2","domain":[null,null]}]}').ok).toBe(false)
  })
})
