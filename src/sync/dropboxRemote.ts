// The real Dropbox, translated into the engine's Remote interface.
// Every write uses a mode that can't replace a version Quill hasn't seen.

import { DropboxResponseError, type Dropbox, type files } from 'dropbox';
import { describeError } from '../dropbox/connection';
import { TRASH, isWithin, keyOf } from './paths';
import { ConflictError, CursorResetError, NotFoundError, type Remote, type RemoteEntry, type RemoteFile } from './types';

function summary(err: unknown): string {
  if (!(err instanceof DropboxResponseError)) return '';
  return (err.error as { error_summary?: string } | undefined)?.error_summary ?? '';
}

/** Turns Dropbox's "409" answers into the engine's named errors. */
function translate(err: unknown, path: string): never {
  const s = summary(err);
  if (err instanceof DropboxResponseError && err.status === 409) {
    if (s.includes('conflict')) throw new ConflictError(path);
    if (s.includes('not_found')) throw new NotFoundError(path);
    if (s.startsWith('reset')) throw new CursorResetError(path);
  }
  // Network failures stay TypeErrors so the engine can say "offline".
  throw err instanceof DropboxResponseError ? new Error(describeError(err)) : err;
}

function toFile(meta: { path_display?: string; name: string; rev: string; server_modified: string }): RemoteFile {
  return { path: meta.path_display ?? '/' + meta.name, rev: meta.rev, serverModified: meta.server_modified };
}

export class DropboxRemote implements Remote {
  constructor(private dbx: Dropbox) {}

  async list(cursor?: string) {
    const entries: RemoteEntry[] = [];
    const add = (items: files.ListFolderResult['entries']) => {
      for (const item of items) {
        const path = item.path_display ?? '/' + item.name;
        if (item['.tag'] === 'file') entries.push({ tag: 'file', path, rev: item.rev, serverModified: item.server_modified });
        else if (item['.tag'] === 'folder') entries.push({ tag: 'folder', path });
        else entries.push({ tag: 'deleted', path });
      }
    };
    try {
      let page = cursor
        ? (await this.dbx.filesListFolderContinue({ cursor })).result
        : (await this.dbx.filesListFolder({ path: '', recursive: true })).result;
      add(page.entries);
      while (page.has_more) {
        page = (await this.dbx.filesListFolderContinue({ cursor: page.cursor })).result;
        add(page.entries);
      }
      return { entries, cursor: page.cursor };
    } catch (err) {
      translate(err, '');
    }
  }

  async download(path: string) {
    try {
      const { result } = await this.dbx.filesDownload({ path });
      const blob = (result as unknown as { fileBlob: Blob }).fileBlob;
      return { ...toFile(result), text: await blob.text() };
    } catch (err) {
      translate(err, path);
    }
  }

  async upload(path: string, text: string, rev?: string) {
    try {
      const { result } = await this.dbx.filesUpload({
        path,
        contents: new Blob([text], { type: 'text/markdown; charset=utf-8' }),
        mode: rev ? { '.tag': 'update', update: rev } : { '.tag': 'add' },
        autorename: false,
        strict_conflict: true,
        mute: true,
      });
      return toFile(result);
    } catch (err) {
      translate(err, path);
    }
  }

  async move(from: string, to: string) {
    try {
      const { result } = await this.dbx.filesMoveV2({ from_path: from, to_path: to, autorename: true });
      const meta = result.metadata;
      return { path: meta.path_display ?? to, rev: meta['.tag'] === 'file' ? meta.rev : undefined };
    } catch (err) {
      translate(err, from);
    }
  }

  async copy(from: string, to: string) {
    try {
      await this.dbx.filesCopyV2({ from_path: from, to_path: to, autorename: true });
    } catch (err) {
      translate(err, from);
    }
  }

  async remove(path: string) {
    // Deleting is only ever allowed inside Trash, whatever asks for it.
    if (!isWithin(path, TRASH) || keyOf(path) === keyOf(TRASH)) throw new Error(`Quill only deletes from Trash (refused: ${path}).`);
    try {
      await this.dbx.filesDeleteV2({ path });
    } catch (err) {
      if (summary(err).includes('not_found')) return; // already gone
      translate(err, path);
    }
  }

  async createFolder(path: string) {
    try {
      await this.dbx.filesCreateFolderV2({ path, autorename: false });
    } catch (err) {
      if (summary(err).includes('conflict')) return; // already there
      translate(err, path);
    }
  }
}
