/**
 * Tracks consecutive taps on the same id, reporting true once `requiredTaps`
 * land within `windowMs` of each other. Used to open the pad editor on a
 * triple-tap without needing a plain click to fall through to it.
 */
export function createTripleTapDetector(windowMs: number, requiredTaps: number) {
  let lastId: number | null = null;
  let count = 0;
  let lastTime = 0;

  return {
    registerTap(id: number): boolean {
      const now = Date.now();
      count = lastId === id && now - lastTime <= windowMs ? count + 1 : 1;
      lastId = id;
      lastTime = now;

      if (count >= requiredTaps) {
        count = 0;
        lastId = null;
        return true;
      }
      return false;
    },
  };
}
