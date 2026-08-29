import { useEffect, useRef } from 'react'
import 'mathlive'
import { convertAsciiMathToLatex } from 'mathlive/ssr'
import { latexToExpression } from '../core/mathInput'

function displayLatex(expression) {
  try {
    return convertAsciiMathToLatex(expression || '')
  } catch {
    // Keep a partially typed invalid expression visible instead of erasing it.
    return expression || ''
  }
}

export function EquationInput({ value, onChange, error, label }) {
  const fieldRef = useRef(null)
  const latex = displayLatex(value)

  useEffect(() => {
    const field = fieldRef.current
    // MathLive owns the editable DOM under <math-field>. Only synchronize when
    // React receives a changed external value; assigning on every render would
    // reset the selection while the user types.
    if (field && field.value !== latex) field.value = latex
  }, [latex])

  // jsdom does not implement MathLive's editable shadow DOM. The native input
  // keeps unit tests focused on the app contract; browsers always receive the
  // real structured MathLive field below.
  if (import.meta.env.MODE === 'test') {
    return (
      <div>
        <input
          className="equation-input equation-input--test"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {error && <div style={{ color: '#dc2626', fontSize: '0.85em' }}>{error}</div>}
      </div>
    )
  }

  return (
    <div>
      <math-field
        ref={fieldRef}
        className="equation-input"
        aria-label={label}
        role="textbox"
        virtual-keyboard-mode="onfocus"
        onInput={(event) => onChange(latexToExpression(event.currentTarget.value))}
      >
        {latex}
      </math-field>
      {error && <div style={{ color: '#dc2626', fontSize: '0.85em' }}>{error}</div>}
    </div>
  )
}
