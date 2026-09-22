// Export PDF: pick one of the three styles, see the pages, then save.
// Saving uses the system print window's "Save as PDF", which is how Safari
// and the home-screen app make PDFs.

import { useEffect, useMemo, useRef, useState } from 'react';
// Paged.js's ready-to-run script. Its package doesn't list it for importing, hence the file path.
import pagedUrl from '../../node_modules/pagedjs/dist/paged.polyfill.min.js?url';
import { prefs } from '../app/device';
import { accountName } from '../dropbox/connection';
import { exportDocument } from '../export/document';
import { STYLES, exportPage, type StyleId } from '../export/styles';
import { Icon } from './icons';

type Props = { text: string; fallbackTitle: string; onClose: () => void };

export function ExportPdf({ text, fallbackTitle, onClose }: Props) {
  const [style, setStyle] = useState<StyleId>(() => prefs.get('exportStyle', 'book'));
  const [name, setName] = useState<string>(() => prefs.get('exportName', ''));
  const [contact, setContact] = useState<string>(() => prefs.get('exportContact', ''));
  const [roundWords, setRoundWords] = useState<boolean>(() => prefs.get('exportRoundWords', true));
  const [step, setStep] = useState<'choose' | 'preview'>('choose');

  // Until you've chosen a name, fill it in from your Dropbox account.
  useEffect(() => {
    if (!prefs.get('exportName', '')) accountName().then((n) => setName((current) => current || n), () => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (step === 'preview' ? setStep('choose') : onClose());
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [step, onClose]);

  const preview = () => {
    prefs.set('exportStyle', style);
    prefs.set('exportName', name);
    prefs.set('exportContact', contact);
    prefs.set('exportRoundWords', roundWords);
    setStep('preview');
  };

  if (step === 'preview') {
    return <Preview text={text} fallbackTitle={fallbackTitle} style={style} name={name} contact={contact} roundWords={roundWords} onStyle={setStyle} onBack={() => setStep('choose')} onClose={onClose} />;
  }

  return (
    <div className="backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog export-dialog" role="dialog" aria-label="Export PDF">
        <h2>Export PDF</h2>
        <div className="style-choices" role="radiogroup" aria-label="Style">
          {STYLES.map((s) => (
            <button key={s.id} role="radio" aria-checked={style === s.id} className={`style-choice ${s.id}${style === s.id ? ' on' : ''}`} onClick={() => setStyle(s.id)}>
              <span className="style-sample" aria-hidden="true">
                Aa
              </span>
              <span className="style-text">
                <strong>{s.name}</strong>
                <span>{s.blurb}</span>
              </span>
            </button>
          ))}
        </div>
        <label className="field">
          <span>Name on the export</span>
          <input value={name} placeholder="Your name" onChange={(e) => setName(e.target.value)} />
          <small className="muted">Clear it to leave your name off this export.</small>
        </label>
        {style === 'manuscript' && (
          <label className="field">
            <span>Contact details for page 1 (optional)</span>
            <textarea rows={3} value={contact} placeholder={'Email\nPhone or address'} onChange={(e) => setContact(e.target.value)} />
            <small className="muted">Saved on this device only.</small>
          </label>
        )}
        {style === 'manuscript' && (
          <label className="check-field">
            <input type="checkbox" checked={roundWords} onChange={(e) => setRoundWords(e.target.checked)} />
            <span>
              Round the word count
              <small className="muted">“About 2,300 words” is the standard. Turn it off for an exact count when a word limit is close or the guidelines ask.</small>
            </span>
          </label>
        )}
        <p className="muted small-print">Comments and notes are never included.</p>
        <div className="dialog-actions">
          <button className="quiet" onClick={onClose}>
            Cancel
          </button>
          <button onClick={preview}>Preview</button>
        </div>
      </div>
    </div>
  );
}

type PreviewProps = {
  text: string;
  fallbackTitle: string;
  style: StyleId;
  name: string;
  contact: string;
  roundWords: boolean;
  onStyle: (s: StyleId) => void;
  onBack: () => void;
  onClose: () => void;
};

function Preview({ text, fallbackTitle, style, name, contact, roundWords, onStyle, onBack, onClose }: PreviewProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const doc = useMemo(() => exportDocument(text, fallbackTitle), [text, fallbackTitle]);
  const html = useMemo(() => exportPage(style, doc, { name: name.trim(), contact, roundWords, date: new Date() }, pagedUrl, location.href), [style, doc, name, contact, roundWords]);

  useEffect(() => {
    setPages(null);
    setFailed(null);
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.quillPdf === 'ready') setPages(e.data.pages);
      if (e.data?.quillPdf === 'error') setFailed(e.data.message);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [html]);

  const save = () => {
    const win = frame.current?.contentWindow;
    if (!win) return;
    // The print window names the PDF after the page title.
    const before = document.title;
    document.title = doc.title;
    win.focus();
    win.print();
    setTimeout(() => (document.title = before), 1000);
  };

  return (
    <div className="pdf-preview" role="dialog" aria-label="PDF preview">
      <header className="pdf-bar">
        <button className="icon-button back" onClick={onBack}>
          <Icon name="back" /> <span>Options</span>
        </button>
        <div className="segmented" role="radiogroup" aria-label="Style">
          {STYLES.map((s) => (
            <button key={s.id} role="radio" aria-checked={style === s.id} className={style === s.id ? 'on' : ''} onClick={() => onStyle(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
        <div className="pdf-bar-end">
          <span className="muted">{failed ? 'Couldn’t lay out the pages' : pages === null ? 'Laying out pages…' : `${pages} page${pages === 1 ? '' : 's'}`}</span>
          <button onClick={save} disabled={pages === null}>
            Save as PDF…
          </button>
          <button className="icon-button done" onClick={onClose}>
            Done
          </button>
        </div>
      </header>
      {failed && <p className="notice pdf-error">Something went wrong laying out the pages: {failed}</p>}
      <iframe ref={frame} key={html} className="pdf-frame" title="Preview" srcDoc={html} />
    </div>
  );
}
