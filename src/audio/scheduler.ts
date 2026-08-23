export type StepCallback = (step: number, time: number) => void;

export interface SchedulerParams {
  bpm: number;
  /** 0..0.75 — fraction of a step every odd (off-beat) 16th note is delayed by. */
  swing: number;
  stepCount: number;
}

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;
/** How long a past scheduled step is kept around for UI lookups before pruning. */
const DISPLAY_HISTORY_S = 0.5;

/**
 * Standard look-ahead audio scheduler (see "A Tale of Two Clocks"): a
 * coarse setInterval wakes up frequently and schedules any steps that fall
 * within a short lookahead window using precise AudioContext time, so
 * playback stays sample-accurate regardless of JS timer jitter.
 */
export class Scheduler {
  private readonly ctx: AudioContext;
  private readonly getParams: () => SchedulerParams;
  private readonly onStep: StepCallback;

  private timerId: number | null = null;
  private nextStepTime = 0;
  private currentStep = 0;
  private scheduledSteps: { step: number; time: number }[] = [];

  constructor(ctx: AudioContext, getParams: () => SchedulerParams, onStep: StepCallback) {
    this.ctx = ctx;
    this.getParams = getParams;
    this.onStep = onStep;
  }

  start(): void {
    if (this.timerId !== null) return;
    this.currentStep = 0;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.scheduledSteps = [];
    this.timerId = window.setInterval(() => this.tick(), LOOKAHEAD_MS);
  }

  stop(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    this.scheduledSteps = [];
  }

  get isRunning(): boolean {
    return this.timerId !== null;
  }

  /** Best step to highlight in the UI right now, accounting for the scheduling lookahead. */
  displayStep(): number | null {
    const now = this.ctx.currentTime;
    let result: number | null = null;
    for (const entry of this.scheduledSteps) {
      if (entry.time <= now) result = entry.step;
    }
    this.scheduledSteps = this.scheduledSteps.filter((entry) => entry.time > now - DISPLAY_HISTORY_S);
    return result;
  }

  private tick(): void {
    const { bpm, swing, stepCount } = this.getParams();
    const secondsPerStep = 60 / bpm / 4;
    while (this.nextStepTime < this.ctx.currentTime + SCHEDULE_AHEAD_S) {
      const isOffBeat = this.currentStep % 2 === 1;
      const swingOffset = isOffBeat ? secondsPerStep * swing : 0;
      const time = this.nextStepTime + swingOffset;
      this.onStep(this.currentStep, time);
      this.scheduledSteps.push({ step: this.currentStep, time });
      this.nextStepTime += secondsPerStep;
      this.currentStep = (this.currentStep + 1) % Math.max(1, stepCount);
    }
  }
}
