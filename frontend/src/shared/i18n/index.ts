import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import pl from './locales/pl.json';
import uk from './locales/uk.json';

export const LANGUAGES = ['en', 'pl', 'uk'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Each language is shown in its own language in the selector. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  pl: 'Polski',
  uk: 'Українська',
};

export function isLanguage(code: string | null | undefined): code is Language {
  return LANGUAGES.includes(code as Language);
}

/** The first supported device language, else English. */
export function pickLanguage(codes: (string | null | undefined)[]): Language {
  return codes.find(isLanguage) ?? 'en';
}

const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, pl: { translation: pl }, uk: { translation: uk } },
  lng: pickLanguage(getLocales().map((locale) => locale.languageCode)),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
