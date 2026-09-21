// The device's copy of the library, kept in the browser's built-in database
// (IndexedDB). It survives closing the app and going offline.

import { openDB, type IDBPDatabase } from 'idb';
import type { LocalFile, Store } from './types';

const DB_NAME = 'quill';

export class DeviceStore implements Store {
  private db: Promise<IDBPDatabase>;

  constructor() {
    this.db = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore('files', { keyPath: 'key' });
        db.createObjectStore('meta');
      },
    });
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
    await Promise.all([db.clear('files'), db.clear('meta')]);
  }
}
