// The shapes the sync engine works with. The engine only talks to these two
// interfaces, so tests can swap in an in-memory store and a pretend Dropbox.

/** One file or folder as this device knows it. */
export type LocalFile = {
  /** Stays the same through renames and moves. */
  id: string;
  /** Lowercased path; Dropbox paths are case-insensitive. */
  key: string;
  /** Path as displayed, starting with "/", e.g. "/Essays/On Walking.md". */
  path: string;
  kind: 'file' | 'folder';
  /** Folders: whether Dropbox has it yet. */
  onRemote?: boolean;
  text?: string;
  /** Dropbox's version id for the text this device last synced. Absent = never uploaded. */
  rev?: string;
  /** Has changes Dropbox doesn't have yet. */
  dirty?: boolean;
  /** Bumped on every local edit, so an upload can tell if you kept typing meanwhile. */
  version?: number;
  /** Length of the last synced text, for the blanking guard. */
  syncedLength?: number;
  serverModified?: string;
  localModified?: number;
  /** Created in Quill as "Untitled …" and not yet named from its first line. */
  provisional?: boolean;
  /** For sheets in Trash: the folder it was deleted from. */
  trashedFrom?: string;
};

export type Op =
  | { type: 'createFolder'; path: string }
  | { type: 'move'; from: string; to: string };

export interface Store {
  allFiles(): Promise<LocalFile[]>;
  putFile(file: LocalFile): Promise<void>;
  deleteFile(key: string): Promise<void>;
  getMeta<T>(name: string): Promise<T | undefined>;
  setMeta(name: string, value: unknown): Promise<void>;
  clear(): Promise<void>;
}

export type RemoteEntry =
  | { tag: 'file'; path: string; rev: string; serverModified: string }
  | { tag: 'folder'; path: string }
  | { tag: 'deleted'; path: string };

export type RemoteFile = { path: string; rev: string; serverModified: string };

/** Thrown when Dropbox refuses a write because the file isn't the version we expected. */
export class ConflictError extends Error {}
/** Thrown when a path doesn't exist on Dropbox. */
export class NotFoundError extends Error {}
/** Thrown when a saved list position is too old and a full re-list is needed. */
export class CursorResetError extends Error {}

export interface Remote {
  /** With no cursor: everything. With a cursor: only what changed since. */
  list(cursor?: string): Promise<{ entries: RemoteEntry[]; cursor: string }>;
  download(path: string): Promise<RemoteFile & { text: string }>;
  /** rev given: only replace that exact version. rev absent: only create, never replace. */
  upload(path: string, text: string, rev?: string): Promise<RemoteFile>;
  /** Never replaces: if the destination exists, Dropbox picks a new name and returns it. */
  move(from: string, to: string): Promise<{ path: string; rev?: string }>;
  copy(from: string, to: string): Promise<void>;
  /** Succeeds quietly if the folder already exists. */
  createFolder(path: string): Promise<void>;
}
