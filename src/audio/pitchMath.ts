/** Folds a semitone offset into the Pitch knob's -24..24 range by whole octaves. */
export function foldToPitchRange(semitones: number): number {
  let result = semitones;
  while (result > 24) result -= 12;
  while (result < -24) result += 12;
  return Math.round(result * 10) / 10;
}
