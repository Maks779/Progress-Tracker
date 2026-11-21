import i18n, { pickLanguage } from '..';
import en from '../locales/en.json';
import pl from '../locales/pl.json';
import uk from '../locales/uk.json';

function flatKeys(object: object, prefix = ''): string[] {
  return Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? flatKeys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

const withoutPlurals = (keys: string[]) =>
  keys.filter((key) => !/_(one|few|many|other)$/.test(key)).sort();

describe('pickLanguage', () => {
  it('takes the first supported device language', () => {
    expect(pickLanguage(['de', 'pl', 'en'])).toBe('pl');
    expect(pickLanguage(['uk'])).toBe('uk');
  });

  it('falls back to English', () => {
    expect(pickLanguage(['de', null, undefined])).toBe('en');
    expect(pickLanguage([])).toBe('en');
  });
});

describe('translations', () => {
  it('have the same keys in every language', () => {
    const english = withoutPlurals(flatKeys(en));
    expect(withoutPlurals(flatKeys(pl))).toEqual(english);
    expect(withoutPlurals(flatKeys(uk))).toEqual(english);
  });

  it.each([
    ['en', 1, '1 session'],
    ['en', 5, '5 sessions'],
    ['pl', 1, '1 sesja'],
    ['pl', 3, '3 sesje'],
    ['pl', 5, '5 sesji'],
    ['pl', 22, '22 sesje'],
    ['uk', 1, '1 сесія'],
    ['uk', 3, '3 сесії'],
    ['uk', 5, '5 сесій'],
    ['uk', 21, '21 сесія'],
  ])('%s plural of %i is "%s"', (lng, count, expected) => {
    expect(i18n.t('sessions', { count, lng })).toBe(expected);
  });

  it('switch at runtime', async () => {
    await i18n.changeLanguage('uk');
    expect(i18n.t('tabs.home')).toBe('Головна');
    await i18n.changeLanguage('pl');
    expect(i18n.t('tabs.home')).toBe('Start');
    await i18n.changeLanguage('en');
  });
});
