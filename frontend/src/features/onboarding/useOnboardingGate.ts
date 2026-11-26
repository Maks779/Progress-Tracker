import { useEffect } from 'react';

import { useAuthStore } from '@/features/auth/store';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';

import { type OnboardingStatus, useOnboarding } from './store';

/**
 * Decides whether a signed-in account goes through onboarding: it does when it has no tracker
 * at all, archived ones included. If the check cannot reach the server (offline start), the
 * app opens normally and checks again at the next start. Signing out forgets the answer.
 */
export function useOnboardingGate(): OnboardingStatus {
  const signedIn = useAuthStore((state) => state.status === 'signedIn');
  const status = useOnboarding((state) => state.status);
  const setStatus = useOnboarding((state) => state.setStatus);
  const checking = signedIn && status === 'unknown';
  const trackers = useListTrackers({ include_archived: true }, { query: { enabled: checking } });

  useEffect(() => {
    if (!signedIn && status !== 'unknown') {
      setStatus('unknown');
    }
  }, [signedIn, status, setStatus]);

  useEffect(() => {
    if (!checking) {
      return;
    }
    if (trackers.data?.status === 200) {
      setStatus(trackers.data.data.items.length === 0 ? 'needed' : 'done');
    } else if (trackers.isError) {
      setStatus('done');
    }
  }, [checking, trackers.data, trackers.isError, setStatus]);

  return status;
}
