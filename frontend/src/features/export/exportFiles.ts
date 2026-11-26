import { exportJson } from '@/shared/api/generated/endpoints/me/me';
import { exportCsv } from '@/shared/api/generated/endpoints/trackers/trackers';

import { fileNameFrom } from './fileName';

/** A file ready to be saved or shared: its name, its text and how to tell apps what it is. */
export type ExportFile = { name: string; text: string; mimeType: string; uti: string };

const BOM = '﻿';

/** Everything the account owns, as the API's JSON, indented so it stays readable. */
export async function fetchJsonExport(): Promise<ExportFile> {
  const response = await exportJson();
  return {
    name: fileNameFrom(response.headers.get('content-disposition'), 'ember-export.json'),
    text: JSON.stringify(response.data, null, 2),
    mimeType: 'application/json',
    uti: 'public.json',
  };
}

/**
 * One tracker as CSV. Reading the body as text drops the byte order mark the server sends,
 * and without it Excel shows Polish and Ukrainian letters as garbage, so it is put back.
 */
export async function fetchCsvExport(trackerId: string): Promise<ExportFile> {
  const response = await exportCsv(trackerId);
  const text = String(response.data ?? '');
  return {
    name: fileNameFrom(response.headers.get('content-disposition'), 'ember-tracker.csv'),
    text: text.startsWith(BOM) ? text : BOM + text,
    mimeType: 'text/csv',
    uti: 'public.comma-separated-values-text',
  };
}
