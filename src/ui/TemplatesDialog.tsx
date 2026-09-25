// "New from template…": pick a starting point, or start blank.

import { useState } from 'react';
import { previewOf, titleOf } from '../text/markdown';
import { Dialog } from './Overlays';

export type TemplateChoice = { key: string; name: string; text: string };

type Props = {
  templates: TemplateChoice[];
  /** Where the new sheet will go, for the line at the foot. */
  destination: string;
  onPick: (template: TemplateChoice | null) => void;
  onEdit: (key: string) => void;
  onClose: () => void;
};

export function TemplatesDialog({ templates, destination, onPick, onEdit, onClose }: Props) {
  const [chosen, setChosen] = useState<string | null>(templates[0]?.key ?? null);
  const template = templates.find((t) => t.key === chosen) ?? null;

  return (
    <Dialog title="New from template" onClose={onClose}>
      {templates.length === 0 ? (
        <p className="muted">
          No templates yet. Make a sheet the way you like to start, then choose <strong>Save as template…</strong> from its ••• menu. Templates live in a “Templates” group in your Quill folder, and you can edit them like any other sheet.
        </p>
      ) : (
        <div className="versions">
          <ul className="version-list">
            {templates.map((t) => (
              <li key={t.key}>
                <button className={t.key === chosen ? 'on' : ''} onClick={() => setChosen(t.key)}>
                  <span>{t.name}</span>
                  <small>{previewOf(t.text, 60) || titleOf(t.text) || 'Empty'}</small>
                </button>
              </li>
            ))}
          </ul>
          {template && <pre className="version-preview">{template.text}</pre>}
        </div>
      )}
      <p className="muted small-print">
        The new sheet goes in {destination}. A template can hold <code>{'{{title}}'}</code>, <code>{'{{date}}'}</code>, <code>{'{{day}}'}</code> or <code>{'{{time}}'}</code>, filled in as the sheet is made.
      </p>
      <div className="dialog-actions">
        {template && (
          <button className="quiet small" onClick={() => onEdit(template.key)}>
            Edit this template
          </button>
        )}
        <button className="quiet" onClick={() => onPick(null)}>
          Blank sheet
        </button>
        <button disabled={!template} onClick={() => template && onPick(template)}>
          Use template
        </button>
      </div>
    </Dialog>
  );
}
