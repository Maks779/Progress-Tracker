import type { ExportFile } from './exportFiles';

export class SharingUnavailableError extends Error {}

/** On the web the browser downloads the file under its real name, as any site download. */
export async function saveFile(file: ExportFile): Promise<void> {
  const url = URL.createObjectURL(new Blob([file.text], { type: `${file.mimeType};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The web keeps no copy: a download belongs to the person's own downloads folder. */
export async function forgetExportFiles(): Promise<void> {}
