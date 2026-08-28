import { useAppStore } from './state/store'
import { Panel } from './components/Panel'

export default function App() {
  const leftPieces = useAppStore((s) => s.leftPieces)
  const setLeftPieces = useAppStore((s) => s.setLeftPieces)
  const params = useAppStore((s) => s.params)

  return (
    <div style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
      <Panel pieces={leftPieces} onPiecesChange={setLeftPieces} params={params} />
    </div>
  )
}
