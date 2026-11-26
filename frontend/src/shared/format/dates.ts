/** Calendar dates travel as ISO strings ("2026-12-31") and never through UTC, so a day never shifts. */

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** "Dec 31, 2026" / "31 gru 2026" / "31 груд. 2026 р." in the UI language. */
export function formatDate(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    parseIsoDate(iso),
  );
}

/** The last day of the year that contains `today`. */
export function endOfYear(today: Date): string {
  return `${today.getFullYear()}-12-31`;
}
