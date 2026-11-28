import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { ExportFile } from './exportFiles';

export class SharingUnavailableError extends Error {}

/**
 * On phones the file is written to the app's cache and handed to the system share sheet,
 * where the user saves it, sends it or opens it in a spreadsheet app. The cache is private
 * to the app and the system clears it when space runs low.
 */
export async function saveFile(file: ExportFile, dialogTitle: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new SharingUnavailableError();
  }
  const target = new File(Paths.cache, file.name);
  target.create({ overwrite: true });
  await target.write(file.text);
  await Sharing.shareAsync(target.uri, { mimeType: file.mimeType, UTI: file.uti, dialogTitle });
}

const EXPORT_FILE = /^ember-.*\.(json|csv)$/;

/**
 * Sign-out: exports left in the app's cache go too, since they hold the account's data. They
 * stay until then, because the app a file was shared to may still be reading it.
 */
export async function forgetExportFiles(): Promise<void> {
  try {
    for (const entry of new Directory(Paths.cache).list()) {
      if (entry instanceof File && EXPORT_FILE.test(entry.name)) {
        entry.delete();
      }
    }
  } catch {
    return;
  }
}
