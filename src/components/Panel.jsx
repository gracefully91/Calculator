import { useState } from 'react'
import { GraphCanvas } from './GraphCanvas'
import { EquationInput } from './EquationInput'
import { MathKeyboardToggle } from './MathKeyboardToggle'
import { ParamSliders } from './ParamSliders'
import { SketchAssistant } from './SketchAssistant'
import { usePiecewiseFunction } from '../hooks/usePiecewiseFunction'

// A brand-new piece starts fully unbounded (domain: [null, null]) -- there is
// no boundary point yet for "open" vs "closed" to describe, so closedAt is
// left at { left: null, right: null } rather than { left: true, right: true }.
// functionSchema.js/piecewiseFunction.js treat null and true identically at
// evaluation time (a boundary is only excluded when its side is explicitly
// `false`), so this doesn't change behavior once the user gives the piece a
// finite bound -- it just avoids showing "closed" checkboxes pre-checked for
// a boundary that doesn't exist yet. Matches store.js's DEFAULT_LEFT_PIECES.
// `id` is assigned separately per call in addPiece() (derived from the
// current pieces, not baked into this shape), since every added piece needs
// a distinct one.
const EMPTY_PIECE_SHAPE = { expr: 'x', domain: [null, null], closedAt: { left: null, right: null } }

// GeoGebra-style object-row colors. The palette cycles by row index, so an
// arbitrary number of graphs is fine without a separate color-state model.
const OBJECT_LIST_COLORS = ['#0f8a7b', '#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea']
const FUNCTION_NAMES = ['f', 'g', 'h', 'p', 'q', 'r']

export function Panel({
  pieces,
  onPiecesChange,
  params,
  onParamChange = () => {},
  horizontalLineT,
  onTChange,
  inkStrokes,
  onInkStrokesChange,
}) {
  // Shared with LinkedFunctionPanel.jsx (see src/hooks/usePiecewiseFunction.js)
  // so both panels validate/build/default-param the identical way -- the
  // whole premise of "linked" is that they're reading the SAME function.
  // `effectiveParams` isn't caught by drawCurve's own try/catch around a
  // missing free-variable symbol (that's silently swallowed, so the curve
  // just never renders) but the boundary-marker `p.evaluate(lo/hi)` calls
  // further down are NOT similarly guarded and would throw straight out of
  // render without it -- the hook fills in the same default (1) the slider
  // itself displays, before the user ever drags anything.
  const { fn, error, freeVars } = usePiecewiseFunction(pieces, params)

  // Object-row visibility, keyed by piece **id** rather than array
  // index/position. A Set of *hidden* ids (not "shown" ids) so a freshly
  // added piece -- which has no entry in this set at all -- defaults to
  // visible without Panel having to seed an entry for it on every addPiece.
  //
  // Keying by id (not index) matters once pieces can be deleted: fn.pieces
  // (built below) is index-aligned 1:1 with the `pieces` prop -- validatePiecewise
  // and buildPiecewiseFunction both map def.pieces straight through in input
  // order, without reordering or dropping entries -- but that alignment shifts
  // on every delete. An index-keyed visibility store (`hidden[i]`) would then
  // silently start describing a *different* piece than the one the user
  // actually toggled. Local useState (not the Zustand store) per the task's
  // own note ("Panel에 visibility state를 추가") -- this is view-local display
  // state, not part of the piecewise function's data model.
  const [hiddenIds, setHiddenIds] = useState(() => new Set())
  const [resetViewToken, setResetViewToken] = useState(0)
  const [sketchActive, setSketchActive] = useState(false)
  const [sketchStrokes, setSketchStrokes] = useState([])
  const isVisible = (id) => !hiddenIds.has(id)
  function toggleVisibility(id) {
    setHiddenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // One curve per *visible* piece, each clipped to its own domain via
  // `range` (so GraphCanvas/drawCurve never samples a neighboring piece's
  // x-range) and via the `fn.contains` guard (so the exact sample landing on
  // an *open* boundary reports NaN instead of the piece's value, leaving
  // that single point undrawn -- the open/closed *marker* itself is drawn
  // separately, via `points` below). `fn.pieces[i]` corresponds to
  // `pieces[i]` (same order, same length -- see note above), so `pieces[i].id`
  // is what the color-circle toggle actually flips.
  const curves = fn
    ? fn.pieces.flatMap((p, i) => {
        if (!isVisible(pieces[i]?.id)) return []
        return [{
          fn: (x) => (fn.contains(p, x) ? p.evaluate(x) : NaN),
          color: OBJECT_LIST_COLORS[i % OBJECT_LIST_COLORS.length],
          range: {
            // null means an unbounded mathematical domain. GraphCanvas turns
            // that into the board's *current* visible x range, not the old
            // hard-coded -8..8 sample range that made curves look truncated.
            xMin: p.domain[0],
            xMax: p.domain[1],
          },
        }]
      })
    : []

  // One marker per finite domain boundary (both edges for a piece bounded on
  // both sides; skipped where the bound is null/undefined -- unbounded means
  // there's no boundary point to mark). Whether the resulting dot is drawn
  // filled (closed) or hollow (open) follows the same `!== false` convention
  // as piecewiseFunction.js's contains() and this file's own checkbox
  // `checked` computation below: an unset (null/undefined) closedAt side
  // means closed by default, matching EMPTY_PIECE_SHAPE's freshly-bounded
  // piece which hasn't had its checkbox touched yet. Gating marker presence
  // on closedAt (instead of on the domain bound) would silently drop the
  // marker for exactly that case, even though the checkbox already displays
  // it as checked.
  const points = fn
    ? fn.pieces.flatMap((p, i) => {
        if (!isVisible(pieces[i]?.id)) return []
        const marks = []
        const color = OBJECT_LIST_COLORS[i % OBJECT_LIST_COLORS.length]
        const [lo, hi] = p.domain
        if (lo !== null && lo !== undefined) {
          marks.push({ x: lo, y: p.evaluate(lo), closed: p.closedAt.left !== false, color })
        }
        if (hi !== null && hi !== undefined) {
          marks.push({ x: hi, y: p.evaluate(hi), closed: p.closedAt.right !== false, color })
        }
        return marks
      })
    : []

  function updatePiece(index, patch) {
    const next = pieces.map((p, i) => (i === index ? { ...p, ...patch } : p))
    onPiecesChange(next)
  }

  function updateDomain(index, boundIndex, rawValue) {
    // type="number" inputs report '' both for an explicitly cleared field and
    // for "not currently a valid number" (e.g. mid-typing "-"), so both mean
    // "unbounded" here. Anything else should be a finite number by the time
    // this fires; if it somehow isn't (NaN), leave the existing bound alone
    // rather than writing NaN into domain and tripping validatePiecewise's
    // "domain must be ... finite numbers" error for no visible reason.
    const piece = pieces[index]
    const domain = [...piece.domain]
    if (rawValue === '') {
      domain[boundIndex] = null
    } else {
      const n = Number(rawValue)
      if (Number.isNaN(n)) return
      domain[boundIndex] = n
    }
    updatePiece(index, { domain })
  }

  function addPiece() {
    // Derive the next id from what's already present rather than a module-level
    // counter, so it stays correct regardless of how many Panel instances have
    // mounted before this one, and regardless of what ids the incoming `pieces`
    // (e.g. loaded from the store, or from pieces created before ids existed)
    // already carry.
    const nextId = Math.max(0, ...pieces.map((p) => p.id ?? 0)) + 1
    onPiecesChange([...pieces, { id: nextId, independent: true, ...EMPTY_PIECE_SHAPE }])
  }

  function removePiece(index) {
    onPiecesChange(pieces.filter((_, i) => i !== index))
  }

  // Only offer a draggable y=t line when the caller actually wants to be
  // told about drags (App.jsx wires horizontalLineT/onTChange to the store's
  // t/setT; Panel.test.jsx and other bare callers omit both, which must keep
  // rendering GraphCanvas exactly as before -- no line, panning unaffected).
  const horizontalLine =
    typeof horizontalLineT === 'number' && onTChange ? { y: horizontalLineT, onDrag: onTChange } : undefined

  return (
    <section className="calculator-card calculator-card--source" aria-labelledby="source-graph-title">
      <div className="source-panel__graph">
        <header className="calculator-card__header">
          <div>
            <p className="calculator-card__eyebrow">원함수</p>
            <h2 id="source-graph-title">f(x) 그래프</h2>
          </div>
          <div className="calculator-card__actions">
            <button className="view-reset" type="button" aria-label="reset source graph view" title="보기 초기화" onClick={() => setResetViewToken((token) => token + 1)}>↻</button>
            <button className="sketch-toggle" type="button" aria-pressed={sketchActive} onClick={() => setSketchActive((active) => !active)}>{sketchActive ? '스케치 완료' : '함수 스케치'}</button>
            <span className="drag-pill">y = t 드래그</span>
          </div>
        </header>
        <div className="graph-stage">
          <GraphCanvas curves={curves} points={points} horizontalLine={horizontalLine} inkStrokes={inkStrokes} onInkStrokesChange={onInkStrokesChange} inkLabel="source graph" resetViewToken={resetViewToken} sketchActive={sketchActive} sketchStrokes={sketchStrokes} onSketchStrokesChange={setSketchStrokes} />
          <p className="graph-stage__hint">휠로 확대 · 드래그로 이동</p>
        </div>
      </div>
      <details className="source-panel__editor" open>
        <summary><span>함수 편집</span><span>{pieces.length}개</span></summary>
        <div className="expression-sheet">
        <div className="sheet-handle" aria-hidden="true" />
        <div className="expression-sheet__heading">
          <span>함수 목록</span>
          <MathKeyboardToggle />
        </div>
      <div className="piece-editors">
      {pieces.map((piece, i) => {
        const [min, max] = piece.domain
        const color = OBJECT_LIST_COLORS[i % OBJECT_LIST_COLORS.length]
        const name = piece.name ?? FUNCTION_NAMES[i] ?? `f${i + 1}`
        return (
          // Key on the piece's stable id, not its array index: deleting an
          // earlier piece shifts every later index down, and an index key
          // would make React reuse each shifted-into slot's EquationInput
          // instance -- carrying over CodeMirror-internal state (cursor,
          // selection, scroll, undo history) that lives outside the
          // controlled `value` prop. Fall back to index only for pieces
          // built before `id` existed (e.g. older test fixtures).
          <div key={piece.id ?? i} className="piece-editor">
            <button
              className="piece-editor__visibility"
              type="button"
              aria-label={`toggle visibility ${i + 1}`}
              aria-pressed={isVisible(piece.id)}
              onClick={() => toggleVisibility(piece.id)}
              style={{ '--function-color': color }}
            />
            <span className="piece-editor__name">{name}:</span>
            <div className="piece-editor__equation">
              <EquationInput
                label={`piece expression ${i + 1}`}
                value={piece.expr}
                onChange={(expr) => updatePiece(i, { expr })}
                error={null}
              />
            </div>
            <details className="piece-editor__menu">
              <summary aria-label={`function menu ${i + 1}`}>⋮</summary>
              <div className="domain-controls__fields">
                <label>
                  시작
                  <input type="number" aria-label={`domain min ${i + 1}`} value={min ?? ''} placeholder="−∞" onChange={(e) => updateDomain(i, 0, e.target.value)} />
                </label>
                <label className="domain-check">
                  <input type="checkbox" aria-label={`closed at min ${i + 1}`} disabled={min === null} checked={min !== null && piece.closedAt?.left !== false} onChange={(e) => updatePiece(i, { closedAt: { ...piece.closedAt, left: e.target.checked } })} />
                  포함
                </label>
                <label>
                  끝
                  <input type="number" aria-label={`domain max ${i + 1}`} value={max ?? ''} placeholder="+∞" onChange={(e) => updateDomain(i, 1, e.target.value)} />
                </label>
                <label className="domain-check">
                  <input type="checkbox" aria-label={`closed at max ${i + 1}`} disabled={max === null} checked={max !== null && piece.closedAt?.right !== false} onChange={(e) => updatePiece(i, { closedAt: { ...piece.closedAt, right: e.target.checked } })} />
                  포함
                </label>
              </div>
              {pieces.length > 1 && <button className="piece-editor__delete" type="button" onClick={() => removePiece(i)}>삭제</button>}
            </details>
          </div>
        )
      })}
      <button className="piece-editor__add" type="button" aria-label="add piece" onClick={addPiece}><span aria-hidden="true">＋</span> 입력...</button>
      </div>
      {freeVars.length > 0 && <ParamSliders names={freeVars} values={params} onChange={onParamChange} />}
      <SketchAssistant strokes={sketchStrokes} onClear={() => setSketchStrokes([])} onApply={(nextPieces) => { onPiecesChange(nextPieces.map((piece, index) => ({ ...piece, id: index + 1 }))); setSketchStrokes([]); setSketchActive(false) }} />
      {error && <div className="expression-error">{error}</div>}
        </div>
      </details>
    </section>
  )
}
