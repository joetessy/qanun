export interface StopCameraArgs {
  video: HTMLVideoElement | null
}

export const stopCamera = ({ video }: StopCameraArgs): void => {
  const src = video?.srcObject
  if (src instanceof MediaStream) {
    for (const track of src.getTracks()) track.stop()
  }
  if (video) video.srcObject = null
}
