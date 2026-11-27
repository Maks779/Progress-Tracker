import type { BookOut, GoalOut, SessionOut, SessionWrite, TrackerSummary } from '@/shared/api/generated/model';

/** The rules of the quick log forms (spec §3.2, §3.5–§3.7), as pure functions. */

export type QuickKind = 'cardio' | 'reading' | 'duration' | 'counter';
export type DistanceUnit = 'km' | 'mi';

const METRES = { km: 1000, mi: 1609.344 } as const;

export const LIMITS = {
  durationS: { min: 1, max: 24 * 60 * 60 },
  distanceKm: 1000,
  minutes: { min: 1, max: 1440 },
  count: { min: 1, max: 1000 },
  pages: 10_000,
} as const;

/** The form a tracker logs with; strength trackers log a workout instead. */
export function kindOf(tracker: Pick<TrackerSummary, 'type' | 'general_mode'>): QuickKind | null {
  if (tracker.type === 'cardio' || tracker.type === 'reading') {
    return tracker.type;
  }
  if (tracker.type === 'general') {
    return tracker.general_mode === 'counter' ? 'counter' : 'duration';
  }
  return null;
}

function wholeNumber(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') {
    return null;
  }
  return /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
}

/**
 * A duration as typed: "32" is minutes, "32:30" minutes and seconds, "1:05:00" hours, minutes
 * and seconds. A dot or a comma works like the colon ("32.30"), because number keypads on
 * Android have no colon. `null` when empty, `undefined` when it is not a duration.
 */
export function parseDuration(text: string): number | null | undefined {
  const trimmed = text.trim().replace(/[.,]/g, ':');
  if (trimmed === '') {
    return null;
  }
  if (!/^\d+(:\d{2}){0,2}$/.test(trimmed)) {
    return undefined;
  }
  const parts = trimmed.split(':').map(Number);
  if (parts.length === 1) {
    return parts[0] * 60;
  }
  const [last, middle, first] = [...parts].reverse();
  if (last >= 60 || (parts.length === 3 && middle >= 60)) {
    return undefined;
  }
  return parts.length === 2 ? middle * 60 + last : first * 3600 + middle * 60 + last;
}

/** "32:00" under an hour, "1:05:00" from an hour on (spec §3.1). */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

/** A distance as typed in km or mi, with a comma or a dot, to whole metres. */
export function parseDistance(text: string, unit: DistanceUnit): number | null | undefined {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') {
    return null;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return undefined;
  }
  return Math.round(Number(trimmed) * METRES[unit]);
}

/** Metres in km or mi, up to two decimals, trailing zeros dropped: "5.2". */
export function distanceText(metres: number, unit: DistanceUnit): string {
  return String(Math.round((metres / METRES[unit]) * 100) / 100);
}

/** Seconds per km or mi (spec §3.5); none without a distance. */
export function paceSeconds(durationS: number, metres: number, unit: DistanceUnit): number | null {
  return metres > 0 ? Math.round(durationS / (metres / METRES[unit])) : null;
}

/** Typing pages read sets the end page (spec §3.6). */
export function endPageFor(previousEnd: number, pagesRead: number): number {
  return previousEnd + pagesRead;
}

/** Typing the current page sets the pages read. */
export function pagesReadFor(previousEnd: number, endPage: number): number {
  return endPage - previousEnd;
}

export type QuickForm = {
  durationText: string;
  distanceText: string;
  minutesText: string;
  count: number;
  pagesReadText: string;
  endPageText: string;
  note: string;
  date: string;
  time: string;
};

export type Problem =
  | 'required'
  | 'invalid'
  | 'tooShort'
  | 'tooLong'
  | 'tooFar'
  | 'pagesTooFew'
  | 'pastLastPage'
  | 'noBook'
  | 'inFuture';

export type Problems = Partial<Record<'duration' | 'distance' | 'minutes' | 'count' | 'pages' | 'book' | 'when', Problem>>;

export type ReadingContext = { book: Pick<BookOut, 'id' | 'total_pages'> | undefined; previousEnd: number };

/** The moment chosen in the form, read in the device's own time zone. */
export function startedAt(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

function minutesProblem(text: string, required: boolean): Problem | undefined {
  const minutes = wholeNumber(text);
  if (minutes === null) {
    return required ? 'required' : undefined;
  }
  if (minutes === undefined) {
    return 'invalid';
  }
  if (minutes < LIMITS.minutes.min) {
    return 'tooShort';
  }
  return minutes > LIMITS.minutes.max ? 'tooLong' : undefined;
}

/** What keeps the form from being saved, per field; empty when it can be saved. */
export function problemsOf(kind: QuickKind, form: QuickForm, unit: DistanceUnit, reading: ReadingContext | null, now: Date): Problems {
  const problems: Problems = {};
  if (startedAt(form.date, form.time).getTime() > now.getTime()) {
    problems.when = 'inFuture';
  }
  if (kind === 'cardio') {
    const duration = parseDuration(form.durationText);
    if (duration === null) {
      problems.duration = 'required';
    } else if (duration === undefined) {
      problems.duration = 'invalid';
    } else if (duration < LIMITS.durationS.min) {
      problems.duration = 'tooShort';
    } else if (duration > LIMITS.durationS.max) {
      problems.duration = 'tooLong';
    }
    const metres = parseDistance(form.distanceText, unit);
    if (metres === undefined) {
      problems.distance = 'invalid';
    } else if (metres !== null && metres < 1) {
      problems.distance = 'tooShort';
    } else if (metres !== null && metres > LIMITS.distanceKm * 1000) {
      problems.distance = 'tooFar';
    }
  }
  if (kind === 'duration' || kind === 'reading') {
    const problem = minutesProblem(form.minutesText, kind === 'duration');
    if (problem) {
      problems.minutes = problem;
    }
  }
  if (kind === 'counter' && (form.count < LIMITS.count.min || form.count > LIMITS.count.max)) {
    problems.count = 'invalid';
  }
  if (kind === 'reading') {
    if (!reading?.book) {
      problems.book = 'noBook';
    } else {
      const endPage = wholeNumber(form.endPageText);
      if (endPage === null) {
        problems.pages = 'required';
      } else if (endPage === undefined) {
        problems.pages = 'invalid';
      } else if (endPage <= reading.previousEnd) {
        problems.pages = 'pagesTooFew';
      } else if (endPage > reading.book.total_pages) {
        problems.pages = 'pastLastPage';
      }
    }
  }
  return problems;
}

/**
 * The session to save; call only when `problemsOf` found nothing. `at` is the exact moment when
 * the person left the time as "now", so two logs of the same minute keep their order.
 */
export function toSession(
  kind: QuickKind,
  trackerId: string,
  form: QuickForm,
  unit: DistanceUnit,
  bookId: string | undefined,
  at?: Date,
): SessionWrite {
  const body: SessionWrite = {
    tracker_id: trackerId,
    started_at: (at ?? startedAt(form.date, form.time)).toISOString(),
    local_date: form.date,
    note: form.note.trim() || null,
  };
  if (kind === 'cardio') {
    const metres = parseDistance(form.distanceText, unit);
    return { ...body, duration_s: parseDuration(form.durationText) ?? 0, cardio: { distance_m: metres ?? null } };
  }
  if (kind === 'reading') {
    const minutes = wholeNumber(form.minutesText);
    return {
      ...body,
      duration_s: minutes ? minutes * 60 : null,
      reading: { book_id: bookId ?? '', end_page: Number(form.endPageText) },
    };
  }
  if (kind === 'duration') {
    return { ...body, duration_s: Number(form.minutesText) * 60 };
  }
  return { ...body, general: { count: form.count } };
}

/**
 * The form filled from the tracker's last session (spec §4 "prefill"): the same duration,
 * distance, minutes or count; for reading the same number of pages after the book's current
 * page, never past its last page. The note starts empty, the date and time are now.
 */
export function prefill(
  kind: QuickKind,
  last: Pick<SessionOut, 'duration_s' | 'cardio' | 'general' | 'stats'> | undefined,
  unit: DistanceUnit,
  reading: { previousEnd: number; totalPages: number } | null,
  date: string,
  time: string,
): QuickForm {
  const form: QuickForm = {
    durationText: '',
    distanceText: '',
    minutesText: '',
    count: 1,
    pagesReadText: '',
    endPageText: '',
    note: '',
    date,
    time,
  };
  const minutes = last?.duration_s ? String(Math.max(1, Math.round(last.duration_s / 60))) : '';
  if (kind === 'cardio' && last) {
    form.durationText = last.duration_s ? formatDuration(last.duration_s) : '';
    form.distanceText = last.cardio?.distance_m ? distanceText(last.cardio.distance_m, unit) : '';
  }
  if (kind === 'duration' || kind === 'reading') {
    form.minutesText = minutes;
  }
  if (kind === 'counter') {
    form.count = last?.general?.count ?? 1;
  }
  if (kind === 'reading' && reading) {
    const left = reading.totalPages - reading.previousEnd;
    const pages = Math.min(left, last?.stats.pages_read ?? 0);
    if (pages > 0) {
      form.pagesReadText = String(pages);
      form.endPageText = String(endPageFor(reading.previousEnd, pages));
    }
  }
  return form;
}

/**
 * The goal beside the form: the tracker's amount goal (today's before the week's), else its
 * frequency goal. Cumulative goals stay on the Goals page.
 */
export function sideGoal(goals: GoalOut[], trackerId: string): GoalOut | undefined {
  const own = goals.filter((goal) => goal.tracker_id === trackerId && goal.kind !== 'cumulative');
  const rank = (goal: GoalOut) => (goal.kind === 'amount' ? (goal.period === 'day' ? 0 : 1) : 2) - (goal.is_pinned ? 0.5 : 0);
  return [...own].sort((a, b) => rank(a) - rank(b))[0];
}

/** Books to log pages for: the ones still being read, in the order of the list. */
export function openBooks(books: BookOut[]): BookOut[] {
  return books.filter((book) => book.finished_date === null && book.current_page < book.total_pages);
}
