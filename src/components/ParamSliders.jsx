// names: string[] — free variable names detected by detectFreeVariables (Task 13)
// values: Record<string, number> — current slider values, keyed by name (the
//   store's `params`); a name not yet present falls back to 1 for display,
//   matching the default Panel.jsx merges in for evaluation so the rendered
//   curve and the slider's shown value never disagree.
// onChange: (name, value) => void — called on drag, wired to the store's setParam.
export function ParamSliders({ names, values, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '1rem' }}>
      {names.map((name) => (
        <label key={name}>
          {name} = {values[name] ?? 1}
          <input
            type="range"
            aria-label={`${name} slider`}
            // Known Phase 1 limitation: fixed range/step, no way to type an
            // exact value or exceed [-20, 20] -- fine for the 52-problem
            // (a=3, b=6) but a later problem needing a larger magnitude
            // would need this made configurable.
            min={-20}
            max={20}
            step={0.5}
            value={values[name] ?? 1}
            onChange={(e) => onChange(name, Number(e.target.value))}
          />
        </label>
      ))}
    </div>
  )
}
