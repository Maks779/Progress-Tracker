import type { GoalOut, TrackerSummary, WeekDay } from '@/shared/api/generated/model';
import { parseIsoDate, toIsoDate } from '@/shared/format/dates';

export type RingState =
  | { kind: 'goal'; goal: GoalOut; tracker: TrackerSummary }
  | { kind: 'noGoal'; tracker: TrackerSummary }
  | { kind: 'none' };

export type RingMessage = 'zero' | 'more' | 'one' | 'met';

export type NextGoal = { goal: GoalOut; tracker: TrackerSummary; remaining: number };

export type RelativeDay = 'today' | 'yesterday' | 'week' | 'older';

function activeTrackers(trackers: TrackerSummary[]): TrackerSummary[] {
  return trackers.filter((tracker) => !tracker.archived).sort((a, b) => a.position - b.position);
}

function pinnedWeekly(goals: GoalOut[], trackerId: string): GoalOut | undefined {
  return goals.find((goal) => goal.tracker_id === trackerId && goal.is_pinned && goal.period === 'week');
}

/**
 * What the ring on Home shows. The main tracker (always a strength tracker) with its pinned
 * weekly goal, or an invitation to set one. Without a main tracker (no active strength
 * tracker), the first active tracker with a pinned weekly goal, else the first active
 * tracker's invitation. No active tracker at all: nothing.
 */
export function ringFor(mainId: string | null, goals: GoalOut[], trackers: TrackerSummary[]): RingState {
  const active = activeTrackers(trackers);
  const main = active.find((tracker) => tracker.id === mainId);
  if (main) {
    const goal = pinnedWeekly(goals, main.id);
    return goal ? { kind: 'goal', goal, tracker: main } : { kind: 'noGoal', tracker: main };
  }
  for (const tracker of active) {
    const goal = pinnedWeekly(goals, tracker.id);
    if (goal) {
      return { kind: 'goal', goal, tracker };
    }
  }
  return active[0] ? { kind: 'noGoal', tracker: active[0] } : { kind: 'none' };
}

/** The line next to the ring: nothing yet, under way, one session to go, or met. */
export function ringMessage(goal: Pick<GoalOut, 'kind' | 'progress'>): RingMessage {
  const { value, target } = goal.progress;
  if (value >= target) {
    return 'met';
  }
  if (value <= 0) {
    return 'zero';
  }
  return goal.kind === 'frequency' && target - value === 1 ? 'one' : 'more';
}

/**
 * The goal for the "… to your next goal" card: among the daily and weekly goals of active
 * trackers that are not met yet (the ring's goal aside), the one closest to done; ties go to
 * the tracker listed first.
 */
export function nextGoal(goals: GoalOut[], trackers: TrackerSummary[], excludeId?: string): NextGoal | undefined {
  const active = activeTrackers(trackers);
  const order = new Map(active.map((tracker, index) => [tracker.id, index]));
  const share = (goal: GoalOut) => goal.progress.value / goal.progress.target;
  const best = goals
    .filter(
      (goal) =>
        goal.id !== excludeId &&
        goal.kind !== 'cumulative' &&
        order.has(goal.tracker_id) &&
        goal.progress.value < goal.progress.target,
    )
    .sort((a, b) => share(b) - share(a) || order.get(a.tracker_id)! - order.get(b.tracker_id)!)[0];
  if (!best) {
    return undefined;
  }
  const tracker = active[order.get(best.tracker_id)!];
  return { goal: best, tracker, remaining: best.progress.target - best.progress.value };
}

/** Pages read this week are shown "of 60" when exactly one weekly pages goal exists. */
export function pagesTarget(goals: GoalOut[], trackers: TrackerSummary[]): number | undefined {
  const active = new Set(activeTrackers(trackers).map((tracker) => tracker.id));
  const pages = goals.filter(
    (goal) => goal.metric === 'pages' && goal.period === 'week' && active.has(goal.tracker_id),
  );
  return pages.length === 1 ? pages[0].target : undefined;
}

/** The seven days of the week that starts on `weekStart` (a Monday), as ISO dates. */
export function weekDates(weekStart: string): string[] {
  const start = parseIsoDate(weekStart);
  return Array.from({ length: 7 }, (_, index) =>
    toIsoDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)),
  );
}

/** Days of the week with a session: of one tracker, or of any when `trackerId` is missing. */
export function activeDays(days: WeekDay[], trackerId?: string): Set<string> {
  return new Set(
    days.filter((day) => !trackerId || day.tracker_ids.includes(trackerId)).map((day) => day.local_date),
  );
}

/** How a session's day reads in a list: today, yesterday, a weekday this past week, or a date. */
export function relativeDay(localDate: string, today: string): RelativeDay {
  const days = Math.round((parseIsoDate(today).getTime() - parseIsoDate(localDate).getTime()) / 86_400_000);
  if (days <= 0) {
    return 'today';
  }
  if (days === 1) {
    return 'yesterday';
  }
  return days < 7 ? 'week' : 'older';
}

/** "Alex Morgan" -> "Alex", for the greeting. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}
