import { validatePiecewise } from './functionSchema'
import { tryCompileExpression } from './mathEngine'
import { RIGHT_GRAPH_MODES } from './rightGraphPresets'

export const PROBLEM_ANALYSIS_PROMPT = `수학 문제 이미지를 분석해 그래프 계산기에 넣을 데이터를 만들어 주세요.

규칙:
- 식은 mathjs ASCII 표기만 사용하세요. 예: x^2, 2*x+1, sqrt(x), abs(x)
- 조각함수는 left.pieces 배열에 넣고 domain은 [최소값|null, 최대값|null]로 쓰세요.
- 서로 다른 독립 함수는 independent:true를 쓰세요.
- right.mode는 intersection-count, derivative, custom 중 하나입니다.
- custom이면 right.expression에 x에 대한 식을 넣으세요.
- 문제의 매개변수에 수치가 있으면 parameters에 넣고, y=t 유형의 초기 t가 있으면 t에 넣으세요.
- 설명·코드펜스 없이 아래 JSON 객체만 반환하세요.

{"left":{"pieces":[{"expr":"x^2","domain":[null,null],"closedAt":{"left":null,"right":null},"independent":false}]},"right":{"mode":"intersection-count","expression":"x"},"parameters":{},"t":0,"explanation":""}`

function extractJson(text) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced) return fenced[1]
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  return first >= 0 && last > first ? trimmed.slice(first, last + 1) : trimmed
}

export function parseProblemAnalysis(text) {
  let parsed
  try {
    parsed = JSON.parse(extractJson(text))
  } catch {
    return { ok: false, error: '문제 분석 JSON을 읽지 못했습니다.' }
  }
  const validation = validatePiecewise(parsed.left)
  if (!validation.ok) return { ok: false, error: validation.errors.join(' · ') }

  const rightMode = parsed.right?.mode ?? RIGHT_GRAPH_MODES.INTERSECTION_COUNT
  if (!Object.values(RIGHT_GRAPH_MODES).includes(rightMode)) return { ok: false, error: 'right.mode가 지원되지 않습니다.' }
  const rightExpression = parsed.right?.expression ?? 'x'
  if (rightMode === RIGHT_GRAPH_MODES.CUSTOM && !tryCompileExpression(rightExpression).ok) {
    return { ok: false, error: '오른쪽 사용자 수식이 올바르지 않습니다.' }
  }

  const params = Object.fromEntries(Object.entries(parsed.parameters ?? {}).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)))
  const t = typeof parsed.t === 'number' && Number.isFinite(parsed.t) ? parsed.t : 0
  return {
    ok: true,
    analysis: {
      pieces: validation.normalized.pieces,
      rightMode,
      rightExpression,
      params,
      t,
      explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
    },
  }
}
