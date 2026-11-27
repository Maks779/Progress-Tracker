/** "18:30" as a Date today, for pickers. */
export function timeToDate(value: string): Date {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/** A Date's clock time as "HH:MM", 24-hour. */
export function dateToTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "18:30" or "6:30 PM", as the UI language writes times. */
export function formatTime(value: string, language: string): string {
  return new Intl.DateTimeFormat(language, { hour: 'numeric', minute: '2-digit' }).format(timeToDate(value));
}
