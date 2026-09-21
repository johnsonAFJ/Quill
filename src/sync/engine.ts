// The sync engine: this device's copy of the library, local edits, and the
// rules for exchanging changes with Dropbox. See "Sync" and "Safety" in SPEC.md.
//
// Every local change is applied here first and saved to the device's store
// right away. sync() then sends queued moves and changed sheets to Dropbox and
// pulls in changes made elsewhere. Writes to Dropbox never replace a version
// this device hasn't seen: a mismatch becomes a conflict copy instead.

import { titleOf, safeFileName, untitledName } from '../text/markdown';
import { BACKUPS, TRASH, baseName, isWithin, join, keyOf, notesPathFor, parentOf, stem } from './paths';
import {
  ConflictError,
  CursorResetError,
  NotFoundError,
  type LocalFile,
  type Op,
  type Remote,
  type RemoteEntry,
  type Store,
} from './types';

export type SyncStatus = {
  syncing: boolean;
  /** Changes on this device that Dropbox doesn't have yet. */
  pending: number;
  error?: string;
  /** The last sync failed because Dropbox couldn't be reached at all. */
  offline?: boolean;
  lastSynced?: number;
};

/** Below this many characters, shrinking a sheet isn't treated as suspicious. */
const BLANKING_MIN_LENGTH = 200;
const BLANKING_RATIO = 0.1;

const isMarkdown = (path: string) => /\.md$/i.test(path);
const newId = () => crypto.randomUUID();

export class Engine {
  private files = new Map<string, LocalFile>();
  private ops: Op[] = [];
  private cursor?: string;
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private runAgain = false;
  private revision = 0;
  status: SyncStatus = { syncing: false, pending: 0 };

  constructor(
    private store: Store,
    private remote: Remote,
    /** "iPhone", "iPad" or "Mac", used in conflict copy names. */
    private device: string,
    private now: () => number = Date.now,
  ) {}

  async load(): Promise<void> {
    for (const file of await this.store.allFiles()) this.files.set(file.key, file);
    this.ops = (await this.store.getMeta<Op[]>('ops')) ?? [];
    this.cursor = await this.store.getMeta<string>('cursor');
    this.changed();
  }

  // ---- Reading ----

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Changes whenever anything does; handy for re-rendering. */
  getRevision(): number {
    return this.revision;
  }

  all(): LocalFile[] {
    return [...this.files.values()];
  }

  get(key: string): LocalFile | undefined {
    return this.files.get(key);
  }

  // ---- Local changes ----

  setText(key: string, text: string): void {
    const file = this.files.get(key);
    if (!file || file.kind !== 'file' || file.text === text) return;
    this.put({ ...file, text, dirty: true, version: (file.version ?? 0) + 1, localModified: this.now() });
  }

  /** A new, empty "Untitled …" sheet. It isn't sent to Dropbox until it has text. */
  createSheet(folder: string): LocalFile {
    const path = this.freePath(folder, untitledName(new Date(this.now())), '.md');
    const file: LocalFile = {
      id: newId(),
      key: keyOf(path),
      path,
      kind: 'file',
      text: '',
      version: 0,
      localModified: this.now(),
      provisional: true,
    };
    this.put(file);
    return file;
  }

  createGroup(parent: string, name: string): LocalFile | null {
    const clean = safeFileName(name);
    if (!clean) return null;
    const path = this.freePath(parent, clean, '');
    const folder: LocalFile = { id: newId(), key: keyOf(path), path, kind: 'folder', onRemote: false };
    this.put(folder);
    this.queue({ type: 'createFolder', path });
    return folder;
  }

  /** Renames a sheet or group. Returns the new key, or null if nothing changed. */
  rename(key: string, newName: string): string | null {
    const item = this.files.get(key);
    const clean = safeFileName(newName);
    if (!item || !clean) return null;
    const ext = item.kind === 'file' ? '.md' : '';
    const current = item.kind === 'file' ? stem(baseName(item.path)) : baseName(item.path);
    if (clean === current) return null;
    const target = this.freePath(parentOf(item.path), clean, ext, item.key);
    this.moveWithNotes(item, target);
    const moved = this.byId(item.id);
    if (moved?.provisional) this.put({ ...moved, provisional: false });
    return keyOf(target);
  }

  /** Moves a sheet or group to Trash. Returns the key it has there, if any. */
  trash(key: string): string | null {
    const item = this.files.get(key);
    if (!item || isWithin(item.path, TRASH)) return null;
    // An empty sheet that never reached Dropbox has nothing worth keeping.
    if (item.kind === 'file' && !item.rev && !item.text) {
      this.remove(item.key);
      return null;
    }
    this.ensureFolder(TRASH);
    const name = item.kind === 'file' ? stem(baseName(item.path)) : baseName(item.path);
    const target = this.freePath(TRASH, name, item.kind === 'file' ? '.md' : '');
    this.moveWithNotes(item, target);
    const moved = this.byId(item.id);
    if (moved) this.put({ ...moved, trashedFrom: parentOf(item.path) });
    return keyOf(target);
  }

  /** Puts a sheet back where it was deleted from, or at the top of the Library. */
  restore(key: string): string | null {
    const item = this.files.get(key);
    if (!item || !isWithin(item.path, TRASH) || item.key === keyOf(TRASH)) return null;
    const from = item.trashedFrom ?? '';
    const stillThere = from === '' || (this.files.get(keyOf(from))?.kind === 'folder' && !isWithin(from, TRASH));
    const folder = stillThere ? from : '';
    const name = item.kind === 'file' ? stem(baseName(item.path)) : baseName(item.path);
    const target = this.freePath(folder, name, item.kind === 'file' ? '.md' : '');
    this.moveWithNotes(item, target);
    const moved = this.byId(item.id);
    if (moved) this.put({ ...moved, trashedFrom: undefined });
    return keyOf(target);
  }

  /**
   * Called when you leave a sheet. An "Untitled …" sheet is named once from its
   * first line; an empty one is cleaned up. Returns the sheet's key afterwards.
   */
  finishEditing(key: string): string | null {
    const file = this.files.get(key);
    if (!file || !file.provisional) return key;
    if (!file.text?.trim()) {
      this.trash(key);
      return null;
    }
    const name = safeFileName(titleOf(file.text));
    if (!name) {
      this.put({ ...file, provisional: false });
      return key;
    }
    return this.rename(key, name) ?? key;
  }

  // ---- Syncing ----

  /** Runs one sync. If one is already running, another follows it. */
  sync(): Promise<void> {
    if (this.running) {
      this.runAgain = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.runAgain = false;
        await this.syncOnce();
      } while (this.runAgain);
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async syncOnce(): Promise<void> {
    this.status = { ...this.status, syncing: true };
    this.changed();
    try {
      await this.pushOps();
      await this.pushFiles();
      await this.pull();
      this.status = { ...this.status, error: undefined, offline: false, lastSynced: this.now() };
    } catch (err) {
      console.warn('Quill sync stopped:', err);
      this.status = { ...this.status, error: describe(err), offline: err instanceof TypeError };
    } finally {
      this.status = { ...this.status, syncing: false };
      this.changed();
    }
  }

  private async pushOps(): Promise<void> {
    while (this.ops.length > 0) {
      const op = this.ops[0]!;
      if (op.type === 'createFolder') {
        await this.remote.createFolder(op.path);
        const folder = this.files.get(keyOf(op.path));
        if (folder) this.put({ ...folder, onRemote: true });
      } else {
        try {
          const result = await this.remote.move(op.from, op.to);
          if (keyOf(result.path) !== keyOf(op.to)) this.relocate(op.to, result.path); // Dropbox picked a new name
          const moved = this.files.get(keyOf(result.path));
          if (moved?.kind === 'file' && result.rev) this.put({ ...moved, rev: result.rev });
          if (moved?.kind === 'folder') this.put({ ...moved, onRemote: true });
        } catch (err) {
          // Already gone from Dropbox: there's nothing to move. Its text, if
          // any, is still here and gets uploaded at the new path.
          if (!(err instanceof NotFoundError)) throw err;
          for (const f of this.all()) if (isWithin(f.path, op.to) && f.kind === 'file' && f.rev) this.put({ ...f, rev: undefined, dirty: true });
        }
      }
      this.ops.shift();
      await this.store.setMeta('ops', this.ops);
      this.changed();
    }
  }

  private async pushFiles(): Promise<void> {
    for (const file of this.all()) {
      if (file.kind === 'file' && file.dirty) await this.pushFile(file);
    }
  }

  private async pushFile(file: LocalFile): Promise<void> {
    const text = file.text ?? '';
    const version = file.version;
    if (file.rev && this.looksBlanked(file, text)) await this.backUp(file);
    try {
      const result = await this.remote.upload(file.path, text, file.rev);
      const current = this.byId(file.id);
      if (!current) return;
      this.put({
        ...current,
        rev: result.rev,
        serverModified: result.serverModified,
        syncedLength: text.length,
        dirty: current.version !== version,
      });
    } catch (err) {
      if (!(err instanceof ConflictError)) throw err;
      await this.resolveConflict(file);
    }
  }

  /** Dropbox has a different version than the one this device edited. Keep both. */
  private async resolveConflict(file: LocalFile): Promise<void> {
    let theirs: Awaited<ReturnType<Remote['download']>> | null = null;
    try {
      theirs = await this.remote.download(file.path);
    } catch (err) {
      if (!(err instanceof NotFoundError)) throw err;
    }

    const mine = this.byId(file.id);
    if (!mine) return;
    const myText = mine.text ?? '';
    const myVersion = mine.version;

    if (!theirs) {
      // Deleted on another device while edited here: bring it back with this text.
      const result = await this.remote.upload(mine.path, myText);
      const current = this.byId(file.id);
      if (current) this.put({ ...current, rev: result.rev, serverModified: result.serverModified, syncedLength: myText.length, dirty: current.version !== myVersion });
      return;
    }

    if (theirs.text === myText) {
      const current = this.byId(file.id);
      if (current) this.put({ ...current, rev: theirs.rev, serverModified: theirs.serverModified, syncedLength: myText.length, dirty: current.version !== myVersion });
      return;
    }

    // Save this device's text as a separate "conflict" sheet next to the original.
    const copy = await this.uploadConflictCopy(mine.path, myText);
    const latest = this.byId(file.id);
    const typedMore = latest !== undefined && latest.version !== myVersion;
    this.put({
      id: newId(),
      key: keyOf(copy.path),
      path: copy.path,
      kind: 'file',
      text: typedMore ? latest!.text : myText,
      rev: copy.rev,
      serverModified: copy.serverModified,
      syncedLength: myText.length,
      dirty: typedMore,
      version: 0,
      localModified: this.now(),
    });
    if (latest) {
      this.put({
        ...latest,
        text: theirs.text,
        rev: theirs.rev,
        serverModified: theirs.serverModified,
        syncedLength: theirs.text.length,
        dirty: false,
        version: (latest.version ?? 0) + 1,
      });
    }
  }

  private async uploadConflictCopy(path: string, text: string) {
    const date = new Date(this.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const base = `${stem(baseName(path))} (conflict, ${this.device}, ${date})`;
    for (let n = 1; n <= 20; n++) {
      const copyPath = this.freePath(parentOf(path), n === 1 ? base : `${base} ${n}`, '.md');
      try {
        return await this.remote.upload(copyPath, text);
      } catch (err) {
        if (!(err instanceof ConflictError)) throw err;
      }
    }
    throw new Error('Couldn’t find a free name for a conflict copy.');
  }

  private looksBlanked(file: LocalFile, text: string): boolean {
    const before = file.syncedLength ?? 0;
    return before >= BLANKING_MIN_LENGTH && text.length < before * BLANKING_RATIO;
  }

  /** Copies the version on Dropbox into _quill/backups before it's replaced. */
  private async backUp(file: LocalFile): Promise<void> {
    const stamp = new Date(this.now()).toISOString().slice(0, 16).replace('T', ' ').replace(':', '');
    await this.remote.createFolder('/_quill');
    await this.remote.createFolder(BACKUPS);
    try {
      await this.remote.copy(file.path, join(BACKUPS, `${stem(baseName(file.path))} (before emptying ${stamp}).md`));
    } catch (err) {
      if (!(err instanceof NotFoundError)) throw err;
    }
  }

  private async pull(): Promise<void> {
    let full = !this.cursor;
    let page: { entries: RemoteEntry[]; cursor: string };
    try {
      page = await this.remote.list(this.cursor);
    } catch (err) {
      if (!(err instanceof CursorResetError)) throw err;
      full = true;
      page = await this.remote.list();
    }

    const seen = new Set<string>();
    const toDownload: string[] = [];

    for (const entry of page.entries) {
      if (isWithin(entry.path, '/_quill')) continue; // the app's own files
      const key = keyOf(entry.path);
      seen.add(key);
      const local = this.files.get(key);

      if (entry.tag === 'deleted') {
        if (local) this.removedElsewhere(local);
      } else if (entry.tag === 'folder') {
        this.put(local ? { ...local, onRemote: true } : { id: newId(), key, path: entry.path, kind: 'folder', onRemote: true });
      } else if (isMarkdown(entry.path)) {
        // A local edit on top of an old version is left alone here; the next
        // upload notices the mismatch and makes a conflict copy.
        if (!local || (local.rev !== entry.rev && !local.dirty)) toDownload.push(entry.path);
      }
    }

    if (full) {
      // Anything this device got from Dropbox that isn't there any more was
      // removed elsewhere. Things never sent to Dropbox are kept.
      for (const local of this.all()) {
        if (seen.has(local.key) || isWithin(local.path, '/_quill')) continue;
        if (local.kind === 'file' ? local.rev : local.onRemote) this.removedElsewhere(local);
      }
    }

    await inBatches(toDownload, 4, async (path) => {
      const theirs = await this.remote.download(path);
      const current = this.files.get(keyOf(path));
      if (current?.dirty) return;
      this.put({
        ...(current ?? { id: newId(), key: keyOf(theirs.path), kind: 'file' as const, version: 0 }),
        path: theirs.path,
        text: theirs.text,
        rev: theirs.rev,
        serverModified: theirs.serverModified,
        syncedLength: theirs.text.length,
        dirty: false,
      });
    });

    this.cursor = page.cursor;
    await this.store.setMeta('cursor', this.cursor);
  }

  /** Something disappeared from Dropbox. Local edits survive; the rest goes. */
  private removedElsewhere(item: LocalFile): void {
    for (const f of this.all()) {
      if (!isWithin(f.path, item.path)) continue;
      if (f.kind === 'file' && f.dirty) this.put({ ...f, rev: undefined });
      else if (f.kind === 'folder' && this.all().some((c) => c.dirty && isWithin(c.path, f.path))) this.put({ ...f, onRemote: false });
      else if (f.kind === 'file' && !f.rev && f.text) continue; // never sent yet
      else this.remove(f.key);
    }
  }

  // ---- Internals ----

  private put(file: LocalFile): void {
    this.files.set(file.key, file);
    void this.store.putFile(file);
    this.changed();
  }

  private remove(key: string): void {
    this.files.delete(key);
    void this.store.deleteFile(key);
    this.changed();
  }

  private queue(op: Op): void {
    this.ops.push(op);
    void this.store.setMeta('ops', this.ops);
    this.changed();
  }

  private byId(id: string): LocalFile | undefined {
    for (const f of this.files.values()) if (f.id === id) return f;
    return undefined;
  }

  private ensureFolder(path: string): void {
    if (this.files.has(keyOf(path))) return;
    this.put({ id: newId(), key: keyOf(path), path, kind: 'folder', onRemote: false });
    this.queue({ type: 'createFolder', path });
  }

  /** A path in `folder` named `name` + `ext` that nothing else on this device uses. */
  private freePath(folder: string, name: string, ext: string, ignoreKey?: string): string {
    for (let n = 1; ; n++) {
      const path = join(folder, (n === 1 ? name : `${name} ${n}`) + ext);
      const key = keyOf(path);
      if (key === ignoreKey || !this.files.has(key)) return path;
    }
  }

  /** Moves an item (and a sheet's notes file) here and, if it's on Dropbox, there too. */
  private moveWithNotes(item: LocalFile, target: string): void {
    this.move(item, target);
    if (item.kind === 'file') {
      const notes = this.files.get(keyOf(notesPathFor(item.path)));
      if (notes) this.move(notes, notesPathFor(target));
    }
  }

  private move(item: LocalFile, target: string): void {
    const onRemote = item.kind === 'file' ? Boolean(item.rev) : Boolean(item.onRemote);
    if (onRemote) {
      this.queue({ type: 'move', from: item.path, to: target });
    } else {
      // Not on Dropbox yet: point any queued folder creation at the new place.
      this.ops = this.ops.map((op) => (op.type === 'createFolder' && isWithin(op.path, item.path) ? { ...op, path: target + op.path.slice(item.path.length) } : op));
      void this.store.setMeta('ops', this.ops);
    }
    this.relocate(item.path, target);
  }

  /** Changes the path of an item and everything inside it, on this device only. */
  private relocate(from: string, to: string): void {
    for (const f of this.all()) {
      if (!isWithin(f.path, from)) continue;
      const path = to + f.path.slice(from.length);
      this.files.delete(f.key);
      void this.store.deleteFile(f.key);
      this.put({ ...f, path, key: keyOf(path) });
    }
  }

  private changed(): void {
    this.revision++;
    this.status = { ...this.status, pending: this.ops.length + this.all().filter((f) => f.dirty).length };
    for (const listener of this.listeners) listener();
  }
}

async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(work));
}

function describe(err: unknown): string {
  if (err instanceof TypeError) return 'Offline. Changes are saved on this device and will sync when you’re back online.';
  return err instanceof Error ? err.message : String(err);
}
