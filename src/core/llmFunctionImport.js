import { validatePiecewise } from './functionSchema'

function round(value) {
  return Math.round(value * 1000) / 1000
}

function sampleStroke(points, maxPoints = 36) {
  if (!Array.isArray(points) || points.length === 0) return []
  if (points.length <= maxPoints) return points.map(({ x, y }) => [round(x), round(y)])
  return Array.from({ length: maxPoints }, (_, index) => {
    const point = points[Math.round((index * (points.length - 1)) / (maxPoints - 1))]
    return [round(point.x), round(point.y)]
  })
}

export function buildSketchPrompt(strokes) {
  const samples = (strokes ?? [])
    .map((stroke) => sampleStroke(stroke.points))
    .filter((points) => points.length >= 2)

  return `당신은 그래프 스케치를 mathjs 수식으로 근사하는 도우미입니다.
아래 좌표는 같은 x-y 평면에서 사용자가 그린 곡선의 점들입니다. 각 배열은 하나의 선입니다.

규칙:
- x를 독립변수로 하는 실수 함수만 제안하세요.
- 직선, 이차/삼차식, abs(), sqrt(), sin() 등 가능한 간단한 mathjs ASCII 식을 우선하세요.
- 점을 정확히 보간하려 하지 말고 전체 개형을 가장 단순하게 근사하세요.
- 여러 선이 있으면 각각 independent:true로 두세요.
- 구간이 명확하면 domain에 [최소x, 최대x]를 넣고, 아니면 [null, null]을 쓰세요.
- 설명이나 Markdown 없이 아래 JSON만 반환하세요.

{"pieces":[{"expr":"x^2","domain":[-3,3],"closedAt":{"left":null,"right":null},"independent":false}]}

스케치 좌표:
${JSON.stringify(samples)}`
}

function jsonFromResponse(text) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced) return fenced[1]
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  return first >= 0 && last > first ? trimmed.slice(first, last + 1) : trimmed
}

export function parseLlmFunctionResponse(text) {
  let parsed
  try {
    parsed = JSON.parse(jsonFromResponse(text))
  } catch {
    return { ok: false, error: 'LLM 응답에서 JSON 객체를 읽지 못했습니다.' }
  }

  const validation = validatePiecewise(parsed)
  if (!validation.ok) return { ok: false, error: validation.errors.join(' · ') }

  return { ok: true, pieces: validation.normalized.pieces }
}
