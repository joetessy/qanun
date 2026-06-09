import { useEffect, useRef } from 'react'

interface CameraInsetProps {
  // The live camera MediaStream from the engine (null before start).
  stream: MediaStream | null
}

// Small picture-in-picture of the live webcam ("your hands"), mirrored like a
// selfie. Shares the same MediaStream the engine attached to the main stage,
// so the player can see their hands while playing.
export const CameraInset = ({ stream }: CameraInsetProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.srcObject = stream
    if (stream) void v.play().catch(() => {})
  }, [stream])

  if (!stream) return null
  return (
    <div className="camera-inset" aria-label="your hands">
      <video ref={videoRef} className="camera-inset-video" playsInline muted />
    </div>
  )
}
