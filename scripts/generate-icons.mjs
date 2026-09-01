/**
 * Generates the PWA raster icons from a single vector source.
 *
 * Run with `npm run generate:icons`. Outputs are committed, so this only needs
 * re-running when the mark changes.
 *
 * The mark is the SebilLink concept: a curving road ("sebil" — the path) rising
 * toward a crescent and star.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const BRAND_BLUE = '#3b82f6';
const ROAD = 'M 30 92 C 40 70 64 70 54 46';

/** Circle the crescent is cut from, and the circle that cuts it. */
const CRESCENT = { cx: 66, cy: 26, r: 14 };
const CRESCENT_CUT = { cx: 73.5, cy: 18.5, r: 12.3 };

/** Five-pointed star, first point aimed straight up. */
const starPath = (cx, cy, outer, inner) => {
  const points = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M ${points.join(' L ')} Z`;
};

/**
 * @param mark   colour of the road, crescent, and star
 * @param inset  colour of the road centre-line dashes (must read against `mark`)
 * @param scale  1 fills the canvas; <1 shrinks the mark for maskable safe zones
 */
const markup = (mark, inset, scale = 1) => {
  const offset = ((100 - 100 * scale) / 2).toFixed(2);
  return `
    <defs>
      <!--
        A crescent is a subtraction, not a symmetric difference, so fill-rule
        cannot express it: the cutting circle extends past the outer circle's
        edge, and evenodd would fill that overhang back in as a ring.
      -->
      <mask id="crescent" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
        <rect x="0" y="0" width="100" height="100" fill="black"/>
        <circle cx="${CRESCENT.cx}" cy="${CRESCENT.cy}" r="${CRESCENT.r}" fill="white"/>
        <circle cx="${CRESCENT_CUT.cx}" cy="${CRESCENT_CUT.cy}" r="${CRESCENT_CUT.r}" fill="black"/>
      </mask>
    </defs>
    <g transform="translate(${offset} ${offset}) scale(${scale})">
      <path d="${ROAD}" stroke="${mark}" stroke-width="14" stroke-linecap="round" fill="none"/>
      <path d="${ROAD}" stroke="${inset}" stroke-width="2.2" stroke-linecap="round"
            stroke-dasharray="4 8" opacity="0.75" fill="none"/>
      <circle cx="${CRESCENT.cx}" cy="${CRESCENT.cy}" r="${CRESCENT.r}"
              fill="${mark}" mask="url(#crescent)"/>
      <path fill="${mark}" d="${starPath(81, 11, 6, 2.6)}"/>
    </g>`;
};

const svg = ({ size, mark, inset, background = null, scale = 1, radius = 0 }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  ${background ? `<rect width="100" height="100" rx="${radius}" fill="${background}"/>` : ''}
  ${markup(mark, inset, scale)}
</svg>`;

const targets = [
  // Favicon: transparent, so it works on light and dark browser chrome.
  { file: 'icon.svg', svg: svg({ size: 100, mark: BRAND_BLUE, inset: '#ffffff' }), raster: false },
  {
    file: 'pwa-192x192.png',
    svg: svg({ size: 192, mark: '#ffffff', inset: BRAND_BLUE, background: BRAND_BLUE, radius: 18 }),
  },
  {
    file: 'pwa-512x512.png',
    svg: svg({ size: 512, mark: '#ffffff', inset: BRAND_BLUE, background: BRAND_BLUE, radius: 18 }),
  },
  {
    // Maskable icons get cropped to a circle or squircle; keep the mark inside
    // the 80% safe zone and let the background bleed to the edges.
    file: 'pwa-maskable-512x512.png',
    svg: svg({ size: 512, mark: '#ffffff', inset: BRAND_BLUE, background: BRAND_BLUE, scale: 0.62 }),
  },
  {
    // iOS ignores transparency and applies its own rounding.
    file: 'apple-touch-icon.png',
    svg: svg({ size: 180, mark: '#ffffff', inset: BRAND_BLUE, background: BRAND_BLUE, scale: 0.82 }),
  },
];

await mkdir(publicDir, { recursive: true });

for (const target of targets) {
  const destination = path.join(publicDir, target.file);

  if (target.raster === false) {
    await writeFile(destination, `${target.svg.trim()}\n`, 'utf8');
  } else {
    await sharp(Buffer.from(target.svg)).png({ compressionLevel: 9 }).toFile(destination);
  }

  console.log(`wrote public/${target.file}`);
}
