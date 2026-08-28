import { useMemo } from 'react'
import { GraphCanvas } from './GraphCanvas'
import { EquationInput } from './EquationInput'
import { validatePiecewise } from '../core/functionSchema'
import { buildPiecewiseFunction } from '../core/piecewiseFunction'

// A brand-new piece starts fully unbounded (domain: [null, null]) -- there is
// no boundary point yet for "open" vs "closed" to describe, so closedAt is
// left at { left: null, right: null } rather than { left: true, right: true }.
// functionSchema.js/piecewiseFunction.js treat null and true identically at
// evaluation time (a boundary is only excluded when its side is explicitly
// `false`), so this doesn't change behavior once the user gives the piece a
// finite bound -- it just avoids showing "closed" checkboxes pre-checked for
// a boundary that doesn't exist yet. Matches store.js's DEFAULT_LEFT_PIECES.
const EMPTY_PIECE = { expr: 'x', domain: [null, null], closedAt: { left: null, right: null } }

// GraphCanvas's default viewport (see DEFAULT_VIEW in GraphCanvas.jsx) so an
// unbounded piece's curve still draws across the initial visible window.
const FALLBACK_MIN = -8
const FALLBACK_MAX = 8

export function Panel({ pieces, onPiecesChange, params }) {
  const parsed = useMemo(() => {
    const validation = validatePiecewise({ type: 'piecewise', pieces })
    return validation.ok ? { def: validation.normalized } : { error: validation.errors.join('; ') }
  }, [pieces])

  const fn = parsed.def ? buildPiecewiseFunction(parsed.def, params) : null

  // One curve per piece, each clipped to its own domain via `range` (so
  // GraphCanvas/drawCurve never samples a neighboring piece's x-range) and
  // via the `fn.contains` guard (so the exact sample landing on an *open*
  // boundary reports NaN instead of the piece's value, leaving that single
  // point undrawn -- the open/closed *marker* itself is Task 12's job).
  const curves = fn
    ? fn.pieces.map((p) => ({
        fn: (x) => (fn.contains(p, x) ? p.evaluate(x) : NaN),
        range: {
          xMin: p.domain[0] ?? FALLBACK_MIN,
          xMax: p.domain[1] ?? FALLBACK_MAX,
        },
      }))
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
    onPiecesChange([...pieces, { ...EMPTY_PIECE }])
  }

  function removePiece(index) {
    onPiecesChange(pieces.filter((_, i) => i !== index))
  }

  return (
    <div>
      <GraphCanvas curves={curves} points={[]} />
      <button type="button" aria-label="add piece" onClick={addPiece}>
        조각 추가
      </button>
      {pieces.map((piece, i) => {
        const [min, max] = piece.domain
        return (
          <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <EquationInput
              label={`piece expression ${i + 1}`}
              value={piece.expr}
              onChange={(expr) => updatePiece(i, { expr })}
              error={null}
            />
            <input
              type="number"
              aria-label={`domain min ${i + 1}`}
              value={min ?? ''}
              placeholder="-inf"
              onChange={(e) => updateDomain(i, 0, e.target.value)}
            />
            <label>
              <input
                type="checkbox"
                aria-label={`closed at min ${i + 1}`}
                disabled={min === null}
                checked={min !== null && piece.closedAt?.left !== false}
                onChange={(e) => updatePiece(i, { closedAt: { ...piece.closedAt, left: e.target.checked } })}
              />
              닫힘(≤)
            </label>
            <input
              type="number"
              aria-label={`domain max ${i + 1}`}
              value={max ?? ''}
              placeholder="+inf"
              onChange={(e) => updateDomain(i, 1, e.target.value)}
            />
            <label>
              <input
                type="checkbox"
                aria-label={`closed at max ${i + 1}`}
                disabled={max === null}
                checked={max !== null && piece.closedAt?.right !== false}
                onChange={(e) => updatePiece(i, { closedAt: { ...piece.closedAt, right: e.target.checked } })}
              />
              닫힘(≤)
            </label>
            {pieces.length > 1 && (
              <button type="button" onClick={() => removePiece(i)}>
                삭제
              </button>
            )}
          </div>
        )
      })}
      {parsed.error && <div style={{ color: '#dc2626' }}>{parsed.error}</div>}
    </div>
  )
}
