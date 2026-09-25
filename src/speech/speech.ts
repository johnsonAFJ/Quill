// "Read to me": the voice built into your iPhone, iPad or Mac reads the sheet
// back to you. Nothing is sent anywhere; the browser hands the text to the
// same voice Apple uses for spoken content, so it works offline and free.
//
// The text is split into short pieces (a sentence or two each), because some
// browsers give up part way through a long one. Comments, headings marks and
// other Markdown symbols are left out, so it reads like prose.

import { withoutComments } from '../text/markdown';

export type Piece = {
  /** Where it starts in the sheet, so reading can begin at your cursor. */
  at: number;
  /** What the voice says. */
  say: string;
};

/** Whether this browser can read out loud at all. */
export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

const MAX = 260;

function spoken(line: string): string {
  return line
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits a paragraph into sentence-sized pieces, none much longer than a breath. */
function sentences(text: string): string[] {
  const parts: string[] = [];
  let piece = '';
  for (const sentence of text.split(/(?<=[.!?…]["”’')\]]*)\s+/)) {
    if (!sentence) continue;
    if (piece && piece.length + sentence.length > MAX) {
      parts.push(piece);
      piece = '';
    }
    piece = piece ? `${piece} ${sentence}` : sentence;
    if (piece.length >= MAX) {
      parts.push(piece);
      piece = '';
    }
  }
  if (piece) parts.push(piece);
  return parts;
}

/** The sheet as pieces to read, in order. Comments and empty lines are skipped. */
export function piecesOf(text: string): Piece[] {
  const pieces: Piece[] = [];
  // Comments are blanked out rather than removed, so every position still lines up with the sheet.
  const blanked = withoutComments(text).length === text.length ? text : text.replace(/<!--[\s\S]*?(-->|$)/g, (c) => ' '.repeat(c.length));
  let at = 0;
  for (const paragraph of blanked.split(/\n\s*\n/)) {
    const say = paragraph.split('\n').map(spoken).filter(Boolean).join(' ');
    if (say) {
      let offset = at + (paragraph.length - paragraph.trimStart().length);
      for (const part of sentences(say)) {
        pieces.push({ at: offset, say: part });
        offset += part.length;
      }
    }
    at += paragraph.length + 2;
  }
  return pieces;
}

/** Where to start reading for a cursor at `pos`: the piece it's in, or the next one. */
export function pieceAt(pieces: Piece[], pos: number): number {
  let index = 0;
  for (let i = 0; i < pieces.length; i++) if (pieces[i]!.at <= pos) index = i;
  return index;
}

type State = { index: number; total: number; speaking: boolean; paused: boolean };

/**
 * Reads pieces one at a time. One at a time (rather than queueing them all)
 * keeps stopping instant and the progress honest.
 */
export class Reader {
  private pieces: Piece[] = [];
  private index = 0;
  private stopped = true;
  private paused = false;

  constructor(private onChange: (state: State) => void) {}

  get state(): State {
    return { index: this.index, total: this.pieces.length, speaking: !this.stopped, paused: this.paused };
  }

  start(pieces: Piece[], from = 0): void {
    this.stop();
    if (!canSpeak() || pieces.length === 0) return;
    this.pieces = pieces;
    this.index = Math.max(0, Math.min(from, pieces.length - 1));
    this.stopped = false;
    this.paused = false;
    this.speak();
  }

  private speak(): void {
    const piece = this.pieces[this.index];
    if (this.stopped || !piece) return this.stop();
    const utterance = new SpeechSynthesisUtterance(piece.say);
    utterance.onend = () => {
      if (this.stopped) return;
      this.index += 1;
      if (this.index >= this.pieces.length) this.stop();
      else this.speak();
    };
    utterance.onerror = () => this.stop();
    window.speechSynthesis.speak(utterance);
    this.onChange(this.state);
  }

  pause(): void {
    if (this.stopped || this.paused) return;
    this.paused = true;
    window.speechSynthesis.pause();
    this.onChange(this.state);
  }

  resume(): void {
    if (this.stopped || !this.paused) return;
    this.paused = false;
    window.speechSynthesis.resume();
    this.onChange(this.state);
  }

  stop(): void {
    const wasReading = !this.stopped;
    this.stopped = true;
    this.paused = false;
    if (canSpeak()) window.speechSynthesis.cancel();
    if (wasReading) this.onChange(this.state);
  }
}
