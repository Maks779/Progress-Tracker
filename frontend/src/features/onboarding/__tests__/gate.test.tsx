import { renderHook } from '@testing-library/react-native';

import { useAuthStore } from '@/features/auth/store';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';

import { useOnboarding } from '../store';
import { useOnboardingGate } from '../useOnboardingGate';

jest.mock('@/shared/api/generated/endpoints/trackers/trackers', () => ({ useListTrackers: jest.fn() }));

const trackers = useListTrackers as jest.Mock;

function answer(state: { items?: unknown[]; isError?: boolean; fresh?: boolean }) {
  trackers.mockReturnValue({
    data: state.items ? { status: 200, data: { items: state.items } } : undefined,
    isError: state.isError ?? false,
    isFetchedAfterMount: state.fresh ?? Boolean(state.items),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  useOnboarding.setState({ status: 'unknown' });
  useAuthStore.setState({ status: 'signedIn', accessToken: 'token', expired: false });
});

describe('useOnboardingGate', () => {
  it('sends an account without trackers to onboarding, archived trackers included', async () => {
    answer({ items: [] });

    const { result } = await renderHook(() => useOnboardingGate());

    expect(trackers).toHaveBeenCalledWith({ include_archived: true }, { query: { enabled: true, staleTime: 0 } });
    expect(result.current).toBe('needed');
  });

  it('lets an account with trackers straight in', async () => {
    answer({ items: [{ id: 'gym' }] });

    const { result } = await renderHook(() => useOnboardingGate());

    expect(result.current).toBe('done');
  });

  it('trusts a saved list with trackers at once', async () => {
    answer({ items: [{ id: 'gym' }], fresh: false });

    const { result } = await renderHook(() => useOnboardingGate());

    expect(result.current).toBe('done');
  });

  it('waits for a fresh answer when the saved list is empty', async () => {
    answer({ items: [], fresh: false });

    const { result, rerender } = await renderHook(() => useOnboardingGate());
    expect(result.current).toBe('unknown');

    answer({ items: [{ id: 'gym' }] });
    await rerender({});
    expect(result.current).toBe('done');
  });

  it('opens the app when the check cannot reach the server', async () => {
    answer({ isError: true });

    const { result } = await renderHook(() => useOnboardingGate());

    expect(result.current).toBe('done');
  });

  it('does not ask while signed out, and forgets the answer on sign-out', async () => {
    useAuthStore.setState({ status: 'signedOut', accessToken: null, expired: false });
    useOnboarding.setState({ status: 'done' });
    answer({});

    await renderHook(() => useOnboardingGate());

    expect(trackers).toHaveBeenCalledWith({ include_archived: true }, { query: { enabled: false, staleTime: 0 } });
    expect(useOnboarding.getState().status).toBe('unknown');
  });
});
