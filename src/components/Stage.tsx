import { memo } from 'react'
import type { RefObject } from 'react'
import type { QanunStatus } from '../types'
import { VIDEO_HEIGHT, VIDEO_WIDTH } from '../lib/vision/constants'

interface StageProps {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  status: QanunStatus
}

// memo: refs are stable and status changes rarely, so the video/canvas pair
// skips the per-pluck re-renders of the parent.
export const Stage = memo(({ videoRef, canvasRef, status }: StageProps) => (
  <div className={`stage status-${status}`}>
    <video ref={videoRef} className="video" playsInline muted width={VIDEO_WIDTH} height={VIDEO_HEIGHT} />
    <canvas ref={canvasRef} className="overlay" />
  </div>
))
