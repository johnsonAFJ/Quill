// Seasonal looks: for a few weeks a year Quill changes the colours of the
// frame around your writing (the Library, the sheet list, the accents) and
// nothing else. The writing area never changes, and nothing moves or blinks.
//
// You can turn a season on any time to see it, switch seasons off for good,
// or skip just this year's.

export type SeasonId = 'halloween';

export type Season = {
  id: SeasonId;
  name: string;
  /** Inclusive window, as [month, day] with January = 1. */
  from: [number, number];
  to: [number, number];
  /** How the window reads in Settings. */
  when: string;
};

export const SEASONS: Season[] = [{ id: 'halloween', name: 'Halloween', from: [10, 15], to: [11, 1], when: 'October 15 to November 1' }];

/** Settings: follow the calendar, keep one on to look at it, or no seasons at all. */
export type SeasonChoice = 'auto' | 'on' | 'off';

const dayNumber = (month: number, day: number) => month * 100 + day;

/** Whether `date` falls inside the season's window (which may cross new year). */
export function inWindow(season: Season, date: Date): boolean {
  const today = dayNumber(date.getMonth() + 1, date.getDate());
  const from = dayNumber(...season.from);
  const to = dayNumber(...season.to);
  return from <= to ? today >= from && today <= to : today >= from || today <= to;
}

/** The mark that remembers a season was skipped, e.g. "halloween-2026". */
export function skipMark(season: Season, date: Date): string {
  // A window crossing new year belongs to the year it started in.
  const crossesYear = dayNumber(...season.from) > dayNumber(...season.to);
  const early = dayNumber(date.getMonth() + 1, date.getDate()) <= dayNumber(...season.to);
  return `${season.id}-${date.getFullYear() - (crossesYear && early ? 1 : 0)}`;
}

/** The season to show, given the setting and the ones skipped this year. */
export function seasonNow(date: Date, choice: SeasonChoice, skipped: string[] = []): Season | null {
  if (choice === 'off') return null;
  if (choice === 'on') return SEASONS[0] ?? null;
  return SEASONS.find((s) => inWindow(s, date) && !skipped.includes(skipMark(s, date))) ?? null;
}

/**
 * A line a day, from books old enough to be out of copyright. They're quoted,
 * not borrowed: each one is short and credited. Which one shows depends only
 * on the date, so every device shows the same line on the same day.
 */
export type Quote = { line: string; from: string };

export const QUOTES: Record<SeasonId, Quote[]> = {
  halloween: [
    { line: 'Deep into that darkness peering, long I stood there wondering, fearing.', from: 'Edgar Allan Poe, “The Raven”' },
    { line: 'All that we see or seem is but a dream within a dream.', from: 'Edgar Allan Poe, “A Dream Within a Dream”' },
    { line: 'It is the beating of his hideous heart!', from: 'Edgar Allan Poe, “The Tell-Tale Heart”' },
    { line: 'The thousand injuries of Fortunato I had borne as I best could.', from: 'Edgar Allan Poe, “The Cask of Amontillado”' },
    { line: 'Listen to them — the children of the night. What music they make!', from: 'Bram Stoker, Dracula' },
    { line: 'Welcome to my house! Enter freely and of your own free will.', from: 'Bram Stoker, Dracula' },
    { line: 'For the dead travel fast.', from: 'Bram Stoker, Dracula' },
    { line: 'The blood is the life.', from: 'Bram Stoker, Dracula' },
    { line: 'Beware; for I am fearless, and therefore powerful.', from: 'Mary Shelley, Frankenstein' },
    { line: 'I ought to be thy Adam, but I am rather the fallen angel.', from: 'Mary Shelley, Frankenstein' },
    { line: 'Nothing is so painful to the human mind as a great and sudden change.', from: 'Mary Shelley, Frankenstein' },
    // The line Ray Bradbury took his title from. His own words are still in copyright, so the witches get the credit.
    { line: 'By the pricking of my thumbs, something wicked this way comes.', from: 'William Shakespeare, Macbeth — later borrowed by Ray Bradbury' },
    { line: 'Double, double toil and trouble; fire burn and cauldron bubble.', from: 'William Shakespeare, Macbeth' },
    { line: 'There are more things in heaven and earth, Horatio, than are dreamt of in your philosophy.', from: 'William Shakespeare, Hamlet' },
    { line: 'Man is not truly one, but truly two.', from: 'Robert Louis Stevenson, Dr Jekyll and Mr Hyde' },
    { line: 'If he be Mr. Hyde, I shall be Mr. Seek.', from: 'Robert Louis Stevenson, Dr Jekyll and Mr Hyde' },
    { line: 'The dominant spirit that haunts this enchanted region is a figure on horseback without a head.', from: 'Washington Irving, “The Legend of Sleepy Hollow”' },
    { line: 'You are mine, you shall be mine, you and I are one for ever.', from: 'Sheridan Le Fanu, Carmilla' },
    { line: 'The story had held us, round the fire, sufficiently breathless.', from: 'Henry James, The Turn of the Screw' },
    { line: 'I wear the chain I forged in life.', from: 'Charles Dickens, A Christmas Carol' },
    { line: 'The oldest and strongest emotion of mankind is fear of the unknown.', from: 'H. P. Lovecraft, “Supernatural Horror in Literature”' },
    { line: 'That is not dead which can eternal lie, and with strange aeons even death may die.', from: 'H. P. Lovecraft, “The Call of Cthulhu”' },
    { line: 'Along the shore the cloud waves break, the twin suns sink behind the lake.', from: 'Robert W. Chambers, The King in Yellow' },
    { line: 'The faint figure behind seemed to shake the pattern, just as if she wanted to get out.', from: 'Charlotte Perkins Gilman, “The Yellow Wallpaper”' },
    { line: 'Once upon a midnight dreary, while I pondered, weak and weary.', from: 'Edgar Allan Poe, “The Raven”' },
    { line: 'Be with me always — take any form — drive me mad!', from: 'Emily Brontë, Wuthering Heights' },
    { line: 'And Darkness and Decay and the Red Death held illimitable dominion over all.', from: 'Edgar Allan Poe, “The Masque of the Red Death”' },
    { line: 'During the whole of a dull, dark, and soundless day in the autumn of the year, the clouds hung oppressively low.', from: 'Edgar Allan Poe, “The Fall of the House of Usher”' },
    { line: 'Ghost, n. The outward and visible sign of an inward fear.', from: 'Ambrose Bierce, The Devil’s Dictionary' },
    { line: 'A man stood upon a railroad bridge in northern Alabama, looking down into the swift water twenty feet below.', from: 'Ambrose Bierce, “An Occurrence at Owl Creek Bridge”' },
    { line: 'Quis est iste qui venit? — Who is this who is coming?', from: 'M. R. James, “Oh, Whistle, and I’ll Come to You, My Lad”' },
    { line: 'I beheld the wretch — the miserable monster whom I had created.', from: 'Mary Shelley, Frankenstein' },
    { line: 'As I wished, it twisted in my hand like a snake.', from: 'W. W. Jacobs, “The Monkey’s Paw”' },
    { line: 'My Faith is gone! There is no good on earth.', from: 'Nathaniel Hawthorne, “Young Goodman Brown”' },
    { line: 'Abandon all hope, ye who enter here.', from: 'Dante, Inferno (Longfellow’s translation)' },
    { line: 'It was a dark and stormy night.', from: 'Edward Bulwer-Lytton, Paul Clifford' },
  ],
};

/** The quote for this day: the same one all day, a new one tomorrow. */
export function quoteOfDay(season: Season, date: Date): Quote | null {
  const quotes = QUOTES[season.id];
  if (!quotes?.length) return null;
  const days = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return quotes[((days % quotes.length) + quotes.length) % quotes.length] ?? null;
}

/** Paints the frame, or puts it back to normal. */
export function applySeason(season: Season | null): void {
  if (season) document.documentElement.dataset.season = season.id;
  else delete document.documentElement.dataset.season;
}
