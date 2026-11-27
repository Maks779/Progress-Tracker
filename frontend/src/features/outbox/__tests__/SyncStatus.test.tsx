import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { useAuthStore } from '@/features/auth/store';
import { useConnection } from '@/shared/api/connection';
import { putSession } from '@/shared/api/generated/endpoints/sessions/sessions';
import type { SessionWrite } from '@/shared/api/generated/model';
import i18n from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';

import { SyncStatus } from '../components/SyncStatus';
import { enqueue, useOutbox } from '../outbox';
import type { FailureCode } from '../rules';

jest.mock('@/shared/api/generated/endpoints/me/me', () => ({ useReadMe: () => ({ data: { status: 200, data: { id: 'me' } } }) }));
jest.mock('@/shared/api/generated/endpoints/sessions/sessions', () => ({ putSession: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/exercises/exercises', () => ({ putExercise: jest.fn() }));

const BODY: SessionWrite = { tracker_id: 'gym', started_at: '2026-11-26T17:00:00Z', local_date: '2026-11-26', name: 'Upper body A' };
const EXERCISE = { name: 'Spider curl', muscle_group: 'arms', equipment: 'dumbbell' } as const;

async function show() {
  await render(
    <ThemeProvider>
      <SyncStatus />
    </ThemeProvider>,
  );
}

const press = (name: string) => act(() => fireEvent.press(screen.getByRole('button', { name })));

async function refused(id: string, failure: FailureCode) {
  const item = await enqueue({ kind: 'session', id, userId: 'me', body: BODY });
  useOutbox.setState(({ items }) => ({ items: items.map((entry) => (entry.id === item.id ? { ...entry, failure } : entry)) }));
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await i18n.changeLanguage('en');
  useAuthStore.setState({ status: 'signedIn' });
  useConnection.setState({ online: true, reachable: true });
  useOutbox.setState({ hydrated: true, items: [], syncing: false, retryAt: null });
});

afterAll(async () => {
  await i18n.changeLanguage('en');
});

describe('Sync status on Home', () => {
  it('is not there while online with nothing waiting, and ignores another account’s changes', async () => {
    await enqueue({ kind: 'session', id: 'theirs', userId: 'other', body: BODY });
    await show();
    expect(screen.toJSON()).toBeNull();
  });

  it('says offline how many sessions wait on the device and how many changes in all', async () => {
    useConnection.setState({ reachable: false });
    await enqueue({ kind: 'session', id: 'one', userId: 'me', body: BODY });
    await enqueue({ kind: 'session', id: 'two', userId: 'me', body: BODY });
    await enqueue({ kind: 'exercise', id: 'curl', userId: 'me', body: EXERCISE });
    await show();

    expect(screen.getByText('You’re offline.')).toBeTruthy();
    expect(screen.getByText('Keep logging. 2 sessions are stored on this device and will sync when you reconnect.')).toBeTruthy();
    expect(screen.getByText('3 changes waiting to sync')).toBeTruthy();
  });

  it('keeps it short offline when nothing waits, in every language', async () => {
    useConnection.setState({ online: false });
    await show();
    expect(screen.getByText('Keep logging. What you save is stored on this device and syncs when you reconnect.')).toBeTruthy();
    expect(screen.queryByText(/waiting to sync/)).toBeNull();

    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      await enqueue({ kind: 'session', id, userId: 'me', body: BODY });
    }
    await act(() => i18n.changeLanguage('pl'));
    expect(screen.getByText('5 zmian czeka na synchronizację')).toBeTruthy();
    expect(screen.getByText(/5 sesji jest zapisanych/)).toBeTruthy();
    await act(() => i18n.changeLanguage('uk'));
    expect(screen.getByText('Ти офлайн.')).toBeTruthy();
    expect(screen.getByText('5 змін чекають на синхронізацію')).toBeTruthy();
  });

  it('offers Sync now when online again with changes still waiting', async () => {
    jest.mocked(putSession).mockResolvedValue({ status: 201, data: { session: { id: 'one' } }, headers: new Headers() } as never);
    await enqueue({ kind: 'session', id: 'one', userId: 'me', body: BODY });
    await show();

    expect(screen.getByText('1 change waiting to sync')).toBeTruthy();
    await act(() => fireEvent.press(screen.getByRole('link', { name: 'Sync now' })));
    expect(putSession).toHaveBeenCalledWith('one', BODY);
    expect(screen.toJSON()).toBeNull();
  });

  it('shows why the server refused a change and removes it only after asking', async () => {
    await refused('gone', 'tracker_gone');
    await show();

    expect(screen.getByText('“Upper body A” couldn’t be saved')).toBeTruthy();
    expect(screen.getByText('Its tracker was deleted on another device, so the server can’t keep it.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();

    await press('Remove');
    expect(screen.getByText('Remove “Upper body A”?')).toBeTruthy();
    await press('Keep it');
    expect(useOutbox.getState().items).toHaveLength(1);
    await press('Remove');
    await act(() => fireEvent.press(screen.getAllByRole('button', { name: 'Remove' }).at(-1)!));
    expect(useOutbox.getState().items).toEqual([]);
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  it('sends a refused change once more on Try again', async () => {
    await refused('odd', 'refused');
    await show();

    expect(screen.getByText('The server didn’t accept it.')).toBeTruthy();
    await press('Try again');
    expect(useOutbox.getState().items[0].failure).toBeNull();
  });
});
