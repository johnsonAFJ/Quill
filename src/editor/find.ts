// Find and replace in the open sheet (⌘F): a slim bar at the top of the
// writing. Enter jumps to the next match, ⇧Enter the one before, Esc closes.
// Every match is highlighted, and the bar shows "3 of 12".

import {
  SearchQuery,
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  search,
  searchKeymap,
  setSearchQuery,
} from '@codemirror/search';
import type { EditorState, Extension } from '@codemirror/state';
import { EditorView, keymap, type Panel, type ViewUpdate } from '@codemirror/view';

/** Which match the cursor is on and how many there are, e.g. [3, 12]; [0, n] when it's on none. */
export function matchCount(state: EditorState, query: SearchQuery): [number, number] {
  if (!query.valid) return [0, 0];
  const sel = state.selection.main;
  let total = 0;
  let current = 0;
  const cursor = query.getCursor(state);
  for (let m = cursor.next(); !m.done; m = cursor.next()) {
    total++;
    if (m.value.from === sel.from && m.value.to === sel.to) current = total;
    if (total >= 9999) break;
  }
  return [current, total];
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node: HTMLElementTagNameMap[K] = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function findPanel(view: EditorView): Panel {
  const initial = getSearchQuery(view.state);
  const find = el('input', { className: 'cm-find-input', type: 'search', placeholder: 'Find', value: initial.search, spellcheck: false });
  find.setAttribute('main-field', 'true');
  find.setAttribute('autocapitalize', 'off');
  find.setAttribute('autocorrect', 'off');
  const replace = el('input', { className: 'cm-find-input', type: 'search', placeholder: 'Replace with', value: initial.replace, spellcheck: false });
  replace.setAttribute('autocapitalize', 'off');
  replace.setAttribute('autocorrect', 'off');
  const matchCase = el('button', { className: 'cm-find-toggle', type: 'button', title: 'Match capitals' }, 'Aa');
  const count = el('span', { className: 'cm-find-count' });
  const button = (label: string, title: string, run: () => void) => {
    const b = el('button', { className: 'cm-find-button', type: 'button', title }, label);
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = run;
    return b;
  };

  let caseSensitive = initial.caseSensitive;
  const commit = () => {
    const query = new SearchQuery({ search: find.value, replace: replace.value, caseSensitive, literal: true });
    if (!query.eq(getSearchQuery(view.state))) view.dispatch({ effects: setSearchQuery.of(query) });
  };
  const showCount = (state: EditorState) => {
    const query = getSearchQuery(state);
    if (!query.search) {
      count.textContent = '';
      return;
    }
    const [current, total] = matchCount(state, query);
    count.textContent = total === 0 ? 'None' : current ? `${current} of ${total}` : `${total} found`;
  };
  const showCase = () => {
    matchCase.classList.toggle('on', caseSensitive);
    matchCase.setAttribute('aria-pressed', String(caseSensitive));
  };
  matchCase.onmousedown = (e) => e.preventDefault();
  matchCase.onclick = () => {
    caseSensitive = !caseSensitive;
    showCase();
    commit();
  };
  showCase();

  find.oninput = commit;
  replace.oninput = commit;
  find.onkeydown = (e) => {
    if (e.key === 'Tab' && !e.shiftKey && replace.isConnected) {
      e.preventDefault();
      replace.focus();
      replace.select();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit();
      (e.shiftKey ? findPrevious : findNext)(view);
    }
  };
  replace.onkeydown = (e) => {
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      find.focus();
      find.select();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit();
      replaceNext(view);
    }
  };

  const readOnly = view.state.readOnly;
  const findRow = el(
    'div',
    { className: 'cm-find-row' },
    find,
    count,
    button('↑', 'Previous (⇧Enter)', () => findPrevious(view)),
    button('↓', 'Next (Enter)', () => findNext(view)),
    matchCase,
    button('Done', 'Close (Esc)', () => closeSearchPanel(view)),
  );
  const replaceRow = el(
    'div',
    { className: 'cm-find-row' },
    replace,
    button('Replace', 'Replace this one and find the next (Enter)', () => {
      commit();
      replaceNext(view);
    }),
    button('All', 'Replace every match', () => {
      commit();
      replaceAll(view);
    }),
  );
  const dom = el('div', { className: 'cm-find' }, findRow, ...(readOnly ? [] : [replaceRow]));
  dom.onkeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSearchPanel(view);
      view.focus();
    }
  };

  showCount(view.state);
  return {
    dom,
    top: true,
    mount: () => {
      find.focus();
      find.select();
    },
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.transactions.some((tr) => tr.effects.some((e) => e.is(setSearchQuery)))) showCount(update.state);
    },
  };
}

export const findAndReplace: Extension = [
  search({ top: true, createPanel: findPanel }),
  keymap.of(searchKeymap),
  EditorView.baseTheme({
    '.cm-panels-top': { borderBottom: '1px solid var(--line)', background: 'var(--bg)' },
    '.cm-find': { display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 12px', fontFamily: 'var(--ui-font, system-ui)', fontSize: '14px', maxWidth: '68ch', margin: '0 auto' },
    '.cm-find-row': { display: 'flex', alignItems: 'center', gap: '6px' },
    '.cm-find-input': {
      flex: '1',
      minWidth: '0',
      font: 'inherit',
      fontSize: '16px',
      padding: '5px 9px',
      borderRadius: '7px',
      border: '1px solid var(--line)',
      background: 'var(--hover)',
      color: 'var(--text)',
      outline: 'none',
    },
    '.cm-find-input:focus': { borderColor: 'var(--accent)' },
    '.cm-find-count': { color: 'var(--muted)', fontSize: '13px', minWidth: '4.5em', textAlign: 'right', whiteSpace: 'nowrap' },
    '.cm-find-button, .cm-find-toggle': {
      font: 'inherit',
      padding: '4px 9px',
      borderRadius: '7px',
      border: '1px solid transparent',
      background: 'none',
      color: 'var(--text)',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    },
    '.cm-find-button:hover, .cm-find-toggle:hover': { background: 'var(--hover)' },
    '.cm-find-toggle': { color: 'var(--muted)' },
    '.cm-find-toggle.on': { color: 'var(--accent)', borderColor: 'var(--accent)' },
  }),
  // A full theme, so it wins over the search package's own yellow highlights.
  EditorView.theme({
    '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)', borderRadius: '2px', outline: 'none' },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'color-mix(in srgb, var(--accent) 50%, transparent)' },
  }),
];
