import { useMemo, useState } from 'react'
import { PROBLEM_ANALYSIS_PROMPT, parseProblemAnalysis } from '../core/problemAnalysisImport'

export function ProblemImportAssistant({ onApply }) {
  const [response, setResponse] = useState('')
  const [copyState, setCopyState] = useState('')
  const result = useMemo(() => (response.trim() ? parseProblemAnalysis(response) : null), [response])

  async function copyPrompt() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(PROBLEM_ANALYSIS_PROMPT)
      setCopyState('복사됨 — 문제 이미지와 함께 브라우저 LLM에 붙여넣으세요.')
    } catch {
      setCopyState('복사에 실패했습니다. 프롬프트를 직접 선택해 복사해 주세요.')
    }
  }

  return (
    <details className="problem-import">
      <summary>LLM 문제 분석 가져오기 <span>문제 이미지 → JSON → 그래프</span></summary>
      <div className="problem-import__body">
        <p>문제 이미지와 분석 프롬프트를 브라우저 LLM에 넣은 뒤, JSON 응답만 아래에 붙여넣으세요.</p>
        <button type="button" onClick={copyPrompt}>문제 분석 프롬프트 복사</button>
        {copyState && <p className="problem-import__status">{copyState}</p>}
        <label>LLM 문제 분석 JSON<textarea aria-label="LLM problem analysis response" value={response} onChange={(event) => setResponse(event.target.value)} /></label>
        {result?.ok && <div className="problem-import__preview">
          <span>적용 예정</span><code>{result.analysis.pieces.map((piece) => piece.expr).join(', ')}</code>
          <span>오른쪽: {result.analysis.rightMode}</span>
          <button type="button" onClick={() => { onApply(result.analysis); setResponse('') }}>그래프에 적용</button>
        </div>}
        {result && !result.ok && <p className="expression-error">{result.error}</p>}
      </div>
    </details>
  )
}
