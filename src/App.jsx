import { useAppStore } from './state/store'
import { Panel } from './components/Panel'

export default function App() {
  const leftFunctionSource = useAppStore((s) => s.leftFunctionSource)
  const setLeftFunctionSource = useAppStore((s) => s.setLeftFunctionSource)
  const params = useAppStore((s) => s.params)

  return (
    <div style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
      <Panel source={leftFunctionSource} onSourceChange={setLeftFunctionSource} params={params} />
    </div>
  )
}
