import type { i18n as I18n } from 'i18next';

const intl = Intl as unknown as Record<string, unknown>;
const NATIVE = { PluralRules: Intl.PluralRules, Locale: Intl.Locale };

/** Loads the app's i18n the way a phone does, on an engine without plural rules (Hermes). */
function i18nOnHermes(): I18n {
  delete intl.PluralRules;
  delete intl.Locale;
  let loaded: I18n | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual<{ default: I18n }>('..').default;
  });
  return loaded!;
}

afterEach(() => {
  for (const [name, value] of Object.entries(NATIVE)) {
    Object.defineProperty(Intl, name, { value, writable: true, configurable: true });
  }
});

describe('plural forms on a phone', () => {
  it.each([
    ['uk', 1, 'Збережемо 1 виконаний підхід.'],
    ['uk', 2, 'Збережемо 2 виконані підходи.'],
    ['uk', 5, 'Збережемо 5 виконаних підходів.'],
    ['uk', 21, 'Збережемо 21 виконаний підхід.'],
    ['pl', 2, 'Zapiszemy 2 wykonane serie.'],
    ['pl', 12, 'Zapiszemy 12 wykonanych serii.'],
    ['en', 1, '1 completed set will be saved.'],
    ['en', 2, '2 completed sets will be saved.'],
  ])('%s, %i: "%s"', (lng, count, expected) => {
    const i18n = i18nOnHermes();
    expect(Intl.PluralRules).not.toBe(NATIVE.PluralRules);
    expect(i18n.t('workout.finish.all', { count, lng })).toBe(expected);
  });

  it('follow the same rules as the browsers for every count', () => {
    i18nOnHermes();
    const counts = [...Array.from({ length: 251 }, (_, n) => n), 0.5, 1.5, 2.25, 11.1, 1000, 1001, 1012];
    for (const language of ['en', 'pl', 'uk']) {
      const polyfill = new Intl.PluralRules(language);
      const native = new NATIVE.PluralRules(language);
      expect(counts.map((count) => polyfill.select(count))).toEqual(counts.map((count) => native.select(count)));
    }
  });
});
