import { useEffect, useState } from 'react';
import { downloadEverything } from '../app/backup';
import { applyTheme, prefs, type Theme } from '../app/device';
import { accountLabel } from '../dropbox/connection';
import type { Engine } from '../sync/engine';
import { SyncLine } from './LibraryPane';
import { Dialog } from './Overlays';

type Props = { engine: Engine; onDisconnect: () => void; onClose: () => void };

export function SettingsDialog({ engine, onDisconnect, onClose }: Props) {
  const [account, setAccount] = useState('…');
  const [theme, setTheme] = useState<Theme>(prefs.get('theme', 'auto'));
  const [, rerender] = useState(0);

  useEffect(() => {
    accountLabel().then(setAccount, () => setAccount('(offline)'));
    return engine.subscribe(() => rerender((n) => n + 1));
  }, [engine]);

  const pickTheme = (t: Theme) => {
    setTheme(t);
    prefs.set('theme', t);
    applyTheme(t);
  };

  const last = engine.status.lastSynced;

  return (
    <Dialog title="Settings" onClose={onClose}>
      <section className="settings-section">
        <h3>Appearance</h3>
        <div className="segmented" role="radiogroup" aria-label="Theme">
          {(['auto', 'light', 'dark'] as const).map((t) => (
            <button key={t} role="radio" aria-checked={theme === t} className={theme === t ? 'on' : ''} onClick={() => pickTheme(t)}>
              {t === 'auto' ? 'Match device' : t === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>Sync</h3>
        <p>
          <SyncLine status={engine.status} />
          {last && <span className="muted"> · last synced {new Date(last).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
        </p>
        {engine.status.error && <p className="notice">{engine.status.error}</p>}
        <button className="quiet" onClick={() => engine.sync()}>
          Sync now
        </button>
      </section>

      <section className="settings-section">
        <h3>Backup</h3>
        <p className="muted">Every sheet and note on this device, in the same folders as in Dropbox.</p>
        <button className="quiet" onClick={() => downloadEverything(engine.all())}>
          Download everything as .zip
        </button>
      </section>

      <section className="settings-section">
        <h3>Dropbox</h3>
        <p>
          Connected to <strong>{account}</strong>
          <br />
          <span className="muted">Folder: Apps › Quill Writer</span>
        </p>
        <button className="quiet danger" onClick={onDisconnect}>
          Disconnect this device
        </button>
      </section>

      <div className="dialog-actions">
        <button onClick={onClose}>Done</button>
      </div>
    </Dialog>
  );
}
