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

export function EquationInput({ value, onChange, error }) {
  return (
    <div>
      <CodeMirror
        value={value}
        height="2.5em"
        basicSetup={{ lineNumbers: false, foldGutter: false }}
        extensions={[javascript(), autocompletion({ override: [completions] })]}
        onChange={onChange}
      />
      {error && <div style={{ color: '#dc2626', fontSize: '0.85em' }}>{error}</div>}
    </div>
  )
}
