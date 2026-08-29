import './App.css'
import { useAppStore } from './state/store'
import { Panel } from './components/Panel'
import { LinkBar } from './components/LinkBar'
import { LinkedFunctionPanel } from './components/LinkedFunctionPanel'

// The right-hand panel (LinkedFunctionPanel, Task 15) reads the exact same
// leftPieces/params as the left Panel -- it isn't a second, independently
// authored function. "Linked" means it's a live readout of how many times
// y=t intersects the SAME left-hand curve the user is editing/dragging, not
// a separate graph. Both panels are handed t/leftPieces/params straight from
// the store (App.jsx owns no local state of its own), matching Task 14's
// established prop-drilling pattern.
export default function App() {
  const t = useAppStore((s) => s.t)
  const setT = useAppStore((s) => s.setT)
  const leftPieces = useAppStore((s) => s.leftPieces)
  const setLeftPieces = useAppStore((s) => s.setLeftPieces)
  const params = useAppStore((s) => s.params)
  const setParam = useAppStore((s) => s.setParam)
  const traceOn = useAppStore((s) => s.traceOn)
  const toggleTrace = useAppStore((s) => s.toggleTrace)

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">INTERSECTION LAB</p>
          <h1>연동 그래프 계산기</h1>
        </div>
        <p className="app-header__note">왼쪽에서 함수를 만들고, <strong>y = t</strong> 선을 드래그해 보세요.</p>
      </header>
      <div className="main-row">
        <Panel
          pieces={leftPieces}
          onPiecesChange={setLeftPieces}
          params={params}
          onParamChange={setParam}
          horizontalLineT={t}
          onTChange={setT}
        />
        <section className="calculator-card calculator-card--linked" aria-labelledby="linked-graph-title">
          <header className="calculator-card__header">
            <div>
              <p className="calculator-card__eyebrow">연동 결과</p>
              <h2 id="linked-graph-title">h(t) 교점 개수</h2>
            </div>
            <label className="trace-toggle">
              <input type="checkbox" checked={traceOn} onChange={toggleTrace} />
              <span>Trace On</span>
            </label>
          </header>
          <LinkedFunctionPanel pieces={leftPieces} params={params} t={t} traceOn={traceOn} />
        </section>
      </div>
      <LinkBar t={t} />
    </main>
  )
}
