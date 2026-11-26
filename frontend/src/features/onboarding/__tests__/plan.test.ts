import { ApiError } from '@/shared/api/fetcher';
import { createGoal } from '@/shared/api/generated/endpoints/goals/goals';
import { createTracker } from '@/shared/api/generated/endpoints/trackers/trackers';

import { goalBody, initialTargets, stepTarget, trackerBody } from '../plan';
import { createLineup, type Progress } from '../setup';

jest.mock('@/shared/api/generated/endpoints/trackers/trackers', () => ({ createTracker: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/goals/goals', () => ({ createGoal: jest.fn() }));

const offline = new ApiError({ type: 'about:blank', title: 'x', status: 0, code: 'network_error' });

beforeEach(() => {
  jest.clearAllMocks();
  let next = 0;
  (createTracker as jest.Mock).mockImplementation(async () => ({ status: 201, data: { id: `tracker-${(next += 1)}` } }));
  (createGoal as jest.Mock).mockResolvedValue({ status: 201, data: {} });
});

describe('plan', () => {
  it('starts with three sessions a week, or 60 pages for reading', () => {
    expect(initialTargets()).toEqual({ strength: 3, cardio: 3, reading: 60, general: 3 });
  });

  it('keeps targets inside their limits', () => {
    expect(stepTarget('strength', 7, 1)).toBe(7);
    expect(stepTarget('strength', 1, -1)).toBe(1);
    expect(stepTarget('reading', 60, 1)).toBe(70);
    expect(stepTarget('reading', 10, -1)).toBe(10);
    expect(stepTarget('reading', 500, 1)).toBe(500);
  });

  it('builds a duration tracker for general habits, so no unit is needed', () => {
    expect(trackerBody('general', 'Habit')).toEqual({
      type: 'general',
      name: 'Habit',
      color: 'general',
      icon: 'sparkles',
      general_mode: 'duration',
    });
    expect(trackerBody('strength', 'Gym')).toEqual({ type: 'strength', name: 'Gym', color: 'strength', icon: 'dumbbell' });
  });

  it('asks for sessions a week, or pages a week for reading', () => {
    expect(goalBody('cardio', 't1', 4)).toEqual({
      tracker_id: 't1',
      kind: 'frequency',
      period: 'week',
      metric: 'sessions',
      target: 4,
      is_pinned: true,
    });
    expect(goalBody('reading', 't2', 80)).toMatchObject({ kind: 'amount', metric: 'pages', target: 80 });
  });
});

describe('createLineup', () => {
  const choices = [
    { kind: 'strength' as const, name: 'Gym', target: 3 },
    { kind: 'reading' as const, name: 'Reading', target: 60 },
  ];

  it('creates each tracker and its weekly goal', async () => {
    const progress: Progress = {};

    await createLineup(choices, progress);

    expect(createTracker).toHaveBeenCalledTimes(2);
    expect(createGoal).toHaveBeenNthCalledWith(1, expect.objectContaining({ tracker_id: 'tracker-1', target: 3 }));
    expect(createGoal).toHaveBeenNthCalledWith(2, expect.objectContaining({ tracker_id: 'tracker-2', target: 60 }));
    expect(progress).toEqual({ strength: { trackerId: 'tracker-1', goal: true }, reading: { trackerId: 'tracker-2', goal: true } });
  });

  it('continues after a lost connection without creating the same tracker twice', async () => {
    (createGoal as jest.Mock).mockResolvedValueOnce({ status: 201, data: {} }).mockRejectedValueOnce(offline);
    const progress: Progress = {};

    await expect(createLineup(choices, progress)).rejects.toBe(offline);
    expect(progress.reading).toEqual({ trackerId: 'tracker-2', goal: false });

    await createLineup(choices, progress);

    expect(createTracker).toHaveBeenCalledTimes(2);
    expect(createGoal).toHaveBeenCalledTimes(3);
    expect(createGoal).toHaveBeenLastCalledWith(expect.objectContaining({ tracker_id: 'tracker-2' }));
  });
});
