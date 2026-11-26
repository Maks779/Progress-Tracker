import { createGoal } from '@/shared/api/generated/endpoints/goals/goals';
import { createTracker } from '@/shared/api/generated/endpoints/trackers/trackers';

import { goalBody, type TrackerKind, trackerBody } from './plan';

export type Choice = { kind: TrackerKind; name: string; target: number };

/** What has reached the server so far, so a retry continues instead of creating twins. */
export type Progress = Partial<Record<TrackerKind, { trackerId: string; goal: boolean }>>;

/**
 * Creates each chosen tracker and its weekly goal, in order. Trackers are created with POST,
 * which is not safe to repeat, so `progress` records every step that succeeded: after a lost
 * connection the next attempt skips them and only sends what is missing.
 */
export async function createLineup(choices: Choice[], progress: Progress): Promise<void> {
  for (const { kind, name, target } of choices) {
    let step = progress[kind];
    if (!step) {
      const tracker = await createTracker(trackerBody(kind, name));
      if (tracker.status !== 201) {
        throw new Error(`Unexpected tracker response ${tracker.status}`);
      }
      step = { trackerId: tracker.data.id, goal: false };
      progress[kind] = step;
    }
    if (!step.goal) {
      const goal = await createGoal(goalBody(kind, step.trackerId, target));
      if (goal.status !== 201) {
        throw new Error(`Unexpected goal response ${goal.status}`);
      }
      step.goal = true;
    }
  }
}
