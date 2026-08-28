import { useMemo } from 'react'
import { GraphCanvas } from './GraphCanvas'
import { EquationInput } from './EquationInput'
import { validatePiecewise } from '../core/functionSchema'
import { buildPiecewiseFunction } from '../core/piecewiseFunction'
import { tryCompileExpression } from '../core/mathEngine'

// 단일 수식(비-piecewise) 입력을 임시로 지원: EquationInput에 'x^2' 같은 한 줄만 입력받아
// piecewise 스키마의 단일 조각으로 감싼다. (조각함수 UI는 Task 12에서 확장)
export function Panel({ source, onSourceChange, params }) {
  const parsed = useMemo(() => {
    const compileResult = tryCompileExpression(source || '0')
    if (!compileResult.ok) return { error: compileResult.error }

    const def = { type: 'piecewise', pieces: [{ expr: source || '0', domain: [null, null], closedAt: {} }] }
    const validation = validatePiecewise(def)
    if (!validation.ok) return { error: validation.errors.join('; ') }

    return { def: validation.normalized }
  }, [source])

  const fn = parsed.def ? buildPiecewiseFunction(parsed.def, params) : null

  const curves = fn ? [{ fn: fn.evaluateAt, range: { xMin: -8, xMax: 8 } }] : []

  return (
    <div>
      <GraphCanvas curves={curves} points={[]} />
      <EquationInput value={source} onChange={onSourceChange} error={parsed.error} />
    </div>
  )
}
