/** Accessible quantity stepper. Controlled: value + onChange(next). */
export default function QtyStepper({ value, onChange, min = 1, max = 99, idLabel = 'Quantity' }) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))

  return (
    <div className="qty" role="group" aria-label={idLabel}>
      <button
        type="button"
        className="qty__btn"
        onClick={dec}
        disabled={value <= min}
        aria-label="Decrease quantity"
      >
        –
      </button>
      <input
        className="qty__input"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        aria-label={idLabel}
        onChange={(e) => {
          const n = Math.floor(Number(e.target.value))
          if (Number.isNaN(n)) return
          onChange(Math.min(max, Math.max(min, n)))
        }}
      />
      <button
        type="button"
        className="qty__btn"
        onClick={inc}
        disabled={value >= max}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  )
}
