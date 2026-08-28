import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { autocompletion } from '@codemirror/autocomplete'

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

export function EquationInput({ value, onChange, error }) {
  return (
    <div>
      <CodeMirror
        value={value}
        height="2.5em"
        basicSetup={basicSetupOptions}
        extensions={editorExtensions}
        onChange={onChange}
      />
      {error && <div style={{ color: '#dc2626', fontSize: '0.85em' }}>{error}</div>}
    </div>
  )
}
