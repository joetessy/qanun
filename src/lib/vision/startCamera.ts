import { VIDEO_HEIGHT, VIDEO_WIDTH } from './constants'

export interface StartCameraArgs {
  video: HTMLVideoElement
}

export interface CameraInfo {
  stream: MediaStream
  width: number
  height: number
}

// Attach the webcam stream to the given video element. Resolves once the
// video reports its intrinsic size (so callers can size the canvas overlay).
export const startCamera = async ({ video }: StartCameraArgs): Promise<CameraInfo> => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: VIDEO_WIDTH },
      height: { ideal: VIDEO_HEIGHT },
      facingMode: 'user'
    },
    audio: false
  })
  video.srcObject = stream
  await video.play()
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    await new Promise<void>((resolve) => {
      const onLoaded = (): void => {
        video.removeEventListener('loadedmetadata', onLoaded)
        resolve()
      }
      video.addEventListener('loadedmetadata', onLoaded)
    })
  }
  return {
    stream,
    width: video.videoWidth || VIDEO_WIDTH,
    height: video.videoHeight || VIDEO_HEIGHT
  }
}

// Map a getUserMedia / camera-start failure to a short, human-readable reason.
// Used for the non-blocking "playing without the camera" notice — the camera is
// optional, so these are informational, not errors that stop play.
export const describeCameraError = (err: unknown): string => {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'Camera permission denied'
      case 'NotFoundError':
      case 'OverconstrainedError':
        return 'No camera found'
      case 'NotReadableError':
        return 'Camera is in use by another app'
    }
  }
  return err instanceof Error ? err.message : String(err)
}
