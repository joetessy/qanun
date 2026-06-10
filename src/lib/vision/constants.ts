// MediaPipe Hand Landmarker indices.
export const THUMB_TIP = 4
// Thumb IP joint — the knuckle one segment below the tip; extrapolating past
// the tip along IP→tip lands the cursor on the visual nail tip (see extrapolateTip).
export const THUMB_IP = 3
export const INDEX_TIP = 8
// Middle fingertip — pinching it to the thumb engages tremolo mode (a distinct
// gesture from the thumb–index pluck, so the two never collide).
export const MIDDLE_TIP = 12
// DIP joints (one segment below each tip) — used to extrapolate the drawn
// state dots out to the visual fingertips, same as the thumb cursor.
export const INDEX_DIP = 7
export const MIDDLE_DIP = 11
// Knuckles (MCP joints) of the index and pinky — their separation is the palm
// width, a stable hand-size reference used to make the pinch distance-invariant
// (a pinch reads the same near or far from the camera).
export const INDEX_MCP = 5
export const PINKY_MCP = 17

// Requested webcam dimensions (16:9 native). The board renders the frame with
// `object-fit: cover`, which crops it vertically on wider-than-16:9 layouts —
// the engine remaps MediaPipe's frame-y to the visible region (see tick) so
// string selection matches what's on screen.
export const VIDEO_WIDTH = 1280
export const VIDEO_HEIGHT = 720
