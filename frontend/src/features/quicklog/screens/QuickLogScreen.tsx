import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';

import { useAccountId } from '@/features/auth/account';
import { deliverSession, removeItem, sessionKey } from '@/features/outbox/outbox';
import { usePreferences } from '@/features/settings/preferences';
import { useListGoals } from '@/shared/api/generated/endpoints/goals/goals';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { BookOut, GoalOut, SessionOut, TrackerSummary } from '@/shared/api/generated/model';
import { toIsoDate } from '@/shared/format/dates';
import { dateToTime } from '@/shared/format/time';
import { useNow } from '@/shared/hooks/useNow';
import { newId } from '@/shared/ids';
import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { controlHeight } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Columns } from '@/shared/ui/Columns';
import { showFocusRing } from '@/shared/ui/focusRing';
import { ChevronDown, X } from '@/shared/ui/icons';
import { IconButton } from '@/shared/ui/IconButton';
import { Notice } from '@/shared/ui/Notice';
import { Screen } from '@/shared/ui/Screen';
import { SelectField } from '@/shared/ui/SelectField';
import { ErrorCard, SkeletonCard } from '@/shared/ui/StateCards';
import { Stepper } from '@/shared/ui/Stepper';
import { Text } from '@/shared/ui/Text';
import { TextField } from '@/shared/ui/TextField';
import { TextLink } from '@/shared/ui/TextLink';
import { showToast } from '@/shared/ui/Toast';

import { BookForm, BookPicker } from '../components/BookSheets';
import { BookCard, GoalSideCard, QuickWinsCard } from '../components/SideCards';
import { WhenField } from '../components/WhenField';
import { moveBookTo, rememberSaved, useBooks, useLastSession } from '../data';
import {
  endPageFor,
  formatDuration,
  kindOf,
  LIMITS,
  openBooks,
  paceSeconds,
  pagesReadFor,
  parseDistance,
  parseDuration,
  prefill,
  type Problems,
  problemsOf,
  type QuickForm,
  type QuickKind,
  sideGoal,
  toSession,
} from '../rules';

const NOTE_MAX = 500;

function close() {
  router.dismissTo('/');
}

/**
 * A quick log (design: Quick log / Cardio, Reading, General duration, General counter): the form
 * of the tracker's type, prefilled from its last session, saved in one tap, then back to Home
 * with "Saved". Offline the session waits in the outbox. The tracker comes from the route.
 */
export function QuickLogScreen() {
  const { t, i18n } = useTranslation();
  const { tracker: trackerId } = useLocalSearchParams<{ tracker: string }>();
  const trackers = useListTrackers({ include_archived: true });
  const goals = useListGoals();
  const accountId = useAccountId();
  const books = useBooks();
  const items = trackers.data?.status === 200 ? trackers.data.data.items : undefined;
  const tracker = items?.find((item) => item.id === trackerId && !item.archived);
  const kind = tracker ? kindOf(tracker) : null;
  const last = useLastSession(tracker && kind ? tracker.id : undefined);
  const now = useNow(60_000);
  const caption = t('quickLog.caption', {
    date: new Intl.DateTimeFormat(i18n.language, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(now)),
  });
  let title = t('quickLog.title.default');
  if (tracker && kind) {
    title = kind === 'cardio' || kind === 'reading' ? t(`quickLog.title.${kind}`) : t('quickLog.title.general', { name: tracker.name });
  }

  let body;
  if (trackers.isPending) {
    body = <SkeletonCard label={t('quickLog.loading')} rows={3} />;
  } else if (!items) {
    body = <ErrorCard title={t('quickLog.loadErrorTitle')} message={t('quickLog.loadError')} retryLabel={t('home.retry')} onRetry={() => trackers.refetch()} />;
  } else if (!tracker || !kind) {
    body = (
      <Card style={{ gap: 16 }}>
        <Text variant="small" tone="muted">
          {t(tracker ? 'quickLog.notQuick' : 'quickLog.missing')}
        </Text>
        <Button label={t('quickLog.back')} variant="secondary" onPress={close} />
      </Card>
    );
  } else if (!last.ready || (kind === 'reading' && books.items === undefined && !books.query.isError)) {
    body = <SkeletonCard label={t('quickLog.loading')} rows={3} />;
  } else {
    body = (
      <QuickLogForm
        key={tracker.id}
        tracker={tracker}
        kind={kind}
        trackers={items.filter((item) => !item.archived && kindOf(item) !== null && kindOf(item) !== 'reading')}
        goals={goals.data?.status === 200 ? goals.data.data.items : []}
        books={books.items ?? []}
        last={last.last}
        accountId={accountId}
      />
    );
  }

  return (
    <Screen title={title} caption={caption} action={<IconButton icon={X} label={t('quickLog.close')} onPress={close} />}>
      {body}
    </Screen>
  );
}

type FormProps = {
  tracker: TrackerSummary;
  kind: QuickKind;
  trackers: TrackerSummary[];
  goals: GoalOut[];
  books: BookOut[];
  last: SessionOut | undefined;
  accountId: string | undefined;
};

function BookField({ book, onOpen }: { book: BookOut | undefined; onOpen: () => void }) {
  const { t } = useTranslation();
  const { colors, radius, space, typography } = useTheme();
  return (
    <View style={{ gap: space[8] }}>
      <Text variant="smallMedium">{t('quickLog.book')}</Text>
      <Pressable
        role="button"
        aria-label={`${t('quickLog.book')}: ${book?.title ?? ''}`}
        onPress={onOpen}
        style={({ focused }: { pressed: boolean; focused?: boolean }): ViewStyle => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[8],
          minHeight: controlHeight.regular,
          paddingHorizontal: space[16],
          borderRadius: radius[12],
          borderWidth: 1,
          borderColor: colors.border.default,
          backgroundColor: colors.bg.surfaceRaised,
          cursor: 'pointer',
          outlineStyle: 'solid',
          outlineWidth: showFocusRing(focused) ? 2 : 0,
          outlineColor: colors.accent.fill,
        })}
      >
        <Text numberOfLines={1} style={{ flex: 1, fontSize: typography.body.fontSize }}>
          {book?.title ?? ''}
        </Text>
        <ChevronDown color={colors.text.muted} size={20} strokeWidth={1.75} />
      </Pressable>
    </View>
  );
}

function QuickLogForm({ tracker, kind, trackers, goals, books: serverBooks, last, accountId }: FormProps) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const client = useQueryClient();
  const wide = useBreakpoint() !== 'compact';
  const unit = usePreferences((state) => state.values.distance_unit);
  const now = useNow(30_000);
  const [added, setAdded] = useState<BookOut[]>([]);
  const books = [...added.filter((book) => !serverBooks.some((other) => other.id === book.id)), ...serverBooks].map(
    (book) => added.find((other) => other.id === book.id) ?? book,
  );
  const [bookId, setBookId] = useState<string | undefined>(() => {
    const open = openBooks(serverBooks);
    const lastBook = open.find((book) => book.id === last?.reading?.book_id);
    return (lastBook ?? open[0])?.id;
  });
  const book = books.find((item) => item.id === bookId);
  const previousEnd = book?.current_page ?? 0;
  const [form, setForm] = useState<QuickForm>(() => {
    const started = new Date();
    return prefill(
      kind,
      last,
      unit,
      book ? { previousEnd: book.current_page, totalPages: book.total_pages } : null,
      toIsoDate(started),
      dateToTime(started),
    );
  });
  const [whenChosen, setWhenChosen] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<BookOut | 'new' | null>(null);
  const reading = kind === 'reading' ? { book, previousEnd } : null;
  const at = (moment: Date): QuickForm => (whenChosen ? form : { ...form, date: toIsoDate(moment), time: dateToTime(moment) });
  const shown = at(new Date(now));
  const problems: Problems = problemsOf(kind, shown, unit, reading, new Date(now));
  const problem = (field: keyof Problems) => {
    const found = problems[field];
    return tried && found ? t(`quickLog.problems.${field}.${found}`, { page: previousEnd, pages: book?.total_pages }) : undefined;
  };
  const set = (changes: Partial<QuickForm>) => setForm((current) => ({ ...current, ...changes }));

  const setPagesRead = (text: string) => {
    const pages = /^\d+$/.test(text.trim()) ? Number(text) : null;
    set({ pagesReadText: text, ...(pages !== null ? { endPageText: String(endPageFor(previousEnd, pages)) } : null) });
  };
  const setEndPage = (text: string) => {
    const end = /^\d+$/.test(text.trim()) ? Number(text) : null;
    const pages = end === null ? null : pagesReadFor(previousEnd, end);
    set({ endPageText: text, ...(pages !== null && pages > 0 ? { pagesReadText: String(pages) } : null) });
  };
  const chooseBook = (next: BookOut) => {
    setBookId(next.id);
    setPicking(false);
    const pages = /^\d+$/.test(form.pagesReadText.trim()) ? Number(form.pagesReadText) : 0;
    const end = Math.min(next.total_pages, next.current_page + pages);
    set({ endPageText: end > next.current_page ? String(end) : '', pagesReadText: end > next.current_page ? String(end - next.current_page) : '' });
  };

  const save = async () => {
    setTried(true);
    setError(null);
    const moment = new Date();
    const current = at(moment);
    if (!accountId || Object.keys(problemsOf(kind, current, unit, reading, moment)).length > 0) {
      return;
    }
    const id = newId();
    const body = toSession(kind, tracker.id, current, unit, book?.id, whenChosen ? undefined : moment);
    const result = await deliverSession(id, accountId, body);
    if (result.status === 'refused') {
      await removeItem(sessionKey(id));
      setError(t(`quickLog.failed.${result.code === 'tracker_gone' || result.code === 'book_gone' ? result.code : 'refused'}`));
      return;
    }
    moveBookTo(client, body);
    if (result.status === 'saved') {
      void rememberSaved(client, result.data.session);
    }
    showToast(t(result.status === 'saved' ? `quickLog.saved.${kind}` : 'quickLog.savedOffline'));
    close();
  };

  const duration = parseDuration(form.durationText);
  const metres = parseDistance(form.distanceText, unit);
  const pace = duration && metres ? paceSeconds(duration, metres, unit) : null;
  const goal = kind === 'reading' ? undefined : sideGoal(goals, tracker.id);
  const counterUnit = tracker.counter_unit ?? t('quickLog.countUnit');

  const fields = (
    <Card style={{ gap: space[24], padding: wide ? space[32] : space[16] }}>
      {kind === 'reading' ? (
        <View style={{ gap: space[8] }}>
          {book ? (
            <>
              <BookField book={book} onOpen={() => setPicking(true)} />
              <TextLink
                prefix={book.author ? `${book.author} ·` : undefined}
                label={t('quickLog.changeBook')}
                onPress={() => setPicking(true)}
                align="start"
              />
            </>
          ) : (
            <>
              <Text variant="smallMedium">{t('quickLog.book')}</Text>
              <Text variant="small" tone="muted">
                {t('books.none')}
              </Text>
              <Button label={t('books.add')} variant="secondary" onPress={() => setEditing('new')} />
              {problem('book') ? (
                <Text variant="caption" tone="error">
                  {problem('book')}
                </Text>
              ) : null}
            </>
          )}
        </View>
      ) : trackers.length > 1 ? (
        <SelectField
          label={t('quickLog.tracker')}
          value={tracker.id}
          onChange={(next) => router.setParams({ tracker: next })}
          options={trackers.map((item) => ({ value: item.id, label: item.name }))}
        />
      ) : null}

      {kind === 'cardio' ? (
        <View style={{ gap: space[8] }}>
          <View style={{ flexDirection: 'row', gap: space[16] }}>
            <View style={{ flex: 1 }}>
              <TextField
                label={t('quickLog.duration')}
                value={form.durationText}
                placeholder="32:00"
                onChangeText={(durationText) => set({ durationText })}
                onBlur={() => {
                  const seconds = parseDuration(form.durationText);
                  if (seconds) {
                    set({ durationText: formatDuration(seconds) });
                  }
                }}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'decimal-pad'}
                maxLength={9}
                error={problem('duration')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label={t('quickLog.distance', { unit: t(`goals.units.${unit}`) })}
                value={form.distanceText}
                onChangeText={(distanceText) => set({ distanceText })}
                keyboardType="decimal-pad"
                inputMode="decimal"
                maxLength={7}
                hint={t('quickLog.optional')}
                error={problem('distance')}
              />
            </View>
          </View>
          {pace ? (
            <Text variant="small" tone="muted">
              {t('quickLog.pace', { pace: formatDuration(pace), unit: t(`goals.units.${unit}`) })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {kind === 'reading' && book ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[16] }}>
            <View style={{ flex: 1 }}>
              <TextField
                label={t('quickLog.pagesRead')}
                value={form.pagesReadText}
                onChangeText={setPagesRead}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={5}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label={t('quickLog.minutesOptional')}
                value={form.minutesText}
                onChangeText={(minutesText) => set({ minutesText })}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={4}
                error={problem('minutes')}
              />
            </View>
          </View>
          <TextField
            label={t('quickLog.currentPage')}
            value={form.endPageText}
            onChangeText={setEndPage}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={5}
            hint={t(previousEnd === book.start_page ? 'quickLog.startsAt' : 'quickLog.lastEnded', { page: previousEnd })}
            error={problem('pages')}
          />
        </>
      ) : null}

      {kind === 'duration' ? (
        <TextField
          label={t('quickLog.minutes')}
          value={form.minutesText}
          onChangeText={(minutesText) => set({ minutesText })}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={4}
          error={problem('minutes')}
        />
      ) : null}

      {kind === 'counter' ? (
        <Stepper
          value={form.count}
          unit={tracker.counter_unit_note ? `${counterUnit} · ${tracker.counter_unit_note}` : counterUnit}
          canDecrease={form.count > LIMITS.count.min}
          canIncrease={form.count < LIMITS.count.max}
          decreaseLabel={t('quickLog.less', { unit: counterUnit })}
          increaseLabel={t('quickLog.more', { unit: counterUnit })}
          onChange={(direction) => set({ count: form.count + direction })}
        />
      ) : null}

      {kind !== 'reading' ? (
        <TextField
          label={t('quickLog.note')}
          value={form.note}
          placeholder={t(`quickLog.notePlaceholder.${kind}`)}
          onChangeText={(note) => set({ note })}
          maxLength={NOTE_MAX}
        />
      ) : null}

      <WhenField
        date={shown.date}
        time={shown.time}
        error={problem('when')}
        onChange={(date, time) => {
          setWhenChosen(true);
          set({ date, time });
        }}
      />
      {error ? <Notice tone="error" title={error} /> : null}
      <Button label={t(`quickLog.save.${kind}`)} onPress={save} disabled={kind === 'reading' && !book} />
    </Card>
  );

  const side = (
    <>
      {kind === 'reading' && book ? <BookCard book={book} /> : null}
      {goal ? <GoalSideCard goal={goal} tracker={tracker} kind={kind} /> : null}
      {wide ? <QuickWinsCard /> : null}
    </>
  );

  return (
    <>
      <Columns main={fields} side={side} />
      {picking ? (
        <BookPicker
          books={books}
          selected={bookId}
          onPick={chooseBook}
          onAdd={() => {
            setPicking(false);
            setEditing('new');
          }}
          onEdit={(item) => {
            setPicking(false);
            setEditing(item);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
      {editing && accountId ? (
        <BookForm
          userId={accountId}
          book={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            setAdded((list) => [saved, ...list.filter((item) => item.id !== saved.id)]);
            if (saved.current_page < saved.total_pages) {
              chooseBook(saved);
            }
          }}
        />
      ) : null}
    </>
  );
}
