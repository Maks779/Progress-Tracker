import { useEffect } from 'react';

import { useAuthStore } from '@/features/auth/store';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';

import { type OnboardingStatus, useOnboarding } from './store';

/**
 * Decides whether a signed-in account goes through onboarding: it does when it has no tracker
 * at all, archived ones included. A list saved on the device with trackers in it is trusted at
 * once (a quick start offline); an empty saved list waits for a fresh answer, because it may
 * predate the trackers made during onboarding. If the check cannot reach the server, the app
 * opens normally and checks again at the next start. Signing out forgets the answer.
 */
export function useOnboardingGate(): OnboardingStatus {
  const signedIn = useAuthStore((state) => state.status === 'signedIn');
  const status = useOnboarding((state) => state.status);
  const setStatus = useOnboarding((state) => state.setStatus);
  const checking = signedIn && status === 'unknown';
  const trackers = useListTrackers({ include_archived: true }, { query: { enabled: checking, staleTime: 0 } });

  useEffect(() => {
    if (!signedIn && status !== 'unknown') {
      setStatus('unknown');
    }
  }, [signedIn, status, setStatus]);

  useEffect(() => {
    if (!checking) {
      return;
    }
    const items = trackers.data?.status === 200 ? trackers.data.data.items : undefined;
    if (items && (items.length > 0 || trackers.isFetchedAfterMount)) {
      setStatus(items.length === 0 ? 'needed' : 'done');
    } else if (trackers.isError) {
      setStatus('done');
    }
  }, [checking, trackers.data, trackers.isFetchedAfterMount, trackers.isError, setStatus]);

  return status;
}
