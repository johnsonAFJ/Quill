// Rewind snapshots: a quiet copy of a sheet each time you start working on it
// (opening it in a new session), kept on this device only. The last 20 per
// sheet are listed under ••• → Earlier versions. They follow a sheet through
// renames because they're tied to its id, not its name.

import { wordCount } from '../text/markdown';

export type Snapshot = {
  id: string;
  /** The sheet's LocalFile id. */
  fileId: string;
  at: number;
  text: string;
  words: number;
  why: 'opened' | 'before restore';
};

export interface SnapshotStore {
  addSnapshot(snapshot: Snapshot): Promise<void>;
  /** Newest first. */
  listSnapshots(fileId: string): Promise<Snapshot[]>;
  deleteSnapshot(id: string): Promise<void>;
}

export const KEEP = 20;

export class Snapshots {
  constructor(
    private store: SnapshotStore,
    private now: () => number = Date.now,
  ) {}

  /** Saves a copy unless it would be empty or the same as the latest one. Returns whether it did. */
  async capture(fileId: string, text: string, why: Snapshot['why']): Promise<boolean> {
    if (!text.trim()) return false;
    const existing = await this.store.listSnapshots(fileId);
    if (existing[0]?.text === text) return false;
    await this.store.addSnapshot({ id: crypto.randomUUID(), fileId, at: this.now(), text, words: wordCount(text), why });
    for (const old of existing.slice(KEEP - 1)) await this.store.deleteSnapshot(old.id);
    return true;
  }

  list(fileId: string): Promise<Snapshot[]> {
    return this.store.listSnapshots(fileId);
  }
}

export class MemorySnapshotStore implements SnapshotStore {
  items: Snapshot[] = [];
  async addSnapshot(s: Snapshot) {
    this.items.push({ ...s });
  }
  async listSnapshots(fileId: string) {
    return this.items.filter((s) => s.fileId === fileId).sort((a, b) => b.at - a.at);
  }
  async deleteSnapshot(id: string) {
    this.items = this.items.filter((s) => s.id !== id);
  }
}
