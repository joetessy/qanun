import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StageCover } from './StageCover'

describe('StageCover (start / permission flow)', () => {
  it('shows a start button when idle and calls onStart', async () => {
    const onStart = vi.fn()
    render(<StageCover status="idle" errorMsg={null} onStart={onStart} />)
    const btn = screen.getByRole('button', { name: /play/i })
    btn.click()
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('renders nothing while running', () => {
    const { container } = render(<StageCover status="running" errorMsg={null} onStart={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('lifts (renders nothing) in no-camera so mouse/keyboard play is reachable', () => {
    const { container } = render(
      <StageCover status="no-camera" errorMsg="Camera permission denied" onStart={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows the error message and a retry button on error', () => {
    render(<StageCover status="error" errorMsg="camera blocked" onStart={() => {}} />)
    expect(screen.getByText(/camera blocked/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /play/i })).toBeTruthy()
  })
})
