import { weekOf } from '@/features/history/rules';
import type { Rest } from '@/features/workout/rules';
import type { GoalOut, TrackerSummary } from '@/shared/api/generated/model';
import { toIsoDate } from '@/shared/format/dates';

/** The rules of notifications (spec §3.11) as pure functions. */

/** Days still left in the week when the reminder goes off on Friday evening: Friday, Saturday, Sunday. */
export const DAYS_LEFT_AT_REMINDER = 3;

/** When the rest notification goes off: when the rest ends, if there is one still ahead. */
export function restAlarm(rest: Rest | null | undefined, now: number): Date | null {
  return rest && rest.endsAt > now + 1000 ? new Date(rest.endsAt) : null;
}

/** Friday 18:00 local time this week, or next week once it has passed (spec §3.11). */
export function nextReminderTime(now: Date): Date {
  const ahead = (5 - now.getDay() + 7) % 7;
  const friday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead, 18, 0, 0, 0);
  return friday.getTime() > now.getTime() ? friday : new Date(friday.getFullYear(), friday.getMonth(), friday.getDate() + 7, 18, 0, 0, 0);
}

export type ReminderGoal = { name: string; left: number };

/**
 * The weekly frequency goals the reminder names (spec §3.11): not met yet but still reachable by
 * Sunday (target − progress ≤ days left), pinned ones first, then the closest. A reminder for
 * next week counts from nothing, since that week has not started.
 */
export function reminderGoals(goals: GoalOut[], trackers: TrackerSummary[], at: Date, now: Date): ReminderGoal[] {
  const thisWeek = weekOf(toIsoDate(at)).from === weekOf(toIsoDate(now)).from;
  return goals
    .filter((goal) => goal.kind === 'frequency' && goal.period === 'week')
    .map((goal) => ({
      goal,
      tracker: trackers.find((tracker) => tracker.id === goal.tracker_id && !tracker.archived),
      left: goal.target - (thisWeek ? goal.progress.value : 0),
    }))
    .filter((item) => item.tracker && item.left > 0 && item.left <= DAYS_LEFT_AT_REMINDER)
    .sort((a, b) => Number(b.goal.is_pinned) - Number(a.goal.is_pinned) || a.left - b.left)
    .map((item) => ({ name: item.tracker?.name ?? '', left: item.left }));
}
