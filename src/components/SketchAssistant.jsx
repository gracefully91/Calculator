import { useMemo, useState } from 'react'
import { buildSketchPrompt, parseLlmFunctionResponse } from '../core/llmFunctionImport'
import { fitSketchStrokes } from '../core/sketchFitter'

export function SketchAssistant({ strokes, onClear, onApply }) {
  const [response, setResponse] = useState('')
  const [copyState, setCopyState] = useState('')
  const prompt = useMemo(() => buildSketchPrompt(strokes), [strokes])
  const localFit = useMemo(() => fitSketchStrokes(strokes), [strokes])
  const result = useMemo(() => (response.trim() ? parseLlmFunctionResponse(response) : null), [response])
  const pointCount = strokes.reduce((count, stroke) => count + (stroke.points?.length ?? 0), 0)

  async function copyPrompt() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(prompt)
      setCopyState('복사됨 — 선호하는 LLM에 붙여넣으세요.')
    } catch {
      setCopyState('복사에 실패했습니다. 아래 프롬프트를 직접 복사해 주세요.')
    }
  }

  return (
    <details className="sketch-assistant" open={strokes.length > 0}>
      <summary>손그림 → LLM 수식 제안 <span>{strokes.length ? `${strokes.length}개 선 · ${pointCount}개 점` : '스케치 대기'}</span></summary>
      <div className="sketch-assistant__body">
        {strokes.length === 0 ? <p>그래프 헤더의 <b>함수 스케치</b>를 누른 뒤, 주황색 선으로 함수 개형을 그려 주세요.</p> : <>
          <p>좌표 점과 JSON 형식을 복사해 LLM에 보내고, 받은 답을 아래에 붙여넣으세요.</p>
          {localFit.pieces.length > 0 && <div className="sketch-assistant__preview">
            <span>앱 자동 보정</span>
            <code>{localFit.candidates.map((candidate) => `${candidate.expr} (오차 ${candidate.rmse})`).join(', ')}</code>
            <button type="button" onClick={() => onApply(localFit.pieces)}>자동 보정 식 적용</button>
          </div>}
          <p className="sketch-assistant__secondary">더 복잡한 곡선·조각함수라면 아래 LLM 보조를 사용하세요.</p>
          <div className="sketch-assistant__actions">
            <button type="button" onClick={copyPrompt}>LLM 분석 프롬프트 복사</button>
            <button type="button" onClick={onClear}>스케치 지우기</button>
          </div>
          {copyState && <p className="sketch-assistant__status">{copyState}</p>}
          <label>
            LLM JSON 응답
            <textarea aria-label="LLM function response" value={response} onChange={(event) => setResponse(event.target.value)} placeholder={'{"pieces":[{"expr":"x^2","domain":[-3,3]}]}'} />
          </label>
          {result?.ok && <div className="sketch-assistant__preview">
            <span>미리보기</span>
            <code>{result.pieces.map((piece) => piece.expr).join(', ')}</code>
            <button type="button" onClick={() => { onApply(result.pieces); setResponse('') }}>이 식 적용</button>
          </div>}
          {result && !result.ok && <p className="expression-error">{result.error}</p>}
        </>}
      </div>
    </details>
  )
}
