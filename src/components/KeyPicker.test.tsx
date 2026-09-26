import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { KeyPicker } from './KeyPicker'

describe('KeyPicker', () => {
  it('offers the twelve keys C…B as buttons and reports the tonic MIDI note', () => {
    const onChange = vi.fn()
    render(<KeyPicker value={60} onChange={onChange} />)
    const keys = within(screen.getByRole('group', { name: 'Key' })).getAllByRole('button')
    expect(keys.map((k) => k.textContent)).toEqual(['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'])
    expect(keys[0]).toHaveAttribute('aria-pressed', 'true')
    expect(keys[1]).toHaveClass('is-accidental')
    fireEvent.click(keys[2])
    fireEvent.click(keys[9])
    expect(onChange).toHaveBeenNthCalledWith(1, 62) // D4
    expect(onChange).toHaveBeenNthCalledWith(2, 57) // A3 — the same register the old dropdown used
  })
})
