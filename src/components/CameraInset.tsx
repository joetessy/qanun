interface CameraInsetProps {
  enabled: boolean
}

// Small PIP so the player can see their hands. The actual <video>/<canvas>
// live in Stage; this is the framing chrome. frontend-design styles `.camera-inset`.
export const CameraInset = ({ enabled }: CameraInsetProps) =>
  enabled ? <div className="camera-inset" aria-label="your hands" /> : null
