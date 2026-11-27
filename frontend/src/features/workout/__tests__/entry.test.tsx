import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useAuthStore } from '@/features/auth/store';
import { useHome } from '@/shared/api/generated/endpoints/stats/stats';

import { type WorkoutDraft } from '../rules';
import { useWorkoutEntry } from '../start';
import { useWorkout } from '../store';

jest.mock('expo-router', () => ({ usePathname: () => '/', router: { push: jest.fn(), dismissTo: jest.fn() } }));
jest.mock('@/shared/api/generated/endpoints/me/me', () => ({
  useReadMe: () => ({ data: { status: 200, data: { id: 'me', main_tracker_id: 'gym' } } }),
}));
jest.mock('@/shared/api/generated/endpoints/trackers/trackers', () => ({
  useListTrackers: () => ({ data: { status: 200, data: { items: [{ id: 'gym', name: 'Gym', type: 'strength', archived: false }] } } }),
}));
jest.mock('@/shared/api/generated/endpoints/stats/stats', () => ({ useHome: jest.fn() }));

let client: QueryClient;

async function entry() {
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return (await renderHook(() => useWorkoutEntry(jest.fn()), { wrapper })).result.current;
}

beforeEach(() => {
  client = new QueryClient();
  useAuthStore.setState({ status: 'signedIn' });
  useWorkout.setState({ hydrated: true, draft: null, summary: null });
});

afterEach(() => {
  client.clear();
});

describe('Start workout', () => {
  it('waits for Home’s numbers, which name the workout to repeat', async () => {
    jest.mocked(useHome).mockReturnValue({ data: undefined, isError: false } as unknown as ReturnType<typeof useHome>);
    expect(await entry()).toMatchObject({ available: false, active: false });
  });

  it('is offered once they are known, or could not be loaded', async () => {
    jest.mocked(useHome).mockReturnValue({
      data: { status: 200, data: { main_tracker_id: 'gym', up_next: null } },
      isError: false,
    } as unknown as ReturnType<typeof useHome>);
    expect((await entry()).available).toBe(true);
    jest.mocked(useHome).mockReturnValue({ data: undefined, isError: true } as unknown as ReturnType<typeof useHome>);
    expect((await entry()).available).toBe(true);
  });

  it('becomes Resume while a workout is under way, whatever Home shows', async () => {
    jest.mocked(useHome).mockReturnValue({ data: undefined, isError: false } as unknown as ReturnType<typeof useHome>);
    useWorkout.setState({ draft: { id: 'w', userId: 'me' } as WorkoutDraft });
    expect(await entry()).toMatchObject({ available: true, active: true });
  });
});
