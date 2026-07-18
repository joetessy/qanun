import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { StageCover } from './StageCover'

describe('StageCover (start / permission flow)', () => {
  it('shows a start button when idle and calls onStart', async () => {
    const onStart = vi.fn()
    render(
      <StageCover status="idle" errorMsg={null} onStart={onStart} onStartWithoutCamera={() => {}} />
    )
    const btn = screen.getByRole('button', { name: /^play$/i })
    btn.click()
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('offers a camera-free start when idle and calls onStartWithoutCamera', () => {
    const onStartWithoutCamera = vi.fn()
    render(
      <StageCover
        status="idle"
        errorMsg={null}
        onStart={() => {}}
        onStartWithoutCamera={onStartWithoutCamera}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /without the camera/i }))
    expect(onStartWithoutCamera).toHaveBeenCalledTimes(1)
  })

  it('renders nothing while running', () => {
    const { container } = render(
      <StageCover status="running" errorMsg={null} onStart={() => {}} onStartWithoutCamera={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('hints that a camera permission prompt may be pending while loading', () => {
    render(
      <StageCover status="loading" errorMsg={null} onStart={() => {}} onStartWithoutCamera={() => {}} />
    )
    expect(screen.getByText(/allow camera access/i)).toBeTruthy()
  })

  it('renders nothing in no-camera when the player chose it (no error)', () => {
    const { container } = render(
      <StageCover status="no-camera" errorMsg={null} onStart={() => {}} onStartWithoutCamera={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('surfaces a non-blocking notice with a camera retry in no-camera with an error', () => {
    const onStart = vi.fn()
    render(
      <StageCover
        status="no-camera"
        errorMsg="Camera permission denied"
        onStart={onStart}
        onStartWithoutCamera={() => {}}
      />
    )
    expect(screen.getByText(/camera permission denied/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /retry camera/i }))
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('dismisses the no-camera notice on its × button', () => {
    const { container } = render(
      <StageCover
        status="no-camera"
        errorMsg="No camera found"
        onStart={() => {}}
        onStartWithoutCamera={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /dismiss camera notice/i }))
    expect(container.firstChild).toBeNull()
  })

  it('shows the error message and a retry button on error', () => {
    render(
      <StageCover
        status="error"
        errorMsg="camera blocked"
        onStart={() => {}}
        onStartWithoutCamera={() => {}}
      />
    )
    expect(screen.getByText(/camera blocked/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /^play$/i })).toBeTruthy()
  })
})
