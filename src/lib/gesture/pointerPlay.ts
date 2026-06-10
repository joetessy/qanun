/** Normalize a pointer's clientY to [0, 1] within the play surface rect
 *  (0 = top edge, 1 = bottom edge). */
export const stageNormalizedY = ({
  clientY,
  rectTop,
  rectHeight
}: {
  clientY: number
  rectTop: number
  rectHeight: number
}): number => Math.min(1, Math.max(0, (clientY - rectTop) / rectHeight))
