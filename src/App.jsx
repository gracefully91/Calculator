import './App.css'
import { useState } from 'react'
import { useAppStore } from './state/store'
import { Panel } from './components/Panel'
import { LinkBar } from './components/LinkBar'
import { LinkedFunctionPanel } from './components/LinkedFunctionPanel'
import { ProblemImportAssistant } from './components/ProblemImportAssistant'

// The right-hand panel (LinkedFunctionPanel, Task 15) reads the exact same
// leftPieces/params as the left Panel -- it isn't a second, independently
// authored function. "Linked" means it's a live readout of how many times
// y=t intersects the SAME left-hand curve the user is editing/dragging, not
// a separate graph. Both panels are handed t/leftPieces/params straight from
// the store (App.jsx owns no local state of its own), matching Task 14's
// established prop-drilling pattern.
export default function App() {
  const [rightResetViewToken, setRightResetViewToken] = useState(0)
  const t = useAppStore((s) => s.t)
  const setT = useAppStore((s) => s.setT)
  const leftPieces = useAppStore((s) => s.leftPieces)
  const setLeftPieces = useAppStore((s) => s.setLeftPieces)
  const params = useAppStore((s) => s.params)
  const setParam = useAppStore((s) => s.setParam)
  const setParams = useAppStore((s) => s.setParams)
  const traceOn = useAppStore((s) => s.traceOn)
  const toggleTrace = useAppStore((s) => s.toggleTrace)
  const leftInkStrokes = useAppStore((s) => s.leftInkStrokes)
  const setLeftInkStrokes = useAppStore((s) => s.setLeftInkStrokes)
  const rightInkStrokes = useAppStore((s) => s.rightInkStrokes)
  const setRightInkStrokes = useAppStore((s) => s.setRightInkStrokes)
  const rightGraphMode = useAppStore((s) => s.rightGraphMode)
  const setRightGraphMode = useAppStore((s) => s.setRightGraphMode)
  const rightGraphExpression = useAppStore((s) => s.rightGraphExpression)
  const setRightGraphExpression = useAppStore((s) => s.setRightGraphExpression)
  const rightGraphVisible = useAppStore((s) => s.rightGraphVisible)
  const toggleRightGraphVisible = useAppStore((s) => s.toggleRightGraphVisible)
  const rightGraphTitle = rightGraphMode === 'custom'
    ? 'g(x) 사용자 그래프'
    : rightGraphMode === 'derivative'
      ? 'f′(x) 도함수'
      : 'h(t) 교점 개수'

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">INTERSECTION LAB</p>
          <h1>연동 그래프 계산기</h1>
        </div>
        <p className="app-header__note">왼쪽에서 함수를 만들고, <strong>y = t</strong> 선을 드래그해 보세요.</p>
      </header>
      <ProblemImportAssistant onApply={(analysis) => {
        setLeftPieces(analysis.pieces.map((piece, index) => ({ ...piece, id: index + 1 })))
        setRightGraphMode(analysis.rightMode)
        setRightGraphExpression(analysis.rightExpression)
        setParams(analysis.params)
        setT(analysis.t)
      }} />
      <div className="main-row">
        <Panel
          pieces={leftPieces}
          onPiecesChange={setLeftPieces}
          params={params}
          onParamChange={setParam}
          horizontalLineT={t}
          onTChange={setT}
          inkStrokes={leftInkStrokes}
          onInkStrokesChange={setLeftInkStrokes}
        />
        <section className="calculator-card calculator-card--linked" aria-labelledby="linked-graph-title">
          <header className="calculator-card__header">
            <div>
              <p className="calculator-card__eyebrow">연동 결과</p>
          <h2 id="linked-graph-title">{rightGraphTitle}</h2>
        </div>
            <div className="calculator-card__actions">
              <button className="view-reset" type="button" aria-label="reset linked graph view" title="보기 초기화" onClick={() => setRightResetViewToken((token) => token + 1)}>↻</button>
              {rightGraphMode === 'intersection-count' && <label className="trace-toggle">
                <input type="checkbox" checked={traceOn} onChange={toggleTrace} />
                <span>Trace On</span>
              </label>}
            </div>
          </header>
          <LinkedFunctionPanel pieces={leftPieces} params={params} onParamChange={setParam} t={t} traceOn={traceOn} inkStrokes={rightInkStrokes} onInkStrokesChange={setRightInkStrokes} mode={rightGraphMode} onModeChange={setRightGraphMode} expression={rightGraphExpression} onExpressionChange={setRightGraphExpression} visible={rightGraphVisible} onToggleVisible={toggleRightGraphVisible} resetViewToken={rightResetViewToken} />
        </section>
      </div>
      <LinkBar t={t} />
    </main>
  )
}
