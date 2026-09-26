import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { JinsPicker } from './JinsPicker'
import { upperOptions } from '../lib/music/sayr/upperJins'

// Lower Rast with upper Hijaz selected (Maqam Suznak).
const renderPicker = () => {
  const onLower = vi.fn()
  const onUpper = vi.fn()
  render(
    <JinsPicker
      lowerJins="rast"
      upperOptions={upperOptions({ lowerId: 'rast', currentUpperId: 'hijaz' })}
      ghammazNote="G"
      onLower={onLower}
      onUpper={onUpper}
    />
  )
  const upperGroup = screen.getByRole('group', { name: /upper jins/i })
  const upper = within(upperGroup).getAllByRole('button')
  const lower = within(screen.getByRole('group', { name: /lower jins/i })).getAllByRole('button')
  return { upperGroup, upper, lower, onLower, onUpper }
}

describe('JinsPicker (the maqam builder)', () => {
  it('stacks each family as an upper over the same family as a lower, key over key', () => {
    const { upper, lower } = renderPicker()
    expect(lower).toHaveLength(9)
    expect(upper).toHaveLength(8) // every family but Sikah
    upper.forEach((u, i) => {
      // "3 Hijaz" sits over "E Hijaz": same family, digit over letter.
      expect(u.textContent?.slice(1)).toBe(lower[i].textContent?.slice(1))
    })
    expect(upper[2].textContent).toBe('3 Hijaz')
    expect(lower[2].textContent).toBe('E Hijaz')
  })

  it('leaves the cell over Sikah empty — it only starts a maqam', () => {
    const { upperGroup, lower } = renderPicker()
    expect(lower[8].textContent).toBe('O Sikah')
    const cells = [...upperGroup.children].slice(1) // after the row label
    expect(cells).toHaveLength(9)                   // one per column, so the rows stay aligned
    expect(cells[8]).toHaveClass('jins-cell-empty')
    expect(cells[8]).toHaveAttribute('aria-hidden', 'true')
    expect(upperGroup.textContent).not.toContain('Sikah')
  })

  it('lights the selection and dots the pairings that spell a named maqam', () => {
    const { upper, lower } = renderPicker()
    expect(upper.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent)).toEqual(['3 Hijaz'])
    expect(lower[0]).toHaveAttribute('aria-pressed', 'true')
    expect(upper[2]).toHaveClass('is-named')               // Rast + Hijaz = Suznak
    expect(upper[2]).toHaveAttribute('title', 'Maqam Suznak (3)')
    expect(upper[4]).not.toHaveClass('is-named')           // Rast + Kurd: a free combination
    expect(upper[4]).toHaveAttribute('title', 'Rast ▸ Kurd (5)')
  })

  it('reports picks by family id', () => {
    const { upper, lower, onLower, onUpper } = renderPicker()
    fireEvent.click(upper[5])
    fireEvent.click(lower[8])
    expect(onUpper).toHaveBeenCalledWith('nikriz')
    expect(onLower).toHaveBeenCalledWith('sikah')
  })
})
