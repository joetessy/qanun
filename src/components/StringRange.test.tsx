import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { StringRange } from './StringRange'

const renderRange = () => {
  const onEnd = vi.fn()
  const onReset = vi.fn()
  render(<StringRange range={{ low: -3, high: 15 }} lowLabel="G3" highLabel="D6" onEnd={onEnd} onReset={onReset} />)
  return { onEnd, onReset }
}

describe('StringRange', () => {
  it('shows both end notes and the string count', () => {
    renderRange()
    expect(screen.getByText('G3')).toBeInTheDocument()
    expect(screen.getByText('D6')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /19 strings/ })).toBeInTheDocument()
  })

  it('reports each thumb as a move of its own end', () => {
    const { onEnd } = renderRange()
    fireEvent.change(screen.getByRole('slider', { name: 'lowest string' }), { target: { value: '-1' } })
    fireEvent.change(screen.getByRole('slider', { name: 'highest string' }), { target: { value: '20' } })
    expect(onEnd).toHaveBeenNthCalledWith(1, { end: 'low', value: -1 })
    expect(onEnd).toHaveBeenNthCalledWith(2, { end: 'high', value: 20 })
  })

  it('names each end for screen readers and resets from the count', () => {
    const { onReset } = renderRange()
    expect(screen.getByRole('slider', { name: 'lowest string' })).toHaveAttribute('aria-valuetext', 'G3')
    fireEvent.click(screen.getByRole('button', { name: /19 strings/ }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})
