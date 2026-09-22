// The device's copy of the library, kept in the browser's built-in database
// (IndexedDB). It survives closing the app and going offline.

import { openDB, type IDBPDatabase } from 'idb';
import type { Snapshot, SnapshotStore } from './snapshots';
import type { LocalFile, Store } from './types';

const DB_NAME = 'quill';

export class DeviceStore implements Store, SnapshotStore {
  private db: Promise<IDBPDatabase>;

  constructor() {
    this.db = openDB(DB_NAME, 2, {
      // Each version only adds what's new, so an existing copy carries over as is.
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('files', { keyPath: 'key' });
          db.createObjectStore('meta');
        }
        if (oldVersion < 2) {
          db.createObjectStore('snapshots', { keyPath: 'id' }).createIndex('fileId', 'fileId');
        }
      },
      // A newer Quill in another window needs to upgrade the storage: step aside
      // (everything is already saved) and reload into the new version.
      blocking(_current, _next, event) {
        (event.target as IDBDatabase).close();
        location.reload();
      },
    });
  }

  async addSnapshot(snapshot: Snapshot): Promise<void> {
    await (await this.db).put('snapshots', snapshot);
  }

  async listSnapshots(fileId: string): Promise<Snapshot[]> {
    const all: Snapshot[] = await (await this.db).getAllFromIndex('snapshots', 'fileId', fileId);
    return all.sort((a, b) => b.at - a.at);
  }

  async deleteSnapshot(id: string): Promise<void> {
    await (await this.db).delete('snapshots', id);
  }

  async allFiles(): Promise<LocalFile[]> {
    return (await this.db).getAll('files');
  }

  async putFile(file: LocalFile): Promise<void> {
    await (await this.db).put('files', file);
  }

  async deleteFile(key: string): Promise<void> {
    await (await this.db).delete('files', key);
  }

  async getMeta<T>(name: string): Promise<T | undefined> {
    return (await this.db).get('meta', name);
  }

  async setMeta(name: string, value: unknown): Promise<void> {
    await (await this.db).put('meta', value, name);
  }

  async clear(): Promise<void> {
    const db = await this.db;
    await Promise.all([db.clear('files'), db.clear('meta'), db.clear('snapshots')]);
  }
}
