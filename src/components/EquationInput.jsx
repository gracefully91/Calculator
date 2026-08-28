import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { autocompletion } from '@codemirror/autocomplete'
import { EditorView } from '@codemirror/view'

const FUNCTION_NAMES = ['abs', 'min', 'max', 'sqrt']

function completions(context) {
  const word = context.matchBefore(/\w*/)
  if (!word || (word.from === word.to && !context.explicit)) return null
  return {
    from: word.from,
    options: FUNCTION_NAMES.map((name) => ({ label: name, type: 'function' })),
  }
}

// Hoisted to module scope so these keep a stable identity across renders.
// CodeMirror's useCodeMirror hook (inside @uiw/react-codemirror) dispatches a
// full `reconfigure` effect whenever `extensions`/`basicSetup` change
// identity. A controlled input like this one re-renders on every keystroke
// (value prop changes via onChange -> parent setState -> re-render), so
// inline literals here would trigger a reconfigure per character typed.
// These are stateless config — CodeMirror's per-editor state lives in
// EditorView/EditorState, not in these objects — so one shared reference
// across every mounted EquationInput instance is safe.
const editorExtensions = [javascript(), autocompletion({ override: [completions] })]
const basicSetupOptions = { lineNumbers: false, foldGutter: false }

export function EquationInput({ value, onChange, error, label }) {
  // Panel (Task 11) renders one EquationInput per piece and needs
  // getByLabelText to tell them apart, but CodeMirror's contentEditable
  // div has no prop for aria-label. EditorView.contentAttributes lets us
  // set the attribute directly on that div (which already carries
  // role="textbox" from CodeMirror's own a11y setup). Only append this
  // extra facet when a label is given, and memoize on `label` alone so a
  // per-keystroke re-render (value changes, label doesn't) reuses the same
  // extensions array identity -- same reasoning as the module-scope hoist
  // below, just scoped to the one field that legitimately varies per
  // instance.
  const extensions = useMemo(
    () => (label ? [...editorExtensions, EditorView.contentAttributes.of({ 'aria-label': label })] : editorExtensions),
    [label]
  )

  return (
    <div>
      <CodeMirror
        value={value}
        height="2.5em"
        basicSetup={basicSetupOptions}
        extensions={extensions}
        onChange={onChange}
      />
      {error && <div style={{ color: '#dc2626', fontSize: '0.85em' }}>{error}</div>}
    </div>
  )
}
