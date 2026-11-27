import { Platform } from 'react-native';
import { z } from 'zod';
import { create } from 'zustand';

import { useConnection } from '@/shared/api/connection';
import { putExercise } from '@/shared/api/generated/endpoints/exercises/exercises';
import { putSession } from '@/shared/api/generated/endpoints/sessions/sessions';
import type { ExerciseOut, ExerciseWrite, SessionSaved, SessionWrite } from '@/shared/api/generated/model';
import { newId } from '@/shared/ids';
import { oneTabAtATime } from '@/shared/locks';
import { storage } from '@/shared/storage/storage';

import { byQueue, type FailureCode, failureOf, type OutboxItem, pendingFor, retryDelay } from './rules';

const PREFIX = 'ember.outbox.';

type State = {
  hydrated: boolean;
  items: OutboxItem[];
  /** A round of sending is under way. */
  syncing: boolean;
  /** When the next round starts after the last one stopped without a connection. */
  retryAt: number | null;
};

/**
 * Changes made on this device that the server has not got yet (offline level B): finished
 * sessions, a note added later, custom exercises. Each one is kept in storage under its own
 * key, so browser tabs never overwrite each other's changes, and sent with `PUT` under its
 * own ID, so a repeat after a lost answer replaces instead of duplicating.
 */
export const useOutbox = create<State>()(() => ({ hydrated: false, items: [], syncing: false, retryAt: null }));

export function itemKey(item: Pick<OutboxItem, 'kind' | 'id'>): string {
  return `${PREFIX}${item.kind}.${item.id}`;
}

const base = {
  id: z.string(),
  userId: z.string(),
  queuedAt: z.number(),
  revision: z.string(),
  failure: z.enum(['tracker_gone', 'session_gone', 'exercise_gone', 'refused']).nullable(),
};
const itemSchema = z.discriminatedUnion('kind', [
  z.object({
    ...base,
    kind: z.literal('session'),
    body: z.looseObject({ tracker_id: z.string(), started_at: z.string(), local_date: z.string() }),
  }),
  z.object({
    ...base,
    kind: z.literal('exercise'),
    body: z.looseObject({ name: z.string(), muscle_group: z.string(), equipment: z.string() }),
  }),
]);

function parse(key: string, value: unknown): OutboxItem | null {
  const result = itemSchema.safeParse(value);
  return result.success && itemKey(result.data) === key ? (result.data as OutboxItem) : null;
}

function find(key: string): OutboxItem | undefined {
  return useOutbox.getState().items.find((item) => itemKey(item) === key);
}

function put(item: OutboxItem): void {
  const key = itemKey(item);
  useOutbox.setState(({ items }) => ({ items: [...items.filter((other) => itemKey(other) !== key), item].sort(byQueue) }));
}

function drop(key: string): void {
  useOutbox.setState(({ items }) => ({ items: items.filter((item) => itemKey(item) !== key) }));
}

async function load(): Promise<void> {
  const keys = await storage.keys(PREFIX);
  const values = await Promise.all(keys.map((key) => storage.read<unknown>(key)));
  const items: OutboxItem[] = [];
  keys.forEach((key, index) => {
    const item = parse(key, values[index]);
    if (item) {
      items.push(item);
    } else {
      void storage.remove(key);
    }
  });
  useOutbox.setState({ hydrated: true, items: items.sort(byQueue) });
}

let listening = false;

/**
 * Loads the waiting changes at start-up; anything unreadable is dropped. On the web another tab
 * may add or send changes, so this tab follows each stored change as it happens.
 */
export async function hydrateOutbox(): Promise<void> {
  if (Platform.OS === 'web' && !listening && typeof window !== 'undefined') {
    listening = true;
    window.addEventListener('storage', (event) => {
      if (!event.key?.startsWith(PREFIX)) {
        return;
      }
      const item = event.newValue === null ? null : parse(event.key, safeJson(event.newValue));
      if (item) {
        put(item);
      } else {
        drop(event.key);
      }
    });
  }
  await load();
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

type NewItem =
  | { kind: 'session'; id: string; userId: string; body: SessionWrite }
  | { kind: 'exercise'; id: string; userId: string; body: ExerciseWrite };

let lastQueuedAt = 0;

/**
 * Adds a change, or replaces the waiting one with the same ID (a note added to a session that
 * has not been sent yet), keeping its place in the queue.
 */
export async function enqueue(change: NewItem): Promise<OutboxItem> {
  const existing = find(itemKey(change));
  lastQueuedAt = Math.max(Date.now(), lastQueuedAt + 1);
  const item = { ...change, queuedAt: existing?.queuedAt ?? lastQueuedAt, revision: newId(), failure: null } as OutboxItem;
  put(item);
  await storage.write(itemKey(item), item);
  return item;
}

export async function removeItem(key: string): Promise<void> {
  drop(key);
  await storage.remove(key);
}

/** A refused change the person wants sent once more. */
export async function retryItem(key: string): Promise<void> {
  const item = find(key);
  if (item) {
    const again = { ...item, failure: null };
    put(again);
    await storage.write(key, again);
  }
}

/** Log out and account deletion: the account's waiting changes leave the device. */
export async function forgetAccount(userId: string): Promise<void> {
  const gone = useOutbox.getState().items.filter((item) => item.userId === userId);
  await Promise.all(gone.map((item) => removeItem(itemKey(item))));
}

async function refuse(item: OutboxItem, failure: FailureCode): Promise<void> {
  const current = find(itemKey(item));
  if (current?.revision === item.revision) {
    const refused = { ...current, failure };
    put(refused);
    await storage.write(itemKey(item), refused);
  }
}

type SavedListener = (item: OutboxItem, data: unknown) => void;
const listeners = new Set<SavedListener>();

/** Called for every change the server has saved, with its answer. */
export function onSaved(listener: SavedListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type Delivery<T> = { status: 'saved'; data: T } | { status: 'queued' } | { status: 'refused'; code: FailureCode };

const awaited = new Set<string>();
const outcomes = new Map<string, Delivery<unknown>>();

type Sent = 'sent' | 'refused' | 'stopped';

async function send(item: OutboxItem): Promise<Sent> {
  try {
    const response = item.kind === 'session' ? await putSession(item.id, item.body) : await putExercise(item.id, item.body);
    if (find(itemKey(item))?.revision === item.revision) {
      await removeItem(itemKey(item));
    }
    if (awaited.has(item.revision)) {
      outcomes.set(item.revision, { status: 'saved', data: response.data });
    }
    listeners.forEach((listener) => listener(item, response.data));
    return 'sent';
  } catch (error) {
    const failure = failureOf(item.kind, error);
    if (failure === null) {
      return 'stopped';
    }
    await refuse(item, failure);
    if (awaited.has(item.revision)) {
      outcomes.set(item.revision, { status: 'refused', code: failure });
    }
    return 'refused';
  }
}

/** `done`: nothing of the account is left to send; `stopped`: no answer, a retry is planned; `offline`: the device has no network. */
export type FlushResult = 'done' | 'stopped' | 'offline';

let failures = 0;

async function run(userId: string): Promise<FlushResult> {
  if (!useConnection.getState().online) {
    return 'offline';
  }
  useOutbox.setState({ syncing: true });
  try {
    for (let item = pendingFor(useOutbox.getState().items, userId)[0]; item; item = pendingFor(useOutbox.getState().items, userId)[0]) {
      if ((await send(item)) === 'stopped') {
        failures += 1;
        useOutbox.setState({ retryAt: Date.now() + retryDelay(failures, Math.random()) });
        return 'stopped';
      }
    }
    failures = 0;
    useOutbox.setState({ retryAt: null });
    return 'done';
  } finally {
    useOutbox.setState({ syncing: false });
  }
}

let inFlight: Promise<FlushResult> | null = null;

/**
 * Sends the account's waiting changes one by one, oldest first. Callers at the same moment
 * share one round, and browser tabs take turns. The round stops at the first change without an
 * answer and plans the next one (5 s, doubling up to 5 minutes); a refused change is marked and
 * the round goes on.
 */
export function flushOutbox(userId: string): Promise<FlushResult> {
  inFlight ??= oneTabAtATime('ember-outbox', () => run(userId)).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function deliver<T>(change: NewItem): Promise<Delivery<T>> {
  const item = await enqueue(change);
  awaited.add(item.revision);
  try {
    for (let round = 0; round < 3; round += 1) {
      const result = await flushOutbox(change.userId);
      const outcome = outcomes.get(item.revision);
      if (outcome) {
        return outcome as Delivery<T>;
      }
      if (result !== 'done') {
        return { status: 'queued' };
      }
    }
    return { status: 'queued' };
  } finally {
    awaited.delete(item.revision);
    outcomes.delete(item.revision);
  }
}

/**
 * Saves a session through the outbox and waits for the outcome: `saved` with the server's
 * answer, `queued` when it stays on the device until the connection is back, or `refused`.
 * Changes made before it go first, so a custom exercise created offline exists by then.
 */
export function deliverSession(id: string, userId: string, body: SessionWrite): Promise<Delivery<SessionSaved>> {
  return deliver({ kind: 'session', id, userId, body });
}

export function deliverExercise(id: string, userId: string, body: ExerciseWrite): Promise<Delivery<ExerciseOut>> {
  return deliver({ kind: 'exercise', id, userId, body });
}

export function sessionKey(id: string): string {
  return itemKey({ kind: 'session', id });
}
