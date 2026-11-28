import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError } from '@/shared/api/fetcher';
import { updateMe } from '@/shared/api/generated/endpoints/me/me';
import i18n from '@/shared/i18n';

import {
  applyServerPreferences,
  changePreference,
  forgetPendingPreferences,
  hydratePreferences,
  type Preferences,
  pushPreferences,
  usePreferences,
} from '../preferences';

jest.mock('@/shared/api/generated/endpoints/me/me', () => ({ updateMe: jest.fn() }));

const updateMock = updateMe as jest.Mock;
const DEFAULTS: Preferences = { language: 'en', theme: 'system', weight_unit: 'kg', distance_unit: 'km', notify_rest_timer: true, notify_weekly_reminder: true };

function me(values: Partial<Preferences> = {}) {
  return { status: 200, headers: new Headers(), data: { ...DEFAULTS, ...values, name: 'Alex' } };
}

async function saved() {
  const raw = await AsyncStorage.getItem('ember.preferences');
  return raw === null ? null : JSON.parse(raw);
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await i18n.changeLanguage('en');
  usePreferences.setState({ values: DEFAULTS, pending: [], hydrated: false });
});

afterAll(async () => {
  await i18n.changeLanguage('en');
});

describe('hydratePreferences', () => {
  it('starts from the device language and the defaults on a fresh install', async () => {
    await hydratePreferences();

    expect(usePreferences.getState()).toMatchObject({ values: DEFAULTS, pending: [], hydrated: true });
  });

  it('restores the saved choices and the changes not sent yet', async () => {
    await AsyncStorage.setItem(
      'ember.preferences',
      JSON.stringify({ values: { ...DEFAULTS, language: 'uk', theme: 'dark' }, pending: ['theme'] }),
    );

    await hydratePreferences();

    expect(usePreferences.getState()).toMatchObject({
      values: { language: 'uk', theme: 'dark' },
      pending: ['theme'],
    });
    expect(i18n.language).toBe('uk');
  });

  it('ignores whatever it cannot trust in storage', async () => {
    await AsyncStorage.setItem(
      'ember.preferences',
      JSON.stringify({ values: { language: 'de', theme: 'neon', weight_unit: 'lb' }, pending: ['hack', 'theme'] }),
    );

    await hydratePreferences();

    expect(usePreferences.getState()).toMatchObject({
      values: { ...DEFAULTS, weight_unit: 'lb' },
      pending: ['theme'],
    });
  });

  it('survives a broken storage entry', async () => {
    await AsyncStorage.setItem('ember.preferences', '{not json');

    await hydratePreferences();

    expect(usePreferences.getState()).toMatchObject({ values: DEFAULTS, hydrated: true });
  });
});

describe('changePreference', () => {
  it('applies at once, remembers it on the device and marks it for the server', async () => {
    await changePreference('language', 'pl');

    expect(i18n.language).toBe('pl');
    expect(usePreferences.getState()).toMatchObject({ values: { language: 'pl' }, pending: ['language'] });
    expect(await saved()).toMatchObject({ values: { language: 'pl' }, pending: ['language'] });
  });

  it('does nothing when the value is already set', async () => {
    await changePreference('theme', 'system');

    expect(usePreferences.getState().pending).toEqual([]);
  });
});

describe('applyServerPreferences', () => {
  it('takes the account values on a new device', async () => {
    await applyServerPreferences({
      language: 'uk',
      theme: 'light',
      weight_unit: 'lb',
      distance_unit: 'mi',
      notify_rest_timer: true,
      notify_weekly_reminder: false,
    });

    expect(usePreferences.getState().values).toEqual({
      language: 'uk',
      theme: 'light',
      weight_unit: 'lb',
      distance_unit: 'mi',
      notify_rest_timer: true,
      notify_weekly_reminder: false,
    });
    expect(i18n.language).toBe('uk');
  });

  it('keeps a change made here that the server has not got yet', async () => {
    await changePreference('theme', 'dark');

    await applyServerPreferences({ ...DEFAULTS, theme: 'light', weight_unit: 'lb' });

    expect(usePreferences.getState().values).toMatchObject({ theme: 'dark', weight_unit: 'lb' });
  });
});

describe('pushPreferences', () => {
  it('sends only the changed values and clears them once saved', async () => {
    updateMock.mockResolvedValue(me({ weight_unit: 'lb' }));
    await changePreference('weight_unit', 'lb');

    const updated = await pushPreferences();

    expect(updateMock).toHaveBeenCalledWith({ weight_unit: 'lb' });
    expect(updated).toMatchObject({ weight_unit: 'lb' });
    expect(usePreferences.getState().pending).toEqual([]);
    expect(await saved()).toMatchObject({ pending: [] });
  });

  it('keeps the changes while the server cannot be reached', async () => {
    updateMock.mockRejectedValue(new ApiError({ type: 'about:blank', title: 'x', status: 0, code: 'network_error' }));
    await changePreference('theme', 'dark');

    expect(await pushPreferences()).toBeNull();

    expect(usePreferences.getState().pending).toEqual(['theme']);
  });

  it('drops a value the server refuses, so it is not retried forever', async () => {
    updateMock.mockRejectedValue(new ApiError({ type: 'about:blank', title: 'x', status: 422, code: 'validation_error' }));
    await changePreference('theme', 'dark');

    await pushPreferences();

    expect(usePreferences.getState().pending).toEqual([]);
  });

  it('keeps a change made while the request was on its way', async () => {
    let answer: (value: unknown) => void = () => undefined;
    updateMock.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    await changePreference('theme', 'dark');

    const push = pushPreferences();
    await changePreference('theme', 'light');
    answer(me({ theme: 'dark' }));
    await push;

    expect(usePreferences.getState()).toMatchObject({ values: { theme: 'light' }, pending: ['theme'] });
  });

  it('shares one request between callers who ask at the same time', async () => {
    updateMock.mockResolvedValue(me({ theme: 'dark' }));
    await changePreference('theme', 'dark');

    await Promise.all([pushPreferences(), pushPreferences()]);

    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when nothing changed', async () => {
    expect(await pushPreferences()).toBeNull();
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe('forgetPendingPreferences', () => {
  it('drops unsent changes but keeps the look of the app', async () => {
    await changePreference('theme', 'dark');

    await forgetPendingPreferences();

    expect(usePreferences.getState()).toMatchObject({ values: { theme: 'dark' }, pending: [] });
  });
});
