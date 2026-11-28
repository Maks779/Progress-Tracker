/**
 * Plural rules for phones. Hermes has no `Intl.PluralRules` (nor `Intl.Locale`, which the rules
 * need), and i18next then picks the "other" form for every count: "2 виконаного підходу" instead
 * of "2 виконані підходи". FormatJS fills both in, with the data of Ember's three languages only.
 * The forced polyfill skips the detection code, which is slow on Android.
 */
import '@formatjs/intl-locale/polyfill.js';
import '@formatjs/intl-pluralrules/polyfill-force.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-pluralrules/locale-data/pl.js';
import '@formatjs/intl-pluralrules/locale-data/uk.js';
