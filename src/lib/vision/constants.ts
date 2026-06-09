// MediaPipe Hand Landmarker indices.
export const THUMB_TIP = 4
export const INDEX_TIP = 8
// Middle fingertip — pinching it to the thumb engages tremolo mode (a distinct
// gesture from the thumb–index pluck, so the two never collide).
export const MIDDLE_TIP = 12
// Knuckles (MCP joints) of the index and pinky — their separation is the palm
// width, a stable hand-size reference used to make the pinch distance-invariant
// (a pinch reads the same near or far from the camera).
export const INDEX_MCP = 5
export const PINKY_MCP = 17

// Requested webcam dimensions. 16:9 native — wider horizontal range for pitch,
// no `object-fit: cover` crop needed (canvas overlay aligns with the video 1:1).
export const VIDEO_WIDTH = 1280
export const VIDEO_HEIGHT = 720
