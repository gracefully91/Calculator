// LinkBar shows the shared `t` value that drives both the left graph's
// draggable y=t line (GraphCanvas's horizontalLine prop) and the right
// panel's x=t line (LinkedFunctionPanel — Task 15). It's purely a display of
// the store's `t`, not a source of truth for it.
export function LinkBar({ t }) {
  return (
    <div style={{ textAlign: 'center', padding: '0.5rem', borderTop: '1px solid #ddd' }}>
      현재 t = {t.toFixed(2)} — 왼쪽 그래프의 <b>y=t</b>와 오른쪽 그래프의 <b>x=t</b>는 같은 값입니다.
    </div>
  )
}
