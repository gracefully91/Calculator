// LinkBar shows the shared `t` value that drives both the left graph's
// draggable y=t line (GraphCanvas's horizontalLine prop) and the right
// panel's x=t line (LinkedFunctionPanel — Task 15). It's purely a display of
// the store's `t`, not a source of truth for it.
export function LinkBar({ t }) {
  return (
    <div className="link-bar">
      <span className="link-bar__pulse" aria-hidden="true" />
      <span>현재 t = {t.toFixed(2)}</span>
      <span className="link-bar__message">왼쪽 <b>y = t</b> → 오른쪽 <b>h(t)</b></span>
    </div>
  )
}
