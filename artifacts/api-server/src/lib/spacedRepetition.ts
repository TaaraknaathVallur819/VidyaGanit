import { shiftDate, istToday } from "./streak";

// A trimmed SM-2 scheduler for the Smart Review feature. `quality` is the
// student's self/auto-graded recall on 0–5. Quality < 3 is a lapse: the item
// resets to a 1-day interval. Otherwise the interval grows by the ease factor.

export interface SrState {
  intervalDays: number;
  ease: number;
  repetitions: number;
}

export interface SrResult extends SrState {
  dueDate: string;
}

export function scheduleReview(prev: SrState, quality: number): SrResult {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { ease } = prev;
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  let repetitions: number;
  let intervalDays: number;
  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions = prev.repetitions + 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(prev.intervalDays * ease);
  }

  return {
    ease,
    repetitions,
    intervalDays,
    dueDate: shiftDate(istToday(), intervalDays),
  };
}
