import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CameraNotice } from './CameraNotice'

describe('CameraNotice', () => {
  it('shows the reason and tells the user they can still play', () => {
    render(<CameraNotice reason="Camera permission denied" onRetry={() => {}} onDismiss={() => {}} />)
    expect(screen.getByText(/camera permission denied/i)).toBeTruthy()
    expect(screen.getByText(/mouse or the keyboard/i)).toBeTruthy()
  })

  it('wires the retry button', () => {
    const onRetry = vi.fn()
    render(<CameraNotice reason={null} onRetry={onRetry} onDismiss={() => {}} />)
    screen.getByRole('button', { name: /retry camera/i }).click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('wires the dismiss button', () => {
    const onDismiss = vi.fn()
    render(<CameraNotice reason={null} onRetry={() => {}} onDismiss={onDismiss} />)
    screen.getByRole('button', { name: /dismiss/i }).click()
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
