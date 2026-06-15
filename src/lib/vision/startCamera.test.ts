import { describe, expect, it } from 'vitest'
import { describeCameraError } from './startCamera'

describe('describeCameraError', () => {
  it('maps a permission denial to a friendly reason', () => {
    expect(describeCameraError(new DOMException('x', 'NotAllowedError'))).toMatch(/denied/i)
    expect(describeCameraError(new DOMException('x', 'SecurityError'))).toMatch(/denied/i)
  })

  it('maps a missing / unusable device', () => {
    expect(describeCameraError(new DOMException('x', 'NotFoundError'))).toMatch(/no camera/i)
    expect(describeCameraError(new DOMException('x', 'OverconstrainedError'))).toMatch(/no camera/i)
  })

  it('maps a device already in use', () => {
    expect(describeCameraError(new DOMException('x', 'NotReadableError'))).toMatch(/in use/i)
  })

  it('falls back to the error message for unrecognised errors', () => {
    expect(describeCameraError(new Error('boom'))).toBe('boom')
  })

  it('stringifies non-Error values', () => {
    expect(describeCameraError('nope')).toBe('nope')
  })
})
