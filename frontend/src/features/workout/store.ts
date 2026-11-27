import { Platform } from 'react-native';
import { z } from 'zod';
import { create } from 'zustand';

import { onSaved, removeItem, sessionKey } from '@/features/outbox/outbox';
import type { SessionSaved, SessionWrite } from '@/shared/api/generated/model';
import { storage } from '@/shared/storage/storage';

import { draftActions } from './editor';
import { extendRest, type WorkoutDraft } from './rules';

export { buildExercise, type NewExercise } from './editor';

const STORAGE_KEY = 'ember.workout';

/**
 * What Summary shows after Finish; kept until Done, so it survives a restart too. `body` is
 * the session as sent (or waiting in the outbox); `saved` is the server's answer, null until
 * the session reaches the server.
 */
export type WorkoutSummary = {
  userId: string;
  trackerName: string;
  sessionId: string;
  body: SessionWrite;
  saved: SessionSaved | null;
};

type State = { hydrated: boolean; draft: WorkoutDraft | null; summary: WorkoutSummary | null };

/**
 * The active workout lives on the device from Start to Finish (offline level B): in memory for
 * the screens, and in storage after every change, so closing the app or the tab loses nothing.
 */
export const useWorkout = create<State>()(() => ({ hydrated: false, draft: null, summary: null }));

const setKind = z.enum(['working', 'warmup']);
const weight = z.number().nullable();
const draftSchema = z.object({
  version: z.literal(1),
  id: z.string(),
  userId: z.string(),
  trackerId: z.string(),
  name: z.string(),
  startedAt: z.string(),
  localDate: z.string(),
  exercises: z.array(
    z.object({
      id: z.string(),
      exerciseId: z.string(),
      info: z.object({ key: z.string().nullable(), name: z.string().nullable(), is_custom: z.boolean() }),
      group: z.number().nullable(),
      weighted: z.boolean(),
      previous: z.array(z.object({ weightKg: weight, reps: z.number(), kind: setKind })),
      sets: z.array(
        z.object({
          id: z.string(),
          kind: setKind,
          weightKg: weight,
          reps: z.number().nullable(),
          ghost: z.object({ weightKg: weight, reps: z.number() }).nullable(),
          done: z.boolean(),
        }),
      ),
    }),
  ),
  rest: z.object({ endsAt: z.number(), seconds: z.number() }).nullable(),
  prefillFailed: z.boolean().optional(),
});
const summarySchema = z.object({
  userId: z.string(),
  trackerName: z.string(),
  sessionId: z.string(),
  body: z.looseObject({ tracker_id: z.string(), started_at: z.string(), local_date: z.string() }),
  saved: z
    .looseObject({
      session: z.looseObject({ id: z.string() }),
      new_records: z.array(z.looseObject({})),
    })
    .nullable(),
});

let loading = false;

async function load(): Promise<void> {
  const saved = await storage.read<{ draft?: unknown; summary?: unknown }>(STORAGE_KEY);
  const draft = draftSchema.safeParse(saved?.draft);
  const summary = summarySchema.safeParse(saved?.summary);
  loading = true;
  useWorkout.setState({
    hydrated: true,
    draft: draft.success ? draft.data : null,
    summary: summary.success ? (summary.data as unknown as WorkoutSummary) : null,
  });
  loading = false;
}

useWorkout.subscribe((state, previous) => {
  if (loading || !state.hydrated || (state.draft === previous.draft && state.summary === previous.summary)) {
    return;
  }
  void storage.write(STORAGE_KEY, { draft: state.draft, summary: state.summary });
});

let listening = false;

/**
 * Loads the saved workout at start-up; anything unreadable is dropped. On the web another tab
 * may change the workout, so this tab reloads it when the stored copy changes.
 */
export async function hydrateWorkout(): Promise<void> {
  if (Platform.OS === 'web' && !listening && typeof window !== 'undefined') {
    listening = true;
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY) {
        void load();
      }
    });
  }
  await load();
}

function change(update: (draft: WorkoutDraft) => WorkoutDraft): void {
  const { draft } = useWorkout.getState();
  if (draft) {
    useWorkout.setState({ draft: update(draft) });
  }
}

/** Every change to the active workout; each one is saved to the device at once. */
export const workout = {
  ...draftActions(change),
  begin(draft: WorkoutDraft): void {
    useWorkout.setState({ draft, summary: null });
  },
  rename(name: string): void {
    change((draft) => ({ ...draft, name }));
  },
  extendRest(now = Date.now()): void {
    change((draft) => (draft.rest ? { ...draft, rest: extendRest(draft.rest, now) } : draft));
  },
  skipRest(): void {
    change((draft) => ({ ...draft, rest: null }));
  },
  /** Nothing of it was saved: a Finish that is still waiting to be sent goes too. */
  discard(): void {
    const { draft } = useWorkout.getState();
    useWorkout.setState({ draft: null });
    if (draft) {
      void removeItem(sessionKey(draft.id));
    }
  },
  finished(summary: WorkoutSummary): void {
    useWorkout.setState({ draft: null, summary });
  },
  /** The session as sent again with a note. */
  summaryBody(body: SessionWrite): void {
    const { summary } = useWorkout.getState();
    if (summary) {
      useWorkout.setState({ summary: { ...summary, body } });
    }
  },
  /**
   * The server's answer for the session on Summary, also when the outbox sends it later. The
   * records stay those of the first answer: sending the session again for a note does not set
   * them again.
   */
  sessionSaved(saved: SessionSaved): void {
    const { summary } = useWorkout.getState();
    if (summary && summary.sessionId === saved.session.id) {
      const records = summary.saved ? summary.saved.new_records : saved.new_records;
      useWorkout.setState({ summary: { ...summary, saved: { ...saved, new_records: records } } });
    }
  },
  closeSummary(): void {
    useWorkout.setState({ summary: null });
  },
  /** Log out and account deletion: nothing of this account stays on the device. */
  clear(): void {
    useWorkout.setState({ draft: null, summary: null });
  },
};

onSaved((item, data) => {
  if (item.kind === 'session') {
    workout.sessionSaved(data as SessionSaved);
  }
});
