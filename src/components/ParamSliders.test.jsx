import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ParamSliders } from './ParamSliders'

describe('ParamSliders', () => {
  it('renders one slider per name, defaulting the displayed/slider value to 1 when absent from values', () => {
    render(<ParamSliders names={['a', 'b']} values={{ a: 3 }} onChange={vi.fn()} />)
    expect(screen.getByLabelText('a slider')).toHaveValue('3')
    expect(screen.getByLabelText('b slider')).toHaveValue('1')
  })

  it('calls onChange with the name and the new numeric value when a slider moves', () => {
    const onChange = vi.fn()
    render(<ParamSliders names={['a']} values={{ a: 3 }} onChange={onChange} />)
    const slider = screen.getByLabelText('a slider')
    // userEvent doesn't drive range inputs realistically, so set the value
    // through the native (non-React-patched) setter -- like @testing-library
    // recommends -- then dispatch the change event React's listener expects.
    const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    nativeValueSetter.call(slider, '7')
    slider.dispatchEvent(new Event('change', { bubbles: true }))
    expect(onChange).toHaveBeenCalledWith('a', 7)
  })

  it('renders nothing when there are no names', () => {
    const { container } = render(<ParamSliders names={[]} values={{}} onChange={vi.fn()} />)
    expect(container.querySelectorAll('input')).toHaveLength(0)
  })
})
