import { useEffect, useMemo, useState } from 'react'
import { GraphCanvas } from './GraphCanvas'
import { EquationInput } from './EquationInput'
import { ParamSliders } from './ParamSliders'
import { usePiecewiseFunction } from '../hooks/usePiecewiseFunction'
import { tryCompileExpression } from '../core/mathEngine'
import { detectFreeVariables } from '../core/freeVariables'
import { solutionCount } from '../core/rootFinder'
import {
  INTERSECTION_SEARCH_RANGE,
  numericalDerivative,
  RIGHT_GRAPH_MODE_LABELS,
  RIGHT_GRAPH_MODES,
} from '../core/rightGraphPresets'

export function LinkedFunctionPanel({
  pieces,
  params,
  onParamChange = () => {},
  t,
  traceOn = false,
  inkStrokes,
  onInkStrokesChange,
  mode = RIGHT_GRAPH_MODES.INTERSECTION_COUNT,
  onModeChange = () => {},
  expression = 'x',
  onExpressionChange = () => {},
  visible = true,
  onToggleVisible = () => {},
}) {
  const { fn, error: sourceError } = usePiecewiseFunction(pieces, params)
  const isIntersectionCount = mode === RIGHT_GRAPH_MODES.INTERSECTION_COUNT
  const isDerivative = mode === RIGHT_GRAPH_MODES.DERIVATIVE
  const isCustom = mode === RIGHT_GRAPH_MODES.CUSTOM
  const count = useMemo(
    () => (fn ? solutionCount(fn, t, INTERSECTION_SEARCH_RANGE) : null),
    [fn, t],
  )
  const customResult = useMemo(() => tryCompileExpression(expression), [expression])
  const customFreeVars = useMemo(() => detectFreeVariables([expression], ['x']).sort(), [expression])
  const [trace, setTrace] = useState([])

  useEffect(() => {
    if (!traceOn || !isIntersectionCount || count === null) return
    setTrace((previous) => [...previous, { x: t, y: count, closed: true }])
  }, [t, count, traceOn, isIntersectionCount])

  useEffect(() => {
    if (!traceOn || !isIntersectionCount) setTrace([])
  }, [traceOn, isIntersectionCount])

  const points = useMemo(() => {
    if (isIntersectionCount) {
      if (count === null) return traceOn ? trace : []
      const current = { x: t, y: count, closed: true }
      if (!traceOn) return [current]
      const last = trace[trace.length - 1]
      return last && last.x === t && last.y === count ? trace : [...trace, current]
    }
    if (isDerivative && fn) {
      const y = numericalDerivative(fn, t)
      return Number.isFinite(y) ? [{ x: t, y, closed: true }] : []
    }
    return []
  }, [isIntersectionCount, isDerivative, count, traceOn, trace, t, fn])

  const curves = useMemo(() => {
    if (isDerivative && fn) {
      return [{ fn: (x) => numericalDerivative(fn, x), range: { xMin: null, xMax: null } }]
    }
    if (isCustom && customResult.ok) {
      return [{
        fn: (x) => {
          try {
            const value = customResult.compiled.evaluate({ x, ...params })
            return Number.isFinite(value) ? value : NaN
          } catch {
            return NaN
          }
        },
        range: { xMin: null, xMax: null },
      }]
    }
    return []
  }, [isDerivative, isCustom, fn, customResult, params])

  const error = isCustom ? (customResult.ok ? null : customResult.error) : sourceError
  const hint = isIntersectionCount
    ? 'x축은 t, y축은 y=t와의 교점 개수입니다'
    : isDerivative
      ? '왼쪽 원함수의 수치 미분 그래프입니다'
      : 'g(x)를 직접 입력해 독립된 두 번째 그래프를 만드세요'

  return (
    <div className="linked-function-panel">
      <div className="graph-stage">
        <GraphCanvas curves={visible ? curves : []} points={visible ? points : []} inkStrokes={inkStrokes} onInkStrokesChange={onInkStrokesChange} inkLabel="linked graph" />
        <p className="graph-stage__hint">{hint}</p>
      </div>
      <div className="expression-sheet expression-sheet--linked">
        <div className="sheet-handle" aria-hidden="true" />
        <div className="right-object-row">
          <button className="piece-editor__visibility" type="button" aria-label="toggle right graph visibility" aria-pressed={visible} onClick={onToggleVisible} style={{ '--function-color': '#2563eb' }} />
          <span className="piece-editor__name">{isCustom ? 'g:' : isDerivative ? 'f′:' : 'h:'}</span>
          {isCustom
            ? <EquationInput label="right graph expression" value={expression} onChange={onExpressionChange} error={null} />
            : <span className="right-object-row__label">{RIGHT_GRAPH_MODE_LABELS[mode]}</span>}
          <select className="right-object-row__select" aria-label="right graph mode" value={mode} onChange={(event) => onModeChange(event.target.value)}>
            {Object.entries(RIGHT_GRAPH_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        {isCustom ? <>
          {customFreeVars.length > 0 && <ParamSliders names={customFreeVars} values={params} onChange={onParamChange} />}
          {error && <div className="expression-error">{error}</div>}
        </> : error ? <div className="expression-error">{error}</div> : <>
          {isIntersectionCount && <>
            <div className="linked-equation"><span className="linked-equation__dot" /> h(t) = 교점 개수</div>
            <div className="linked-reading"><span>현재 연결값</span><strong>h({t.toFixed(2)}) = {count}</strong></div>
          </>}
          {isDerivative && <>
            <div className="linked-equation"><span className="linked-equation__dot" /> f′(x) = 기울기</div>
            <div className="linked-reading"><span>현재 연결값</span><strong>f′({t.toFixed(2)}) = {numericalDerivative(fn, t).toFixed(2)}</strong></div>
          </>}
        </>}
        {!isCustom && <button className="piece-editor__add" type="button" onClick={() => onModeChange(RIGHT_GRAPH_MODES.CUSTOM)}>＋ 입력...</button>}
      </div>
    </div>
  )
}
