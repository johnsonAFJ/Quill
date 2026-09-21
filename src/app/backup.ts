// "Download everything as .zip": every sheet and notes file on this device,
// in the same folders as in Dropbox.

import { strToU8, zipSync } from 'fflate';
import type { LocalFile } from '../sync/types';
import { isInstalled } from './device';

/** Returns false if you cancelled the share sheet. */
export async function downloadEverything(files: LocalFile[]): Promise<boolean> {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) {
    if (f.kind === 'file' && f.text !== undefined) entries[f.path.slice(1)] = strToU8(f.text);
  }
  const zip = zipSync(entries, { level: 6 });
  const name = `Quill backup ${new Date().toISOString().slice(0, 10)}.zip`;
  const file = new File([zip as BlobPart], name, { type: 'application/zip' });

  // The home-screen app on iPhone and iPad can't download files, so there it
  // opens the share sheet instead ("Save to Files", AirDrop, email).
  if (isInstalled() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch {
      return false;
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
