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
    <div>
      <div style={{ display: 'flex', gap: '1rem', padding: '1rem', flexWrap: 'wrap' }}>
        <Panel
          pieces={leftPieces}
          onPiecesChange={setLeftPieces}
          params={params}
          onParamChange={setParam}
          horizontalLineT={t}
          onTChange={setT}
        />
        <div>
          <label>
            <input type="checkbox" checked={traceOn} onChange={toggleTrace} />
            Trace On
          </label>
          <LinkedFunctionPanel pieces={leftPieces} params={params} t={t} traceOn={traceOn} />
        </div>
      </div>
      <LinkBar t={t} />
    </div>
  )
}
