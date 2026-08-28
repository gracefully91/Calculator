import { useAppStore } from './state/store'
import { Panel } from './components/Panel'
import { LinkBar } from './components/LinkBar'

// The design doc's Task 14 App.jsx reference also renders a right-hand
// LinkedFunctionPanel next to Panel, fed by the same t/pieces/params. That
// component is explicitly Task 15's deliverable and doesn't exist yet, so
// building even a stub of it here would be scope creep into the next task.
// This task's actual deliverable -- the draggable y=t line on GraphCanvas
// and the LinkBar readout -- is fully exercisable with just the left Panel:
// wire horizontalLineT/onTChange through to it so dragging the line updates
// the shared store `t`, and render LinkBar below to show that value updating
// live. Task 15 adds the right panel alongside this one; nothing here needs
// to change for that, it's an additive JSX change to the returned div.
export default function App() {
  const t = useAppStore((s) => s.t)
  const setT = useAppStore((s) => s.setT)
  const leftPieces = useAppStore((s) => s.leftPieces)
  const setLeftPieces = useAppStore((s) => s.setLeftPieces)
  const params = useAppStore((s) => s.params)
  const setParam = useAppStore((s) => s.setParam)

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
      </div>
      <LinkBar t={t} />
    </div>
  )
}
