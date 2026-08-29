import 'mathlive'

export function MathKeyboardToggle() {
  function toggleKeyboard() {
    const keyboard = window.mathVirtualKeyboard
    if (!keyboard) return
    if (keyboard.visible) keyboard.hide({ animate: true })
    else keyboard.show({ animate: true })
  }

  return <button className="math-keyboard-toggle" type="button" aria-label="toggle math keyboard" onClick={toggleKeyboard}>⌨ 수식 키보드</button>
}
