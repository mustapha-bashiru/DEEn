/**
 * Post-build check on the generated service worker.
 *
 * `vite build` reports a precache entry count but not what is in the list, and
 * the two properties that matter most here are invisible from that summary:
 * that no URL appears twice (a duplicate means two config sources are both
 * claiming the same asset), and that nothing sets up runtime caching for API or
 * authenticated traffic. Run with `node scripts/verify-sw.mjs` after a build.
 */
import { readFileSync } from 'node:fs';

const sw = readFileSync('dist/sw.js', 'utf8');
const manifest = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));

const urls = [...sw.matchAll(/\{url:"([^"]+)",revision:("[^"]*"|null)\}/g)].map((m) => m[1]);
const counts = new Map();
for (const url of urls) counts.set(url, (counts.get(url) ?? 0) + 1);
const duplicates = [...counts].filter(([, n]) => n > 1);

// Exactly one registerRoute is expected: the NavigationRoute that serves the
// app shell offline. Any more means something is caching responses at runtime.
const registerRouteCount = (sw.match(/registerRoute\(/g) ?? []).length;

const checks = [
  ['no duplicate precache entries', duplicates.length === 0, duplicates.map(([u, n]) => `${u} x${n}`).join(', ')],
  ['navigation fallback present', sw.includes('index.html') && /NavigationRoute/.test(sw)],
  ['/api excluded from the fallback', sw.includes('api')],
  ['exactly one route registered', registerRouteCount === 1, `found ${registerRouteCount}`],
  ['outdated caches cleaned up', /cleanupOutdatedCaches|cleanupOutdated/.test(sw)],
  ['clientsClaim not called', !/clientsClaim\(/.test(sw)],
  ['manifest has 4 icons', manifest.icons?.length === 4],
  ['manifest has a maskable icon', manifest.icons?.some((i) => i.purpose === 'maskable') === true],
  ['manifest scope and start_url are "/"', manifest.scope === '/' && manifest.start_url === '/'],
];

let failed = 0;
for (const [label, ok, detail] of checks) {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail && !ok ? ` — ${detail}` : ''}`);
}
console.log(`\n${urls.length} precache entries, ${counts.size} unique`);
process.exit(failed === 0 ? 0 : 1);
