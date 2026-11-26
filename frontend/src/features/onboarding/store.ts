import { create } from 'zustand';

/**
 * `unknown` until the app has checked the account, `needed` for an account without any
 * tracker (a new one, or one that never finished the setup), `done` otherwise.
 */
export type OnboardingStatus = 'unknown' | 'needed' | 'done';

type OnboardingState = {
  status: OnboardingStatus;
  setStatus: (status: OnboardingStatus) => void;
};

export const useOnboarding = create<OnboardingState>()((set) => ({
  status: 'unknown',
  setStatus: (status) => set({ status }),
}));
