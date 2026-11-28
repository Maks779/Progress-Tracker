import type { GoalOut, TrackerSummary } from '@/shared/api/generated/model';

import { nextReminderTime, reminderGoals, restAlarm } from '../rules';

const goal = (tracker_id: string, target: number, value: number, overrides: Partial<GoalOut> = {}): GoalOut =>
  ({ id: tracker_id, tracker_id, kind: 'frequency', period: 'week', target, is_pinned: false, progress: { value, target }, ...overrides }) as GoalOut;
const tracker = (id: string, archived = false) => ({ id, name: id, archived }) as TrackerSummary;

describe('the rest notification', () => {
  it('goes off when a rest still ahead ends, and never for one that is over', () => {
    expect(restAlarm({ endsAt: 100_000, seconds: 90 }, 10_000)).toEqual(new Date(100_000));
    expect(restAlarm({ endsAt: 10_500, seconds: 90 }, 10_000)).toBeNull();
    expect(restAlarm(null, 10_000)).toBeNull();
  });
});

describe('the weekly reminder (spec §3.11)', () => {
  it('goes off on Friday at 18:00 local time, this week while it is ahead, else next week', () => {
    expect(nextReminderTime(new Date(2026, 10, 23, 9))).toEqual(new Date(2026, 10, 27, 18));
    expect(nextReminderTime(new Date(2026, 10, 27, 17, 59))).toEqual(new Date(2026, 10, 27, 18));
    expect(nextReminderTime(new Date(2026, 10, 27, 18))).toEqual(new Date(2026, 11, 4, 18));
    expect(nextReminderTime(new Date(2026, 10, 28, 12))).toEqual(new Date(2026, 11, 4, 18));
    expect(nextReminderTime(new Date(2026, 10, 29, 23))).toEqual(new Date(2026, 11, 4, 18));
  });

  it('names the weekly frequency goals not met but still reachable, pinned first, then the closest', () => {
    const now = new Date(2026, 10, 25, 12);
    const at = nextReminderTime(now);
    const goals = [
      goal('gym', 3, 1),
      goal('read', 2, 2),
      goal('run', 5, 0),
      goal('yoga', 3, 2, { is_pinned: true }),
      goal('swim', 1, 0),
      goal('water', 8, 0, { kind: 'amount' }),
      goal('old', 2, 0),
    ];
    const trackers = ['gym', 'read', 'run', 'yoga', 'swim', 'water'].map((id) => tracker(id)).concat(tracker('old', true));
    expect(reminderGoals(goals, trackers, at, now)).toEqual([
      { name: 'yoga', left: 1 },
      { name: 'swim', left: 1 },
      { name: 'gym', left: 2 },
    ]);
  });

  it('counts next week’s goals from nothing', () => {
    const now = new Date(2026, 10, 28, 12);
    const at = nextReminderTime(now);
    expect(reminderGoals([goal('gym', 3, 3), goal('run', 4, 4)], [tracker('gym'), tracker('run')], at, now)).toEqual([{ name: 'gym', left: 3 }]);
  });
});
