import { renderHook } from '@testing-library/react-native';

import { usePreferences } from '@/features/settings/preferences';
import type { SessionListItem } from '@/shared/api/generated/model';
import i18n from '@/shared/i18n';

import { useHomeText } from '../format';

async function text(language: string, weight: 'kg' | 'lb' = 'kg', distance: 'km' | 'mi' = 'km') {
  await i18n.changeLanguage(language);
  usePreferences.setState((state) => ({ values: { ...state.values, weight_unit: weight, distance_unit: distance } }));
  return (await renderHook(() => useHomeText())).result.current;
}

function item(headline: SessionListItem['headline'], overrides: Partial<SessionListItem> = {}): SessionListItem {
  return {
    id: 's',
    tracker_id: 't',
    tracker_type: 'strength',
    name: 'Upper body A',
    started_at: '2026-11-25T17:00:00Z',
    local_date: '2026-11-25',
    duration_s: 2880,
    headline,
    ...overrides,
  };
}

afterAll(async () => {
  await i18n.changeLanguage('en');
  usePreferences.setState((state) => ({ values: { ...state.values, weight_unit: 'kg', distance_unit: 'km' } }));
});

describe('duration', () => {
  it.each([
    [29, '0 min'],
    [2880, '48 min'],
    [3600, '1 h'],
    [4320, '1 h 12 min'],
    [3570, '1 h'],
  ])('%i s -> %s', async (seconds, expected) => {
    expect((await text('en')).duration(seconds)).toBe(expected);
  });

  it('speaks Polish and Ukrainian', async () => {
    expect((await text('pl')).duration(3900)).toBe('1 godz. 5 min');
    expect((await text('uk')).duration(3900)).toBe('1 год 5 хв');
  });
});

describe('day', () => {
  it('reads today, yesterday, a weekday this week and older dates', async () => {
    const en = await text('en');
    expect(en.day('2026-11-26', '2026-11-26')).toBe('Today');
    expect(en.day('2026-11-25', '2026-11-26')).toBe('Yesterday');
    expect(en.day('2026-11-21', '2026-11-26')).toBe('Saturday');
    expect(en.day('2026-11-12', '2026-11-26')).toBe('Nov 12');
  });

  it('capitalizes weekdays that the language writes in lower case', async () => {
    expect((await text('pl')).day('2026-11-21', '2026-11-26')).toBe('Sobota');
    expect((await text('uk')).day('2026-11-21', '2026-11-26')).toBe('Субота');
  });
});

describe('weights', () => {
  it('shows kilograms or pounds to one decimal', async () => {
    expect((await text('en')).weight(4820)).toBe('4,820 kg');
    expect((await text('en', 'lb')).weight(1000)).toBe('2,204.6 lb');
    expect((await text('en', 'lb')).weightValue(2000)).toBe('4,409');
  });

  it('uses the Ukrainian forms of pounds', async () => {
    expect((await text('uk', 'lb')).weight(0.4535924)).toBe('1 фунт');
    expect((await text('uk', 'lb')).weight(2.26796)).toBe('5 фунтів');
    expect((await text('uk')).weight(62.5)).toBe('62,5 кг');
  });
});

describe('headline', () => {
  it('shows the main figure of each kind of session', async () => {
    const en = await text('en');
    expect(en.headline(item({ metric: 'volume_kg', value: 4820 }))).toBe('4,820 kg');
    expect(en.headline(item({ metric: 'distance_m', value: 5200 }))).toBe('5.2 km');
    expect(en.headline(item({ metric: 'pages', value: 24 }))).toBe('24 pages');
    expect(en.headline(item({ metric: 'pages', value: 1 }))).toBe('1 page');
    expect(en.headline(item({ metric: 'count', value: 5, unit_label: 'glasses' }))).toBe('5 glasses');
    expect(en.headline(item({ metric: 'duration_s', value: 1200 }))).toBe('20 min');
    expect((await text('en', 'kg', 'mi')).headline(item({ metric: 'distance_m', value: 5200 }))).toBe('3.23 mi');
  });

  it('puts the day and duration on one line, without a duration when there is none', async () => {
    const en = await text('en');
    expect(en.sessionLine(item({ metric: 'pages', value: 3 }), '2026-11-26')).toBe('Yesterday · 48 min');
    expect(en.sessionLine(item({ metric: 'count', value: 5 }, { duration_s: null }), '2026-11-26')).toBe('Yesterday');
  });
});
