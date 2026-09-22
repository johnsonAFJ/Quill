// The three PDF "paint jobs". Each is a stylesheet for Paged.js, which lays
// the sheet out on Letter pages and adds page numbers and running headers.
// Fonts are bundled with Quill (all under the SIL Open Font License), so an
// export looks the same on every device, even offline.

import courier400 from '@fontsource/courier-prime/files/courier-prime-latin-400-normal.woff2?url';
import courier400i from '@fontsource/courier-prime/files/courier-prime-latin-400-italic.woff2?url';
import courier700 from '@fontsource/courier-prime/files/courier-prime-latin-700-normal.woff2?url';
import garamond400 from '@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2?url';
import garamond400i from '@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff2?url';
import garamond600 from '@fontsource/eb-garamond/files/eb-garamond-latin-600-normal.woff2?url';
import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import inter600 from '@fontsource/inter/files/inter-latin-600-normal.woff2?url';
import inter700 from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';
import serif400 from '@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff2?url';
import serif400i from '@fontsource/source-serif-4/files/source-serif-4-latin-400-italic.woff2?url';
import serif700 from '@fontsource/source-serif-4/files/source-serif-4-latin-700-normal.woff2?url';
import { cssString, escapeHtml, roughWords, type ExportDoc } from './document';

export type StyleId = 'manuscript' | 'book' | 'essay';

export const STYLES: { id: StyleId; name: string; blurb: string }[] = [
  { id: 'manuscript', name: 'Manuscript', blurb: 'The standard submission format: typewriter font, double-spaced, your name and word count on page 1.' },
  { id: 'book', name: 'Book', blurb: 'Like a printed page: a classic serif, justified text, a small-caps title and page numbers at the foot.' },
  { id: 'essay', name: 'Essay', blurb: 'Clean and modern for sharing: a sans-serif title, readable serif text and “3 of 7” page numbers.' },
];

export type ExportInfo = { name: string; contact: string; date: Date };

const face = (family: string, url: string, weight: number, style = 'normal') => ({ family, url, weight, style });

const FONTS = [
  face('Courier Prime', courier400, 400),
  face('Courier Prime', courier400i, 400, 'italic'),
  face('Courier Prime', courier700, 700),
  face('EB Garamond', garamond400, 400),
  face('EB Garamond', garamond400i, 400, 'italic'),
  face('EB Garamond', garamond600, 600),
  face('Inter', inter400, 400),
  face('Inter', inter600, 600),
  face('Inter', inter700, 700),
  face('Source Serif 4', serif400, 400),
  face('Source Serif 4', serif400i, 400, 'italic'),
  face('Source Serif 4', serif700, 700),
];

/**
 * The preview has no web address of its own, and Paged.js resolves addresses
 * against it, so every address it sees has to be complete ("https://…").
 */
function fontFaces(base: string): string {
  return FONTS.map(
    (f) => `@font-face { font-family: '${f.family}'; src: url('${new URL(f.url, base).href}') format('woff2'); font-weight: ${f.weight}; font-style: ${f.style}; }`,
  ).join('\n');
}

const surnameOf = (name: string) => name.trim().split(/\s+/).pop() ?? '';

// ---- 1. Manuscript ----

function manuscript(doc: ExportDoc, info: ExportInfo) {
  const header = [surnameOf(info.name), doc.title].filter(Boolean).join(' / ');
  const contact = [info.name, ...info.contact.split('\n')].map((l) => l.trim()).filter(Boolean);
  const css = `
    @page { size: letter; margin: 1in;
      @top-right { content: ${cssString(header + ' / ')} counter(page); font: 12pt 'Courier Prime', monospace; } }
    @page :first { @top-right { content: none; } }
    body { font: 12pt/2 'Courier Prime', 'Courier New', monospace; color: #000; }
    .front { display: flex; justify-content: space-between; line-height: 1.2; }
    .front p { margin: 0; }
    .title-block { text-align: center; margin: 2.6in 0 0.5in; line-height: 2; }
    .title-block h1 { font: inherit; margin: 0; }
    .title-block p { margin: 0; }
    .body p { margin: 0; text-indent: 0.5in; }
    .body h2, .body h3, .body h4 { font: inherit; font-weight: 700; margin: 1em 0 0; }
    .body blockquote { margin: 0 0 0 0.5in; }
    .body ul, .body ol { margin: 0; padding-left: 0.75in; }
    .scene-break { text-align: center; text-indent: 0 !important; }
    .scene-break::before { content: '#'; }
    .end { text-align: center; margin-top: 1em; }
  `;
  const html = `
    <div class="front">
      <div>${contact.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}</div>
      <p>${roughWords(doc.words)}</p>
    </div>
    <div class="title-block">
      <h1>${escapeHtml(doc.title)}</h1>
      ${info.name ? `<p>by ${escapeHtml(info.name)}</p>` : ''}
    </div>
    <div class="body">${doc.bodyHtml}</div>
    <p class="end">END</p>`;
  return { css, html };
}

// ---- 2. Book ----

/**
 * Book typesetting starts a section flush left: the opening paragraph (with
 * its first line in small caps) and the first paragraph after a scene break
 * or heading. They're marked with classes here rather than found with CSS.
 */
export function markLeads(bodyHtml: string): string {
  return bodyHtml
    .replace(/^<p>/, '<p class="lead opening">')
    .replace(/(<p class="scene-break"[^>]*><\/p>\n)<p>/g, '$1<p class="lead">')
    .replace(/(<\/h[2-6]>\n)<p>/g, '$1<p class="lead">');
}

function book(doc: ExportDoc, info: ExportInfo) {
  const css = `
    @page { size: letter; margin: 1.1in 1.35in 1.15in;
      @bottom-center { content: counter(page); font: 10pt 'EB Garamond', serif; color: #444; } }
    @page :first { @bottom-center { content: none; } }
    body { font: 11.5pt/1.5 'EB Garamond', Georgia, serif; color: #111; font-kerning: normal; font-variant-ligatures: common-ligatures; }
    .title-block { text-align: center; margin: 1.3in 0 0.6in; }
    .title-block h1 { font-weight: 400; font-size: 26pt; line-height: 1.2; font-variant: small-caps; letter-spacing: 0.05em; margin: 0; }
    .title-block .rule { width: 1.1in; border-top: 0.6pt solid #666; margin: 0.22in auto 0.18in; }
    .title-block .author { font-variant: small-caps; letter-spacing: 0.08em; font-size: 11pt; margin: 0; }
    /* Justified per paragraph, not on the whole body: Paged.js stretches the
       last line of anything split across pages, which should only ever be a
       paragraph continuing onto the next page. */
    .body p { margin: 0; text-indent: 1.4em; text-align: justify; hyphens: auto; -webkit-hyphens: auto; orphans: 2; widows: 2; }
    /* Marked in the HTML (see markLeads), because Paged.js restarts "first
       child" on every page and rewrites "a + b" selectors unreliably. */
    .body p.lead { text-indent: 0; }
    .body p.opening::first-line { font-variant: small-caps; letter-spacing: 0.04em; }
    .body h2, .body h3 { font-weight: 400; font-variant: small-caps; letter-spacing: 0.05em; text-align: center; font-size: 13pt; margin: 1.6em 0 0.8em; }
    .body blockquote { margin: 0.6em 1.6em; font-style: italic; }
    .scene-break { text-align: center !important; margin: 0.8em 0 !important; }
    .scene-break::before { content: '⁂'; }
  `;
  const html = `
    <div class="title-block">
      <h1>${escapeHtml(doc.title)}</h1>
      <div class="rule"></div>
      ${info.name ? `<p class="author">${escapeHtml(info.name)}</p>` : ''}
    </div>
    <div class="body">${markLeads(doc.bodyHtml)}</div>`;
  return { css, html };
}

// ---- 3. Essay ----

function essay(doc: ExportDoc, info: ExportInfo) {
  const date = info.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const meta = [info.name, date, `${doc.words.toLocaleString('en-US')} words`].filter(Boolean).join(' · ');
  const css = `
    @page { size: letter; margin: 1in 1.1in;
      @bottom-right { content: counter(page) " of " counter(pages); font: 8.5pt Inter, sans-serif; color: #888; } }
    body { font: 11pt/1.6 'Source Serif 4', Georgia, serif; color: #1a1a1a; }
    h1, h2, h3, h4, .meta { font-family: Inter, 'Helvetica Neue', sans-serif; }
    .title-block { margin: 0.2in 0 0.35in; }
    .title-block h1 { font-size: 28pt; font-weight: 700; line-height: 1.12; letter-spacing: -0.015em; margin: 0 0 0.12in; }
    .meta { font-size: 9pt; color: #777; margin: 0; }
    .body p { margin: 0 0 0.8em; orphans: 2; widows: 2; }
    .body h2 { font-size: 14pt; font-weight: 600; margin: 1.4em 0 0.4em; }
    .body h3 { font-size: 12pt; font-weight: 600; margin: 1.2em 0 0.3em; }
    .body blockquote { margin: 1em 0; padding-left: 1em; border-left: 3px solid #b5562f; color: #444; }
    .body a { color: #b5562f; }
    .scene-break { width: 0.5in; border-top: 1px solid #bbb; margin: 1.4em auto !important; }
  `;
  const html = `
    <div class="title-block">
      <h1>${escapeHtml(doc.title)}</h1>
      <p class="meta">${escapeHtml(meta)}</p>
    </div>
    <div class="body">${doc.bodyHtml}</div>`;
  return { css, html };
}

const BUILD = { manuscript, book, essay };

/**
 * Shown only on screen, around the pages: grey desk, white paper. Never
 * printed. Added after Paged.js has run, since it rewrites the page's own
 * stylesheets and drops rules like these.
 */
const SCREEN = `
  @media screen {
    html { background: #6b6862; }
    body { margin: 0; }
    .pagedjs_pages { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 24px 0 48px; }
    .pagedjs_page { background: #fff; box-shadow: 0 4px 18px rgba(0,0,0,0.35); }
  }
  @media screen and (max-width: 860px) { html { zoom: 0.72; } }
  @media screen and (max-width: 640px) { html { zoom: 0.46; } }
`.replace(/\s+/g, ' ');

/**
 * The whole page for the preview frame. `pagedUrl` is the Paged.js script and
 * `base` is Quill's own address, for making the font addresses complete.
 */
export function exportPage(style: StyleId, doc: ExportDoc, info: ExportInfo, pagedUrl: string, base: string): string {
  const { css, html } = BUILD[style](doc, info);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(doc.title)}</title>
<style>${fontFaces(base)}\n${css}</style>
<script>
  // Paged.js's own automatic start can miss the moment it waits for, and then
  // sits forever. Quill starts it itself once the page (and fonts) have loaded.
  window.PagedConfig = { auto: false };
  window.addEventListener('load', async () => {
    try {
      const flow = await window.PagedPolyfill.preview();
      const desk = document.createElement('style');
      desk.textContent = ${JSON.stringify(SCREEN)};
      document.head.appendChild(desk);
      parent.postMessage({ quillPdf: 'ready', pages: flow ? flow.total : 0 }, '*');
    } catch (err) {
      parent.postMessage({ quillPdf: 'error', message: String((err && err.message) || err) }, '*');
    }
  });
</script>
<script src="${new URL(pagedUrl, base).href}"></script>
</head>
<body>${html}</body>
</html>`;
}
