import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MandalRail } from './MandalRail'
import { NATURAL_STATE, setMandal } from '../lib/music/ajnas/MANDALS'
import type { MandalState } from '../lib/music/types'

const renderRail = (mandalState: MandalState) => {
  const onStep = vi.fn()
  render(
    <MandalRail
      mandalState={mandalState}
      tonicMidi={60}
      onSetMandal={() => {}}
      onStep={onStep}
      expanded={false}
      onToggleExpand={() => {}}
    />
  )
  return { onStep }
}

describe('MandalRail', () => {
  it('rests on the naturals, quietly, and lights a flipped lever', () => {
    renderRail(setMandal(NATURAL_STATE, 3, 3.5))
    const current = screen.getAllByTitle(/show all positions/)
    expect(current.map((b) => b.textContent)).toEqual(['C', 'D', 'E½♭', 'F', 'G', 'A', 'B'])
    expect(current[0]).toHaveClass('is-natural')
    expect(current[2]).not.toHaveClass('is-natural')
  })

  it('marks an end stop aria-disabled, keeping the keycap focusable', () => {
    const { onStep } = renderRail(setMandal(NATURAL_STATE, 1, 1)) // C♯: fully raised
    const raiseC = screen.getByRole('button', { name: 'Raise C' })
    expect(raiseC).toHaveAttribute('aria-disabled', 'true')
    expect(raiseC).not.toBeDisabled()
    raiseC.focus()
    expect(document.activeElement).toBe(raiseC)
    expect(screen.getByRole('button', { name: 'Lower C' })).toHaveAttribute('aria-disabled', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Lower C' }))
    expect(onStep).toHaveBeenCalledWith(1, -1)
  })
})
