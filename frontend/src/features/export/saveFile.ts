import { File, Paths } from 'expo-file-system';
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
