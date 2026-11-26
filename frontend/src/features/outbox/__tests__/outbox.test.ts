import AsyncStorage from '@react-native-async-storage/async-storage';

import { useConnection } from '@/shared/api/connection';
import { ApiError } from '@/shared/api/fetcher';
import { putExercise } from '@/shared/api/generated/endpoints/exercises/exercises';
import { putSession } from '@/shared/api/generated/endpoints/sessions/sessions';
import type { SessionWrite } from '@/shared/api/generated/model';

import {
  deliverExercise,
  deliverSession,
  enqueue,
  flushOutbox,
  forgetAccount,
  hydrateOutbox,
  itemKey,
  onSaved,
  retryItem,
  useOutbox,
} from '../outbox';

jest.mock('@/shared/api/generated/endpoints/sessions/sessions', () => ({ putSession: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/exercises/exercises', () => ({ putExercise: jest.fn() }));

const BODY: SessionWrite = { tracker_id: 'gym', started_at: '2026-11-26T17:00:00Z', local_date: '2026-11-26', duration_s: 1200 };
const EXERCISE = { name: 'Spider curl', muscle_group: 'arms', equipment: 'dumbbell' } as const;

const ok = (data: unknown) => ({ status: 201, data, headers: new Headers() }) as never;
const error = (status: number, errors: { field: string; code: string }[] = []) =>
  new ApiError({ type: 'about:blank', title: 'Error', status, code: 'error', errors: errors.map((item) => ({ ...item, message: '' })) });
const ids = () => useOutbox.getState().items.map((item) => item.id);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useOutbox.setState({ hydrated: true, items: [], syncing: false, retryAt: null });
  useConnection.setState({ online: true, reachable: true });
  jest.mocked(putSession).mockImplementation(async (id) => ok({ session: { id }, new_records: [] }));
  jest.mocked(putExercise).mockImplementation(async (id) => ok({ id }));
});

describe('changes on the device', () => {
  it('are kept under their own keys and come back in order after a restart; unreadable ones are dropped', async () => {
    await enqueue({ kind: 'exercise', id: 'curl', userId: 'me', body: EXERCISE });
    await enqueue({ kind: 'session', id: 'one', userId: 'me', body: BODY });
    await AsyncStorage.setItem('ember.outbox.session.junk', JSON.stringify({ kind: 'session', id: 'junk' }));
    await AsyncStorage.setItem('ember.outbox.session.moved', JSON.stringify({ ...useOutbox.getState().items[1], id: 'elsewhere' }));
    expect([...(await AsyncStorage.getAllKeys())].sort()).toEqual([
      'ember.outbox.exercise.curl',
      'ember.outbox.session.junk',
      'ember.outbox.session.moved',
      'ember.outbox.session.one',
    ]);

    useOutbox.setState({ hydrated: false, items: [] });
    await hydrateOutbox();
    expect(useOutbox.getState()).toMatchObject({ hydrated: true });
    expect(ids()).toEqual(['curl', 'one']);
    expect(await AsyncStorage.getItem('ember.outbox.session.junk')).toBeNull();
    expect(await AsyncStorage.getItem('ember.outbox.session.moved')).toBeNull();
  });

  it('keep their place when a waiting session changes again (a note added offline)', async () => {
    const first = await enqueue({ kind: 'session', id: 'one', userId: 'me', body: BODY });
    await enqueue({ kind: 'session', id: 'two', userId: 'me', body: BODY });
    const again = await enqueue({ kind: 'session', id: 'one', userId: 'me', body: { ...BODY, note: 'Felt strong.' } });
    expect(ids()).toEqual(['one', 'two']);
    expect(again.queuedAt).toBe(first.queuedAt);
    expect(again.revision).not.toBe(first.revision);
    expect(JSON.parse((await AsyncStorage.getItem(itemKey(again))) ?? '{}')).toMatchObject({ body: { note: 'Felt strong.' } });
  });

  it('of an account leave the device with it; other accounts keep theirs', async () => {
    await enqueue({ kind: 'session', id: 'mine', userId: 'me', body: BODY });
    await enqueue({ kind: 'session', id: 'theirs', userId: 'other', body: BODY });
    await forgetAccount('me');
    expect(ids()).toEqual(['theirs']);
    expect(await AsyncStorage.getAllKeys()).toEqual(['ember.outbox.session.theirs']);
  });
});

describe('sending', () => {
  it('sends the account’s changes oldest first, removes each one and reports it', async () => {
    const saved = jest.fn();
    const stop = onSaved(saved);
    await enqueue({ kind: 'exercise', id: 'curl', userId: 'me', body: EXERCISE });
    await enqueue({ kind: 'session', id: 'one', userId: 'me', body: BODY });
    await enqueue({ kind: 'session', id: 'theirs', userId: 'other', body: BODY });

    expect(await flushOutbox('me')).toBe('done');
    stop();
    expect(putExercise).toHaveBeenCalledWith('curl', EXERCISE);
    expect(putSession).toHaveBeenCalledTimes(1);
    expect(jest.mocked(putExercise).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(putSession).mock.invocationCallOrder[0]);
    expect(ids()).toEqual(['theirs']);
    expect(saved.mock.calls.map(([item, data]) => [item.id, data])).toEqual([
      ['curl', { id: 'curl' }],
      ['one', { session: { id: 'one' }, new_records: [] }],
    ]);
    expect(useOutbox.getState()).toMatchObject({ syncing: false, retryAt: null });
  });

  it('stops at the first change without an answer and plans the next round', async () => {
    jest.mocked(putSession).mockRejectedValueOnce(error(0));
    await enqueue({ kind: 'session', id: 'one', userId: 'me', body: BODY });
    await enqueue({ kind: 'session', id: 'two', userId: 'me', body: BODY });
    const before = Date.now();

    expect(await flushOutbox('me')).toBe('stopped');
    expect(putSession).toHaveBeenCalledTimes(1);
    expect(ids()).toEqual(['one', 'two']);
    const { retryAt } = useOutbox.getState();
    expect(retryAt! - before).toBeGreaterThanOrEqual(4_000);
    expect(retryAt! - before).toBeLessThanOrEqual(6_100);

    expect(await flushOutbox('me')).toBe('done');
    expect(ids()).toEqual([]);
    expect(useOutbox.getState().retryAt).toBeNull();
  });

  it('marks a refused change, goes on with the rest, and sends it again on request', async () => {
    jest.mocked(putSession).mockRejectedValueOnce(error(422, [{ field: 'tracker_id', code: 'not_found' }]));
    await enqueue({ kind: 'session', id: 'one', userId: 'me', body: BODY });
    await enqueue({ kind: 'session', id: 'two', userId: 'me', body: BODY });

    expect(await flushOutbox('me')).toBe('done');
    expect(useOutbox.getState().items).toEqual([expect.objectContaining({ id: 'one', failure: 'tracker_gone' })]);
    expect(JSON.parse((await AsyncStorage.getItem('ember.outbox.session.one')) ?? '{}')).toMatchObject({ failure: 'tracker_gone' });

    await retryItem('ember.outbox.session.one');
    expect(useOutbox.getState().items[0].failure).toBeNull();
    expect(await flushOutbox('me')).toBe('done');
    expect(ids()).toEqual([]);
  });

  it('sends a change again when it was replaced while on its way', async () => {
    jest.mocked(putSession).mockImplementationOnce(async (id) => {
      await enqueue({ kind: 'session', id, userId: 'me', body: { ...BODY, note: 'Later note.' } });
      return ok({ session: { id } });
    });
    await enqueue({ kind: 'session', id: 'one', userId: 'me', body: BODY });

    expect(await flushOutbox('me')).toBe('done');
    expect(jest.mocked(putSession).mock.calls.map(([, body]) => body.note)).toEqual([undefined, 'Later note.']);
    expect(ids()).toEqual([]);
  });

  it('waits for a network instead of trying without one, and shares one round between callers', async () => {
    await enqueue({ kind: 'session', id: 'one', userId: 'me', body: BODY });
    useConnection.setState({ online: false });
    expect(await flushOutbox('me')).toBe('offline');
    expect(putSession).not.toHaveBeenCalled();

    useConnection.setState({ online: true });
    const [first, second] = [flushOutbox('me'), flushOutbox('me')];
    expect(first).toBe(second);
    await first;
    expect(putSession).toHaveBeenCalledTimes(1);
  });
});

describe('delivering one change', () => {
  it('answers with the server’s answer, or says it waits on the device, or that it was refused', async () => {
    expect(await deliverSession('one', 'me', BODY)).toEqual({ status: 'saved', data: { session: { id: 'one' }, new_records: [] } });

    jest.mocked(putExercise).mockRejectedValueOnce(error(0));
    expect(await deliverExercise('curl', 'me', EXERCISE)).toEqual({ status: 'queued' });
    expect(ids()).toEqual(['curl']);

    useConnection.setState({ online: false });
    expect(await deliverSession('two', 'me', BODY)).toEqual({ status: 'queued' });
    expect(ids()).toEqual(['curl', 'two']);

    useConnection.setState({ online: true });
    jest.mocked(putSession).mockImplementation(async (id) => (id === 'three' ? Promise.reject(error(404)) : ok({ session: { id } })));
    expect(await deliverSession('three', 'me', BODY)).toEqual({ status: 'refused', code: 'session_gone' });
    expect(jest.mocked(putExercise).mock.calls.map(([id]) => id)).toEqual(['curl', 'curl']);
    expect(ids()).toEqual(['three']);
  });
});
