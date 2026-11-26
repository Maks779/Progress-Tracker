import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { exportJson } from '@/shared/api/generated/endpoints/me/me';
import { exportCsv } from '@/shared/api/generated/endpoints/trackers/trackers';

import { fetchCsvExport, fetchJsonExport } from '../exportFiles';
import { fileNameFrom } from '../fileName';
import { saveFile, SharingUnavailableError } from '../saveFile';

jest.mock('@/shared/api/generated/endpoints/me/me', () => ({ exportJson: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/trackers/trackers', () => ({ exportCsv: jest.fn() }));

const written: { name: string; text: string }[] = [];

jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache' },
  File: jest.fn().mockImplementation((_directory: string, name: string) => ({
    uri: `file:///cache/${name}`,
    create: jest.fn(),
    write: jest.fn(async (text: string) => {
      written.push({ name, text });
    }),
  })),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

function headers(disposition?: string) {
  return new Headers(disposition ? { 'content-disposition': disposition } : {});
}

beforeEach(() => {
  jest.clearAllMocks();
  written.length = 0;
});

describe('fileNameFrom', () => {
  it('prefers the UTF-8 name, so non-Latin names survive', () => {
    expect(
      fileNameFrom(`attachment; filename="ember-tracker.csv"; filename*=UTF-8''ember-%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8.csv`, 'x.csv'),
    ).toBe('ember-Книги.csv');
  });

  it('falls back to the plain name and then to the default', () => {
    expect(fileNameFrom('attachment; filename="ember-gym.csv"', 'x.csv')).toBe('ember-gym.csv');
    expect(fileNameFrom(null, 'ember-export.json')).toBe('ember-export.json');
    expect(fileNameFrom('attachment', 'ember-export.json')).toBe('ember-export.json');
  });

  it('never lets a name point to another folder', () => {
    expect(fileNameFrom(`attachment; filename*=UTF-8''..%2F..%2Fsecrets.csv`, 'x.csv')).toBe('..-..-secrets.csv');
    expect(fileNameFrom('attachment; filename="a\\b.csv"', 'x.csv')).toBe('a-b.csv');
  });

  it('ignores a broken percent-encoding', () => {
    expect(fileNameFrom(`attachment; filename="plain.csv"; filename*=UTF-8''%E0%A4%A.csv`, 'x.csv')).toBe('plain.csv');
  });
});

describe('export files', () => {
  it('builds the JSON file from the API answer, indented', async () => {
    (exportJson as jest.Mock).mockResolvedValue({
      status: 200,
      data: { trackers: [{ name: 'Gym' }] },
      headers: headers('attachment; filename="ember-export.json"'),
    });

    const file = await fetchJsonExport();

    expect(file).toMatchObject({ name: 'ember-export.json', mimeType: 'application/json', uti: 'public.json' });
    expect(JSON.parse(file.text)).toEqual({ trackers: [{ name: 'Gym' }] });
    expect(file.text).toContain('\n  "trackers"');
  });

  it('puts the byte order mark back into a CSV, so Excel reads Polish and Ukrainian letters', async () => {
    (exportCsv as jest.Mock).mockResolvedValue({
      status: 200,
      data: '"session_id","note"\n"1","Książki"\n',
      headers: headers(`attachment; filename="ember-ksiazki.csv"; filename*=UTF-8''ember-Ksi%C4%85%C5%BCki.csv`),
    });

    const file = await fetchCsvExport('tracker-1');

    expect(exportCsv).toHaveBeenCalledWith('tracker-1');
    expect(file.name).toBe('ember-Książki.csv');
    expect(file.text.startsWith('﻿"session_id"')).toBe(true);
  });

  it('does not add a second byte order mark', async () => {
    (exportCsv as jest.Mock).mockResolvedValue({ status: 200, data: '﻿a,b\n', headers: headers() });

    const file = await fetchCsvExport('tracker-1');

    expect(file.text).toBe('﻿a,b\n');
    expect(file.name).toBe('ember-tracker.csv');
  });
});

describe('saveFile on a phone', () => {
  const file = { name: 'ember-Книги.csv', text: '﻿a,b\n', mimeType: 'text/csv', uti: 'public.comma-separated-values-text' };

  it('writes the file to the cache and opens the share sheet', async () => {
    await saveFile(file, 'Export your data');

    expect(File).toHaveBeenCalledWith('file:///cache', 'ember-Книги.csv');
    expect(written).toEqual([{ name: 'ember-Книги.csv', text: '﻿a,b\n' }]);
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/ember-Книги.csv', {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
      dialogTitle: 'Export your data',
    });
  });

  it('says so when the device cannot share', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);

    await expect(saveFile(file, 'Export')).rejects.toBeInstanceOf(SharingUnavailableError);
    expect(written).toEqual([]);
  });
});
