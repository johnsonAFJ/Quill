// Draws the app icon (a cream "Q" on rust) at every size the home screen needs.
// No image editor or extra packages: shapes are computed per pixel with 4x4
// supersampling for smooth edges, then written as PNG.
//
//   npm run icons

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT_DIR = 'public/icons';
const BG = [181, 86, 47];
const INK = [247, 245, 240];

// [file, size, how much of the canvas the mark fills]
const SIZES = [
  ['icon-180.png', 180, 1],           // iPhone and iPad home screen
  ['icon-192.png', 192, 1],           // install prompts
  ['icon-512.png', 512, 1],           // large icon
  ['icon-maskable-512.png', 512, 0.75], // launchers that crop to a circle need extra margin
];

// Coverage of the "Q" at a point in a unit square (0..1 both ways).
function inMark(x, y, scale) {
  const cx = 0.5, cy = 0.48;
  const px = (x - cx) / scale, py = (y - cy) / scale;
  const r = Math.hypot(px, py);
  const ring = r > 0.2 && r < 0.29;
  // Tail: a thick stroke from inside the ring down to the lower right.
  const ax = 0.04, ay = 0.08, bx = 0.3, by = 0.34;
  const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  const dx = px - (ax + t * (bx - ax)), dy = py - (ay + t * (by - ay));
  const tail = Math.hypot(dx, dy) < 0.05;
  return ring || tail;
}

function draw(size, scale) {
  const S = 4;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          if (inMark((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size, scale)) hits++;
        }
      }
      const a = hits / (S * S);
      for (let c = 0; c < 3; c++) row[1 + x * 3 + c] = Math.round(BG[c] * (1 - a) + INK[c] * a);
    }
    rows.push(row);
  }
  return encodePng(size, size, Buffer.concat(rows));
}

// ---- Minimal PNG writing: 8-bit RGB ----

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [file, size, scale] of SIZES) {
  writeFileSync(`${OUT_DIR}/${file}`, draw(size, scale));
  console.log(`${OUT_DIR}/${file}`);
}
