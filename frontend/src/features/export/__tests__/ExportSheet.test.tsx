import { fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError } from '@/shared/api/fetcher';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import i18n from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';

import { fetchCsvExport, fetchJsonExport } from '../exportFiles';
import { ExportSheet } from '../ExportSheet';
import { saveFile, SharingUnavailableError } from '../saveFile';

jest.mock('@/shared/api/generated/endpoints/trackers/trackers', () => ({ useListTrackers: jest.fn() }));
jest.mock('../exportFiles', () => ({ fetchJsonExport: jest.fn(), fetchCsvExport: jest.fn() }));
jest.mock('../saveFile', () => {
  class SharingUnavailableError extends Error {}
  return { saveFile: jest.fn(), SharingUnavailableError };
});
jest.mock('expo-router', () => ({ Link: ({ children }: { children: unknown }) => children }));

const trackers = useListTrackers as jest.Mock;
const GYM = { id: 'gym', name: 'Gym', type: 'strength', color: 'strength' };
const BOOKS = { id: 'books', name: 'Книги', type: 'reading', color: 'reading' };
const JSON_FILE = { name: 'ember-export.json', text: '{}', mimeType: 'application/json', uti: 'public.json' };
const CSV_FILE = { name: 'ember-Книги.csv', text: '﻿a', mimeType: 'text/csv', uti: 'public.comma-separated-values-text' };

function listed(items: unknown[]) {
  trackers.mockReturnValue({ isPending: false, isError: false, data: { status: 200, data: { items } }, refetch: jest.fn() });
}

async function open() {
  await render(
    <ThemeProvider>
      <ExportSheet onClose={jest.fn()} />
    </ThemeProvider>,
  );
}

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

beforeEach(() => {
  jest.clearAllMocks();
  listed([GYM, BOOKS]);
  (fetchJsonExport as jest.Mock).mockResolvedValue(JSON_FILE);
  (fetchCsvExport as jest.Mock).mockResolvedValue(CSV_FILE);
  (saveFile as jest.Mock).mockResolvedValue(undefined);
});

describe('ExportSheet', () => {
  it('asks for archived trackers too, since their data is still worth keeping', async () => {
    await open();

    expect(trackers).toHaveBeenCalledWith({ include_archived: true });
    expect(screen.getByText('Gym')).toBeTruthy();
    expect(screen.getByText('Книги')).toBeTruthy();
  });

  it('exports everything as JSON', async () => {
    await open();

    await fireEvent.press(screen.getByRole('button', { name: /^Everything/ }));

    expect(fetchJsonExport).toHaveBeenCalled();
    expect(saveFile).toHaveBeenCalledWith(JSON_FILE, 'Export your data');
  });

  it('exports one tracker as CSV', async () => {
    await open();

    await fireEvent.press(screen.getByRole('button', { name: /^Книги/ }));

    expect(fetchCsvExport).toHaveBeenCalledWith('books');
    expect(saveFile).toHaveBeenCalledWith(CSV_FILE, 'Export your data');
  });

  it('says why an export failed', async () => {
    (fetchCsvExport as jest.Mock).mockRejectedValue(
      new ApiError({ type: 'about:blank', title: 'x', status: 0, code: 'network_error' }),
    );
    await open();

    await fireEvent.press(screen.getByRole('button', { name: /^Gym/ }));

    expect(await screen.findByText('Can’t reach the server. Check your connection and try again.')).toBeTruthy();
  });

  it('says when the phone cannot share files', async () => {
    (saveFile as jest.Mock).mockRejectedValue(new SharingUnavailableError());
    await open();

    await fireEvent.press(screen.getByRole('button', { name: /^Everything/ }));

    expect(await screen.findByText('This device can’t share files.')).toBeTruthy();
  });

  it('explains an empty list', async () => {
    listed([]);
    await open();

    expect(screen.getByText('No trackers yet. Add one, and it can be exported here.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Everything/ })).toBeTruthy();
  });

  it('offers a retry when the trackers cannot be loaded', async () => {
    const refetch = jest.fn();
    trackers.mockReturnValue({ isPending: false, isError: true, data: undefined, refetch });
    await open();

    await fireEvent.press(screen.getByText('Try again'));

    expect(screen.getByText('Couldn’t load your trackers.')).toBeTruthy();
    expect(refetch).toHaveBeenCalled();
  });

  it('shows the loading state while trackers load', async () => {
    trackers.mockReturnValue({ isPending: true, isError: false, data: undefined, refetch: jest.fn() });
    await open();

    expect(screen.getByLabelText('Loading your trackers')).toBeTruthy();
  });
});
