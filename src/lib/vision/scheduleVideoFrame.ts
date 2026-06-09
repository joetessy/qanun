// Schedule a callback for the next presented video frame.
// Uses HTMLVideoElement.requestVideoFrameCallback when available — that fires
// exactly once per new frame, never duplicates. Falls back to rAF otherwise.

export interface ScheduleVideoFrameArgs {
  video: HTMLVideoElement
  callback: () => void
}

export interface FrameHandle {
  cancel: () => void
}

export const scheduleVideoFrame = ({ video, callback }: ScheduleVideoFrameArgs): FrameHandle => {
  if (typeof video.requestVideoFrameCallback === 'function') {
    const id = video.requestVideoFrameCallback(() => callback())
    return { cancel: () => video.cancelVideoFrameCallback(id) }
  }
  const id = requestAnimationFrame(() => callback())
  return { cancel: () => cancelAnimationFrame(id) }
}
