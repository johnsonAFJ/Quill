// Builds the app icons from design/quill-icon-square.svg: the icon as a full
// square, because iPhone, iPad and Mac round the corners themselves (and
// fill see-through corners with black). Chrome draws the SVG, including its
// paper grain, and macOS's `sips` scales it to each size.
//
//   npm run icons

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = resolve('design/quill-icon-square.svg');
const OUT_DIR = 'public/icons';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MASTER = `${OUT_DIR}/icon-1024.png`;

// [file, size]
const SIZES = [
  ['icon-512.png', 512], // large icon
  ['icon-192.png', 192], // install prompts
  ['icon-180.png', 180], // iPhone and iPad home screen
  ['favicon-32.png', 32], // browser tab
];

mkdirSync(OUT_DIR, { recursive: true });
execFileSync(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--window-size=1024,1024',
  `--screenshot=${resolve(MASTER)}`,
  `file://${SOURCE}`,
]);
for (const [file, size] of SIZES) {
  execFileSync('sips', ['-z', String(size), String(size), MASTER, '--out', `${OUT_DIR}/${file}`], { stdio: 'ignore' });
  console.log(`${OUT_DIR}/${file}`);
}
rmSync(`${OUT_DIR}/icon-maskable-512.png`, { force: true });
rmSync(MASTER);
