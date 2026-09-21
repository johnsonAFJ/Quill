// Phase 0: prove the pieces fit. Connect to Dropbox, show which account,
// list the app folder as a Library tree, and write one test sheet.
// The real three-column writing layout arrives in phase 1.

import { useCallback, useEffect, useState } from 'react';
import {
  accountLabel,
  describeError,
  disconnect,
  finishSignInIfReturning,
  isConnected,
  listEverything,
  startSignIn,
  writeWelcomeSheet,
} from './dropbox/connection';
import { buildLibrary, type Group, type Library } from './library/tree';

type Status =
  | { state: 'starting' }
  | { state: 'signedOut'; message?: string }
  | { state: 'loading'; account?: string }
  | { state: 'ready'; account: string; library: Library; message?: string }
  | { state: 'failed'; message: string };

export function App() {
  const [status, setStatus] = useState<Status>({ state: 'starting' });
  const [persistent, setPersistent] = useState<boolean | null>(null);

  const load = useCallback(async (message?: string) => {
    setStatus((s) => ({ state: 'loading', account: s.state === 'ready' ? s.account : undefined }));
    try {
      const [account, entries] = await Promise.all([accountLabel(), listEverything()]);
      setStatus({ state: 'ready', account, library: buildLibrary(entries), message });
    } catch (err) {
      setStatus({ state: 'failed', message: describeError(err) });
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const signInError = await finishSignInIfReturning();
        if (signInError || !isConnected()) {
          setStatus({ state: 'signedOut', message: signInError ?? undefined });
          return;
        }
        await load();
      } catch (err) {
        setStatus({ state: 'signedOut', message: describeError(err) });
      }
    })();
    // Ask the browser not to clear Quill's on-device storage when space runs low.
    navigator.storage?.persist?.().then(setPersistent, () => setPersistent(false));
  }, [load]);

  const writeTest = async () => {
    try {
      const created = await writeWelcomeSheet();
      await load(created ? 'Wrote “Welcome to Quill” to Dropbox.' : '“Welcome to Quill” was already there, so nothing was changed.');
    } catch (err) {
      setStatus({ state: 'failed', message: describeError(err) });
    }
  };

  const signOut = async () => {
    await disconnect();
    setStatus({ state: 'signedOut', message: 'Disconnected. Your files in Dropbox are untouched.' });
  };

  return (
    <main className="setup">
      <h1>Quill</h1>
      <p className="subtitle">Setup check</p>

      {status.state === 'starting' && <p>Starting…</p>}

      {status.state === 'signedOut' && (
        <>
          {status.message && <p className="notice">{status.message}</p>}
          <p>Connect your Personal Dropbox. Quill can only see its own folder, <code>Apps/Quill Writer</code>.</p>
          <button onClick={() => startSignIn().catch((err) => setStatus({ state: 'signedOut', message: describeError(err) }))}>
            Connect Dropbox
          </button>
        </>
      )}

      {status.state === 'loading' && <p>Reading your Dropbox folder…</p>}

      {status.state === 'failed' && (
        <>
          <p className="notice error">{status.message}</p>
          <div className="actions">
            <button onClick={() => load()}>Try again</button>
            <button className="quiet" onClick={signOut}>Disconnect</button>
          </div>
        </>
      )}

      {status.state === 'ready' && (
        <>
          <p>
            Connected to <strong>{status.account}</strong>
          </p>
          {status.message && <p className="notice">{status.message}</p>}
          <section className="library">
            <h2>Library</h2>
            {isEmpty(status.library.root) ? (
              <p className="muted">The folder is empty. Write a test sheet to check that saving works.</p>
            ) : (
              <GroupContents group={status.library.root} />
            )}
            {status.library.trash.length > 0 && (
              <p className="muted">Trash: {status.library.trash.length} sheet{status.library.trash.length === 1 ? '' : 's'}</p>
            )}
          </section>
          <div className="actions">
            <button onClick={writeTest}>Write a test sheet</button>
            <button className="quiet" onClick={() => load()}>Refresh</button>
            <button className="quiet" onClick={signOut}>Disconnect</button>
          </div>
        </>
      )}

      <footer className="muted">
        On-device storage:{' '}
        {persistent === null ? 'checking…' : persistent ? 'kept permanently' : 'may be cleared if space runs low'}
        {' · '}
        {navigator.onLine ? 'online' : 'offline'}
      </footer>
    </main>
  );
}

function isEmpty(group: Group): boolean {
  return group.groups.length === 0 && group.sheets.length === 0;
}

function GroupContents({ group }: { group: Group }) {
  return (
    <ul>
      {group.groups.map((g) => (
        <li key={g.path}>
          <span className="group">{g.name}</span>
          {g.hasNotes && <span className="muted"> · notes</span>}
          {!isEmpty(g) && <GroupContents group={g} />}
        </li>
      ))}
      {group.sheets.map((s) => (
        <li key={s.path}>
          {s.title}
          {s.hasNotes && <span className="muted"> 📎</span>}
        </li>
      ))}
    </ul>
  );
}
