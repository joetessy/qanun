// Decorative sound-hole rosette — a geometric Islamic-style star lattice, the
// kind inlaid on a real qanun soundboard. Purely ornamental (aria-hidden); the
// strings pass over it. Rendered as crisp SVG so it scales with the board.
interface RosetteProps {
  className?: string
}

export const Rosette = ({ className }: RosetteProps) => (
  <svg
    className={`rosette ${className ?? ''}`}
    viewBox="0 0 200 200"
    aria-hidden
    focusable="false"
  >
    <defs>
      <radialGradient id="rosette-fade" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="rgba(20, 12, 6, 0.85)" />
        <stop offset="62%" stopColor="rgba(26, 16, 8, 0.55)" />
        <stop offset="100%" stopColor="rgba(40, 26, 14, 0)" />
      </radialGradient>
    </defs>
    {/* Recessed dark well behind the lattice */}
    <circle cx="100" cy="100" r="92" fill="url(#rosette-fade)" />
    <g
      fill="none"
      stroke="rgba(196, 150, 86, 0.5)"
      strokeWidth="1.1"
      strokeLinejoin="round"
    >
      <circle cx="100" cy="100" r="86" />
      <circle cx="100" cy="100" r="64" />
      <circle cx="100" cy="100" r="34" />
      {/* Two offset 12-point stars forming the interlace */}
      <g transform="rotate(0 100 100)">
        <StarPoly />
      </g>
      <g transform="rotate(15 100 100)">
        <StarPoly />
      </g>
      <g transform="rotate(30 100 100)">
        <StarPoly />
      </g>
      {/* Radial spokes */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return (
          <line
            key={i}
            x1={100 + Math.cos(a) * 34}
            y1={100 + Math.sin(a) * 34}
            x2={100 + Math.cos(a) * 86}
            y2={100 + Math.sin(a) * 86}
          />
        )
      })}
    </g>
  </svg>
)

// One 12-pointed star drawn as a closed polygon (alternating long/short radii).
const StarPoly = () => {
  const pts: string[] = []
  const points = 12
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 82 : 50
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    pts.push(`${(100 + Math.cos(a) * r).toFixed(2)},${(100 + Math.sin(a) * r).toFixed(2)}`)
  }
  return <polygon points={pts.join(' ')} />
}
