import { create } from 'zustand';

import { ApiError } from '@/shared/api/fetcher';
import { updateMe } from '@/shared/api/generated/endpoints/me/me';
import type { Me, MeUpdate } from '@/shared/api/generated/model';
import i18n, { isLanguage, LANGUAGES } from '@/shared/i18n';
import { storage } from '@/shared/storage/storage';

export type Preferences = Pick<
  Me,
  'language' | 'theme' | 'weight_unit' | 'distance_unit' | 'notify_rest_timer' | 'notify_weekly_reminder'
>;
export type PreferenceKey = keyof Preferences;

export const PREFERENCE_CHOICES: { [K in PreferenceKey]: readonly Preferences[K][] } = {
  language: LANGUAGES,
  theme: ['system', 'light', 'dark'],
  weight_unit: ['kg', 'lb'],
  distance_unit: ['km', 'mi'],
  notify_rest_timer: [true, false],
  notify_weekly_reminder: [true, false],
};

const KEYS = Object.keys(PREFERENCE_CHOICES) as PreferenceKey[];
const STORAGE_KEY = 'ember.preferences';

type Saved = { values: Preferences; pending: PreferenceKey[] };

type PreferencesState = Saved & { hydrated: boolean };

function deviceDefaults(): Preferences {
  const language = i18n.language;
  return {
    language: isLanguage(language) ? language : 'en',
    theme: 'system',
    weight_unit: 'kg',
    distance_unit: 'km',
    notify_rest_timer: true,
    notify_weekly_reminder: true,
  };
}

/**
 * Language, theme, units and which notifications to get. The device keeps its own copy, so the
 * app starts with the right look offline and a change applies at once; `pending` lists changes
 * the server has not got yet. The server copy follows the account to other devices.
 */
export const usePreferences = create<PreferencesState>()(() => ({
  values: deviceDefaults(),
  pending: [],
  hydrated: false,
}));

function isChoice<K extends PreferenceKey>(key: K, value: unknown): value is Preferences[K] {
  return (PREFERENCE_CHOICES[key] as readonly unknown[]).includes(value);
}

function validValues(saved: unknown): Partial<Preferences> {
  if (!saved || typeof saved !== 'object') {
    return {};
  }
  const values: Partial<Record<PreferenceKey, unknown>> = {};
  for (const key of KEYS) {
    const value = (saved as Record<string, unknown>)[key];
    if (isChoice(key, value)) {
      values[key] = value;
    }
  }
  return values as Partial<Preferences>;
}

function apply(values: Preferences): void {
  if (i18n.language !== values.language) {
    void i18n.changeLanguage(values.language);
  }
}

async function save(): Promise<void> {
  const { values, pending } = usePreferences.getState();
  await storage.write(STORAGE_KEY, { values, pending } satisfies Saved);
}

/** Loads the device copy at start-up; anything unreadable falls back to the defaults. */
export async function hydratePreferences(): Promise<void> {
  const saved = await storage.read<Partial<Saved>>(STORAGE_KEY);
  const values = { ...deviceDefaults(), ...validValues(saved?.values) };
  const pending = Array.isArray(saved?.pending)
    ? KEYS.filter((key) => saved.pending?.includes(key))
    : [];
  usePreferences.setState({ values, pending, hydrated: true });
  apply(values);
}

/** Applies a choice at once and marks it for the server. */
export async function changePreference<K extends PreferenceKey>(
  key: K,
  value: Preferences[K],
): Promise<void> {
  const { values, pending } = usePreferences.getState();
  if (values[key] === value) {
    return;
  }
  const next = { ...values, [key]: value };
  usePreferences.setState({
    values: next,
    pending: pending.includes(key) ? pending : [...pending, key],
  });
  apply(next);
  await save();
}

/** Takes the account's values, except the ones changed here and not sent yet. */
export async function applyServerPreferences(server: Preferences): Promise<void> {
  const { values, pending } = usePreferences.getState();
  const next = { ...values };
  for (const key of KEYS) {
    if (!pending.includes(key) && isChoice(key, server[key])) {
      Object.assign(next, { [key]: server[key] });
    }
  }
  if (KEYS.every((key) => next[key] === values[key])) {
    return;
  }
  usePreferences.setState({ values: next });
  apply(next);
  await save();
}

/** After sign-out unsent changes must not reach the next account signed in on this device. */
export async function forgetPendingPreferences(): Promise<void> {
  if (usePreferences.getState().pending.length === 0) {
    return;
  }
  usePreferences.setState({ pending: [] });
  await save();
}

let inFlight: Promise<Me | null> | null = null;

async function send(): Promise<Me | null> {
  const { values, pending } = usePreferences.getState();
  if (pending.length === 0) {
    return null;
  }
  const sent: MeUpdate = Object.fromEntries(pending.map((key) => [key, values[key]]));
  try {
    const response = await updateMe(sent);
    if (response.status !== 200) {
      return null;
    }
    const current = usePreferences.getState();
    usePreferences.setState({
      pending: current.pending.filter((key) => current.values[key] !== sent[key]),
    });
    await save();
    return response.data;
  } catch (error) {
    const refused =
      error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429;
    if (refused) {
      usePreferences.setState({ pending: [] });
      await save();
    }
    return null;
  }
}

/**
 * Sends the unsent changes in one request; callers at the same moment share it. A change made
 * while it is on the way stays pending and goes in the next one. Without a connection the
 * changes wait; a value the server refuses is dropped, so it is not retried forever.
 */
export function pushPreferences(): Promise<Me | null> {
  inFlight ??= send().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
