import type { ChangeEvent } from 'react'

interface TypedSelectOption<T extends string> {
  value: T
  label: string
}

interface TypedSelectProps<T extends string> {
  value: T
  options: ReadonlyArray<TypedSelectOption<T>>
  onChange: (value: T) => void
  disabled?: boolean
}

// Type-safe <select>: looks the new value up in the provided options array,
// so we never cast a raw event value into a literal union.
export const TypedSelect = <T extends string>({
  value,
  options,
  onChange,
  disabled = false
}: TypedSelectProps<T>) => {
  const handleChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    const next = options.find((o) => o.value === e.target.value)
    if (next) onChange(next.value)
  }
  return (
    <select value={value} onChange={handleChange} disabled={disabled}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
