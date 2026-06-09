import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { hasOnboarded, setOnboarded } from './onboardingStorage'

const STORAGE_KEY = 'qanun.onboarded'

describe('onboardingStorage', () => {
  // Helpers to simulate localStorage availability states
  let storageMock: Record<string, string>

  beforeEach(() => {
    storageMock = {}
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k: string) => storageMock[k] ?? null,
        setItem: (k: string, v: string) => { storageMock[k] = v },
        removeItem: (k: string) => { delete storageMock[k] },
      },
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when nothing is stored', () => {
    expect(hasOnboarded()).toBe(false)
  })

  it('returns true after setOnboarded is called', () => {
    setOnboarded()
    expect(hasOnboarded()).toBe(true)
  })

  it('sets the key to "1"', () => {
    setOnboarded()
    expect(storageMock[STORAGE_KEY]).toBe('1')
  })

  it('returns false when the stored value is not "1" (malformed)', () => {
    storageMock[STORAGE_KEY] = 'yes'
    expect(hasOnboarded()).toBe(false)
  })

  it('returns false when localStorage.getItem throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => { throw new Error('SecurityError') },
        setItem: () => {},
        removeItem: () => {},
      },
      configurable: true,
      writable: true,
    })
    expect(hasOnboarded()).toBe(false)
  })

  it('does not throw when localStorage.setItem throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => null,
        setItem: () => { throw new Error('QuotaExceededError') },
        removeItem: () => {},
      },
      configurable: true,
      writable: true,
    })
    expect(() => setOnboarded()).not.toThrow()
  })
})
