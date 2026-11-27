import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type ViewStyle } from 'react-native';

import { itemKey, removeItem } from '@/features/outbox/outbox';
import type { BookOut, BookWrite } from '@/shared/api/generated/model';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { showFocusRing } from '@/shared/ui/focusRing';
import { Check, Pencil } from '@/shared/ui/icons';
import { IconButton } from '@/shared/ui/IconButton';
import { Notice } from '@/shared/ui/Notice';
import { Sheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { TextField } from '@/shared/ui/TextField';

import { saveBook, waitingBook } from '../data';
import { LIMITS } from '../rules';

type PickerProps = {
  books: BookOut[];
  selected: string | undefined;
  onPick: (book: BookOut) => void;
  onAdd: () => void;
  onEdit: (book: BookOut) => void;
  onClose: () => void;
};

function BookRow({ book, selected, disabled, onPress, onEdit }: { book: BookOut; selected: boolean; disabled: boolean; onPress: () => void; onEdit: () => void }) {
  const { t } = useTranslation();
  const { colors, radius, space } = useTheme();
  const detail = disabled
    ? t('books.finished')
    : t('books.pages', { current: book.current_page, total: book.total_pages });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
      <Pressable
        role="radio"
        aria-checked={selected}
        aria-disabled={disabled}
        aria-label={`${book.title}, ${detail}`}
        onPress={disabled ? undefined : onPress}
        style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[16],
          minHeight: 56,
          paddingHorizontal: space[8],
          borderRadius: radius[12],
          backgroundColor: selected ? colors.accent.subtle : hovered && !disabled ? colors.bg.surfaceRaised : 'transparent',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'auto' : 'pointer',
          outlineStyle: 'solid',
          outlineWidth: showFocusRing(focused) ? 2 : 0,
          outlineColor: colors.accent.fill,
        })}
      >
        <View style={{ flex: 1, paddingVertical: space[8] }}>
          <Text variant="smallMedium" numberOfLines={1}>
            {book.title}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {book.author ? `${book.author} · ${detail}` : detail}
          </Text>
        </View>
        {selected ? <Check color={colors.accent.text} size={18} strokeWidth={2} /> : null}
      </Pressable>
      <IconButton icon={Pencil} label={t('books.edit', { title: book.title })} onPress={onEdit} />
    </View>
  );
}

/**
 * "Choose a book" (built from existing parts, owner's choice 2026-11-27): the books being read
 * first, then the finished ones, which take no more pages; each can be edited; "Add a book" below.
 */
export function BookPicker({ books, selected, onPick, onAdd, onEdit, onClose }: PickerProps) {
  const { t } = useTranslation();
  const open = books.filter((book) => book.finished_date === null && book.current_page < book.total_pages);
  const finished = books.filter((book) => !open.includes(book));
  return (
    <Sheet visible title={t('books.pickTitle')} onClose={onClose}>
      <View role="radiogroup" aria-label={t('books.pickTitle')}>
        {[...open, ...finished].map((book) => (
          <BookRow
            key={book.id}
            book={book}
            selected={book.id === selected}
            disabled={!open.includes(book)}
            onPress={() => onPick(book)}
            onEdit={() => onEdit(book)}
          />
        ))}
      </View>
      {books.length === 0 ? (
        <Text variant="small" tone="muted">
          {t('books.none')}
        </Text>
      ) : null}
      <Button label={t('books.add')} variant="secondary" onPress={onAdd} />
    </Sheet>
  );
}

type FormProps = { userId: string; book?: BookOut; onSaved: (book: BookOut) => void; onClose: () => void };

/** Errors of the book form: a title, pages within the limits, the start before the end. */
export function bookProblems(form: { title: string; author: string; total: string; start: string }, currentPage: number | undefined) {
  const problems: Partial<Record<'title' | 'author' | 'total' | 'start', string>> = {};
  const title = form.title.trim();
  if (!title) {
    problems.title = 'books.problems.title';
  } else if (title.length > 200) {
    problems.title = 'books.problems.titleLong';
  }
  if (form.author.trim().length > 120) {
    problems.author = 'books.problems.authorLong';
  }
  const total = /^\d+$/.test(form.total.trim()) ? Number(form.total) : NaN;
  const start = form.start.trim() === '' ? 0 : /^\d+$/.test(form.start.trim()) ? Number(form.start) : NaN;
  if (!(total >= 1 && total <= LIMITS.pages)) {
    problems.total = 'books.problems.total';
  } else if (currentPage !== undefined && total < currentPage) {
    problems.total = 'books.problems.totalBelowCurrent';
  }
  if (!(start >= 0) || (total >= 1 && start >= total)) {
    problems.start = 'books.problems.start';
  }
  return { problems, body: { title, author: form.author.trim() || null, total_pages: total, start_page: start } satisfies BookWrite };
}

/**
 * "Add a book" and "Edit book": title, author, total pages and the page to start from. Saved
 * under an ID from the device, through the outbox, so it works offline too.
 */
export function BookForm({ userId, book, onSaved, onClose }: FormProps) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [form, setForm] = useState({
    title: book?.title ?? '',
    author: book?.author ?? '',
    total: book ? String(book.total_pages) : '',
    start: book ? String(book.start_page) : '',
  });
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = book !== undefined;
  const { problems, body } = bookProblems(form, editing && book.current_page > book.start_page ? book.current_page : undefined);
  const shown = (key: keyof typeof problems) => (tried && problems[key] ? t(problems[key]!, { page: book?.current_page }) : undefined);

  const save = async () => {
    setTried(true);
    setError(null);
    if (Object.keys(problems).length > 0) {
      return;
    }
    const result = await saveBook(client, userId, body, book?.id);
    if (result.status === 'refused') {
      await removeItem(itemKey({ kind: 'book', id: result.id }));
      setError(t('books.failed'));
      return;
    }
    if (result.status === 'saved') {
      onSaved(result.data);
      return;
    }
    const waiting = waitingBook(result.id, body, new Date().toISOString());
    const current = Math.max(book?.current_page ?? 0, body.start_page);
    onSaved({
      ...waiting,
      current_page: current,
      progress_percent: Math.floor((current / body.total_pages) * 100 + 0.5),
      finished_date: book?.finished_date ?? null,
      created_at: book?.created_at ?? waiting.created_at,
    });
  };

  return (
    <Sheet visible title={t(editing ? 'books.editTitle' : 'books.addTitle')} onClose={onClose}>
      <TextField
        label={t('books.title')}
        value={form.title}
        onChangeText={(title) => setForm({ ...form, title })}
        maxLength={200}
        autoFocus={!editing}
        error={shown('title')}
      />
      <TextField label={t('books.author')} value={form.author} onChangeText={(author) => setForm({ ...form, author })} maxLength={120} error={shown('author')} />
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('books.totalPages')}
            value={form.total}
            onChangeText={(total) => setForm({ ...form, total })}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={5}
            error={shown('total')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('books.startPage')}
            value={form.start}
            placeholder="0"
            onChangeText={(start) => setForm({ ...form, start })}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={5}
            error={shown('start')}
          />
        </View>
      </View>
      {error ? <Notice tone="error" title={error} /> : null}
      <Button label={t('books.save')} onPress={save} />
      <Button label={t('books.cancel')} variant="secondary" onPress={onClose} />
    </Sheet>
  );
}
