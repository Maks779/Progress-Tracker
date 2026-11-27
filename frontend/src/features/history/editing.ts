import { create } from 'zustand';

import { draftActions } from '@/features/workout/editor';
import type { WorkoutDraft } from '@/features/workout/rules';

/**
 * The saved workout being edited in History, shared by the edit page and its exercise picker.
 * It lives in memory only: leaving the edit page drops unsaved changes, and nothing waits on
 * the device, because edits need the server.
 */
export const useSessionEdit = create<{ draft: WorkoutDraft | null }>()(() => ({ draft: null }));

export const sessionEdit = {
  ...draftActions((update) => {
    const { draft } = useSessionEdit.getState();
    if (draft) {
      useSessionEdit.setState({ draft: update(draft) });
    }
  }),
  start(draft: WorkoutDraft): void {
    useSessionEdit.setState({ draft });
  },
  rename(name: string): void {
    const { draft } = useSessionEdit.getState();
    if (draft) {
      useSessionEdit.setState({ draft: { ...draft, name } });
    }
  },
  end(): void {
    useSessionEdit.setState({ draft: null });
  },
};
