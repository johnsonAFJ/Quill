// Signs in to Dropbox if needed, then opens the writing app.

import { useEffect, useState } from 'react';
import { applyTheme, deviceName, prefs, type Theme } from './app/device';
import { applySeason, previewOpen, seasonNow, type SeasonChoice } from './app/season';
import { describeError, disconnect, dropboxClient, finishSignInIfReturning, isConnected, startSignIn } from './dropbox/connection';
import { DeviceStore } from './sync/deviceStore';
import { DropboxRemote } from './sync/dropboxRemote';
import { Engine } from './sync/engine';
import { Snapshots } from './sync/snapshots';
import { Workspace } from './ui/Workspace';

type State = { state: 'starting' } | { state: 'signedOut'; message?: string } | { state: 'ready'; engine: Engine; store: DeviceStore; snapshots: Snapshots };

export function App() {
  const [status, setStatus] = useState<State>({ state: 'starting' });

  useEffect(() => {
    applyTheme(prefs.get<Theme>('theme', 'auto'));
    const now = new Date();
    // Once the preview has closed, "show me now" quietly becomes "when it's time".
    let choice = prefs.get<SeasonChoice>('season', 'auto');
    if (choice === 'on' && !previewOpen(now)) {
      choice = 'auto';
      prefs.set('season', choice);
    }
    applySeason(seasonNow(now, choice, prefs.get<string[]>('seasonsSkipped', [])));
    (async () => {
      try {
        const signInError = await finishSignInIfReturning();
        if (signInError || !isConnected()) {
          setStatus({ state: 'signedOut', message: signInError ?? undefined });
          return;
        }
        const store = new DeviceStore();
        const engine = new Engine(store, new DropboxRemote(dropboxClient()), deviceName());
        await engine.load();
        setStatus({ state: 'ready', engine, store, snapshots: new Snapshots(store) });
      } catch (err) {
        setStatus({ state: 'signedOut', message: describeError(err) });
      }
    })();
    // Ask the browser not to clear Quill's on-device copy when space runs low.
    void navigator.storage?.persist?.();
  }, []);

  if (status.state === 'starting') return <div className="splash" />;

  if (status.state === 'signedOut') {
    return (
      <main className="welcome">
        <h1>Quill</h1>
        <p className="muted">A quiet place to write.</p>
        {status.message && <p className="notice">{status.message}</p>}
        <p>
          Connect your Personal Dropbox. Quill can only see its own folder, <strong>Apps › Quill Writer</strong>.
        </p>
        <button onClick={() => startSignIn().catch((err) => setStatus({ state: 'signedOut', message: describeError(err) }))}>Connect Dropbox</button>
      </main>
    );
  }

  const { engine, store, snapshots } = status;
  const onDisconnect = async () => {
    const pending = engine.status.pending;
    const warning =
      pending > 0
        ? `${pending} change${pending === 1 ? ' hasn’t' : 's haven’t'} reached Dropbox yet and will be lost from this device. Disconnect anyway?`
        : 'Disconnect this device from Dropbox? Your writing stays in Dropbox; this device forgets its copy.';
    if (!confirm(warning)) return;
    await disconnect();
    await store.clear();
    location.reload();
  };

  return <Workspace engine={engine} snapshots={snapshots} onDisconnect={onDisconnect} />;
}
