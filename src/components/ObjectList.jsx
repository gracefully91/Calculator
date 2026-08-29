// src/components/ObjectList.jsx
//
// Algebra-view style list: one row per piece, showing a color swatch, a
// show/hide toggle, and the piece's raw expression text. Pure display --
// Panel.jsx owns the actual visibility state and hands down only what's
// needed to render.
//
// visibility/onToggle are keyed by piece **id**, not array index. The
// plan's own reference code used `visibility[i]` (an array indexed by
// position) -- that has the exact same stale-identity risk Task 11 already
// fixed for Panel.jsx's own piece rows: if piece A is deleted, every later
// piece's index shifts down by one, so `visibility[i]` would silently start
// describing a *different* piece than the one it used to (e.g. a piece the
// user explicitly hid could reappear as visible, or vice versa, purely
// because something earlier in the list was deleted). Taking `isVisible(id)`
// instead of a `visibility` array sidesteps that: there's nothing to
// re-index when the list shrinks or grows.
//
// The `<li>` itself is keyed on `piece.id` for the same reason Panel.jsx's
// piece rows are (see Task 11) -- though unlike EquationInput's CodeMirror
// instance, nothing here currently holds internal DOM state that
// index-based keying would corrupt, so this is a "stays correct if this
// grows state later" precaution more than a fix for a visible bug today.
//
// colors: a fixed palette, cycled via modulo (`colors[i % colors.length]`)
// so it never runs out regardless of how many pieces exist. There's no
// persisted "color assignment" to desync when pieces are added/removed --
// each row's color is recomputed from its *current* position on every
// render rather than stored anywhere.
export function ObjectList({ pieces, isVisible, onToggle, colors }) {
  return (
    <ul className="object-list">
      {pieces.map((piece, i) => {
        const visible = isVisible(piece.id)
        const color = colors[i % colors.length]
        return (
          <li key={piece.id ?? i}>
            <span
              aria-hidden="true"
              style={{ background: color }}
            />
            <button className="object-list__visibility" type="button" aria-label={`toggle visibility ${i + 1}`} onClick={() => onToggle(piece.id)}>
              {visible ? '👁️' : '👁️‍🗨️'}
            </button>
            <code>{piece.expr}</code>
          </li>
        )
      })}
    </ul>
  )
}
