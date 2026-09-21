// In-memory stand-ins for the device store and for Dropbox, used by the tests.
// FakeDropbox follows the same rules the real one does for the calls Quill
// makes: "only replace this exact version", "only create, never replace",
// and moves that pick a new name instead of replacing.

import { keyOf, parentOf } from './paths';
import {
  ConflictError,
  CursorResetError,
  NotFoundError,
  type LocalFile,
  type Remote,
  type RemoteEntry,
  type RemoteFile,
  type Store,
} from './types';

export class MemoryStore implements Store {
  files = new Map<string, LocalFile>();
  meta = new Map<string, unknown>();
  async allFiles() {
    return [...this.files.values()].map((f) => ({ ...f }));
  }
  async putFile(file: LocalFile) {
    this.files.set(file.key, { ...file });
  }
  async deleteFile(key: string) {
    this.files.delete(key);
  }
  async getMeta<T>(name: string) {
    return structuredClone(this.meta.get(name)) as T | undefined;
  }
  async setMeta(name: string, value: unknown) {
    this.meta.set(name, structuredClone(value));
  }
  async clear() {
    this.files.clear();
    this.meta.clear();
  }
}

type Node = { path: string; kind: 'file' | 'folder'; text?: string; rev?: string; modified?: string };

export class FakeDropbox implements Remote {
  nodes = new Map<string, Node>();
  private log: RemoteEntry[] = [];
  private revCounter = 0;
  /** Set to make every call fail as if offline. */
  offline = false;

  // ---- Test helpers: changes "made on another device" ----

  write(path: string, text: string): string {
    this.ensureParents(path);
    const rev = `r${++this.revCounter}`;
    const modified = new Date(1_700_000_000_000 + this.revCounter * 1000).toISOString();
    this.nodes.set(keyOf(path), { path, kind: 'file', text, rev, modified });
    this.log.push({ tag: 'file', path, rev, serverModified: modified });
    return rev;
  }

  delete(path: string): void {
    for (const key of [...this.nodes.keys()]) {
      if (key === keyOf(path) || key.startsWith(keyOf(path) + '/')) this.nodes.delete(key);
    }
    this.log.push({ tag: 'deleted', path });
  }

  text(path: string): string | undefined {
    return this.nodes.get(keyOf(path))?.text;
  }

  paths(): string[] {
    return [...this.nodes.values()].filter((n) => n.kind === 'file').map((n) => n.path).sort();
  }

  // ---- Remote ----

  async list(cursor?: string) {
    this.check();
    if (cursor === undefined) {
      const entries: RemoteEntry[] = [...this.nodes.values()].map((n) =>
        n.kind === 'folder' ? { tag: 'folder', path: n.path } : { tag: 'file', path: n.path, rev: n.rev!, serverModified: n.modified! },
      );
      return { entries, cursor: String(this.log.length) };
    }
    const from = Number(cursor);
    if (Number.isNaN(from) || from > this.log.length) throw new CursorResetError('reset');
    return { entries: this.log.slice(from), cursor: String(this.log.length) };
  }

  async download(path: string) {
    this.check();
    const node = this.nodes.get(keyOf(path));
    if (!node || node.kind !== 'file') throw new NotFoundError(path);
    return { path: node.path, rev: node.rev!, serverModified: node.modified!, text: node.text! };
  }

  async upload(path: string, text: string, rev?: string): Promise<RemoteFile> {
    this.check();
    const existing = this.nodes.get(keyOf(path));
    if (rev === undefined ? existing !== undefined : existing?.rev !== rev) throw new ConflictError(path);
    const newRev = this.write(existing?.path ?? path, text);
    const node = this.nodes.get(keyOf(path))!;
    return { path: node.path, rev: newRev, serverModified: node.modified! };
  }

  async move(from: string, to: string) {
    this.check();
    if (!this.nodes.has(keyOf(from))) throw new NotFoundError(from);
    const target = this.freeName(to);
    const moved: Node[] = [];
    for (const [key, node] of [...this.nodes]) {
      if (key === keyOf(from) || key.startsWith(keyOf(from) + '/')) {
        this.nodes.delete(key);
        moved.push({ ...node, path: target + node.path.slice(from.length) });
      }
    }
    this.ensureParents(target);
    for (const node of moved) this.nodes.set(keyOf(node.path), node);
    this.log.push({ tag: 'deleted', path: from });
    for (const node of moved) {
      this.log.push(node.kind === 'folder' ? { tag: 'folder', path: node.path } : { tag: 'file', path: node.path, rev: node.rev!, serverModified: node.modified! });
    }
    return { path: target, rev: this.nodes.get(keyOf(target))!.rev };
  }

  async copy(from: string, to: string) {
    this.check();
    const node = this.nodes.get(keyOf(from));
    if (!node || node.kind !== 'file') throw new NotFoundError(from);
    this.write(this.freeName(to), node.text!);
  }

  async createFolder(path: string) {
    this.check();
    if (this.nodes.has(keyOf(path))) return;
    this.ensureParents(path);
    this.nodes.set(keyOf(path), { path, kind: 'folder' });
    this.log.push({ tag: 'folder', path });
  }

  private check() {
    if (this.offline) throw new TypeError('Failed to fetch');
  }

  private ensureParents(path: string) {
    const parent = parentOf(path);
    if (parent && !this.nodes.has(keyOf(parent))) {
      this.ensureParents(parent);
      this.nodes.set(keyOf(parent), { path: parent, kind: 'folder' });
      this.log.push({ tag: 'folder', path: parent });
    }
  }

  private freeName(path: string): string {
    if (!this.nodes.has(keyOf(path))) return path;
    const dot = path.toLowerCase().endsWith('.md') ? path.length - 3 : path.length;
    for (let n = 1; ; n++) {
      const candidate = `${path.slice(0, dot)} (${n})${path.slice(dot)}`;
      if (!this.nodes.has(keyOf(candidate))) return candidate;
    }
  }
}
