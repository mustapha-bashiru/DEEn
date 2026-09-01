/**
 * Post-build check that no server-only credential reached the browser bundle.
 *
 * The ESLint `no-restricted-imports` rules are the first line of defence and catch
 * the ordinary mistake — a client module importing `api/_lib`. This is the backstop
 * for everything that rule cannot see: a secret pasted into a component, a
 * `VITE_`-prefixed variable that should never have had the prefix, a rule someone
 * disabled with an inline comment, or a value inlined by a `define`.
 *
 * It reads `dist/` rather than source, so it asserts the property that actually
 * matters: what a visitor can download. Run with `node scripts/verify-bundle.mjs`
 * after a build; `npm run build` does it automatically.
 *
 * Step 4 extends this to the Gemini key, once that key stops being deliberately
 * inlined. Until then a check for it would fail every build by design.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';

/** Text-ish files only. Fonts and images cannot contain an inlined variable. */
const SCANNED = /\.(js|mjs|cjs|css|html|json|webmanifest|map|txt)$/i;

const walk = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (SCANNED.test(entry)) out.push(path);
  }
  return out;
};

let files;
try {
  files = walk(DIST);
} catch {
  console.error(`FAIL cannot read ${DIST}/ — run \`npm run build\` first`);
  process.exit(1);
}

const contents = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));

/** Returns the files containing `needle`, or [] when there is nothing to look for. */
const findLiteral = (needle) => {
  if (!needle || needle.length < 12) return [];
  return [...contents].filter(([, text]) => text.includes(needle)).map(([f]) => f);
};

const findPattern = (pattern) =>
  [...contents].filter(([, text]) => pattern.test(text)).map(([f]) => f);

/*
 * The exact value from the environment, when it is present. This is the check that
 * catches a key pasted into source: the string is compared, not a shape, so it
 * fires regardless of how the value got there.
 *
 * When the variable is unset — a CI build without secrets — this check cannot run.
 * It reports as skipped rather than passing, because "we looked and found nothing"
 * and "we did not look" are different results and only one of them is reassuring.
 */
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
const serviceKeyHits = findLiteral(serviceKey);

/*
 * Shape-based checks, which work with no environment at all.
 *
 * A Supabase service_role JWT is a base64url payload containing
 * `"role":"service_role"`. The middle segment is not encrypted, so the decoded
 * marker can be matched directly, and so can the encoded form in case the token
 * appears whole.
 */
const SERVICE_ROLE_JWT = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g;
const jwtCandidates = new Map();
for (const [file, text] of contents) {
  for (const token of text.match(SERVICE_ROLE_JWT) ?? []) {
    const payload = token.split('.')[1];
    try {
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (decoded.role === 'service_role') jwtCandidates.set(file, decoded.role);
    } catch {
      // Not a JWT after all — a base64 asset or a hash that matched the shape.
    }
  }
}

/*
 * Note on what is deliberately *not* checked: the bare string `service_role`.
 *
 * `config/env.ts` compares the anon key's role claim against that literal in order
 * to warn a developer who pasted the wrong key, so the string legitimately ships in
 * the bundle. Failing on it would mean deleting a safety check to satisfy a safety
 * check. The JWT decode above is the real test — it looks for a *credential* whose
 * role is service_role, which is the thing that would actually be exploitable.
 */

const serverOnlyNames = /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_PASSWORD|SUPABASE_JWT_SECRET/;
const secretKeyShape = /sb_secret_[A-Za-z0-9_-]{8,}/;

const nameHits = findPattern(serverOnlyNames);
const secretKeyHits = findPattern(secretKeyShape);

const checks = [
  [
    'SUPABASE_SERVICE_ROLE_KEY value absent from dist/',
    serviceKeyHits.length === 0,
    serviceKeyHits.join(', '),
    serviceKey.length === 0 ? 'not set in this environment — nothing to compare' : null,
  ],
  [
    'no service_role JWT in dist/',
    jwtCandidates.size === 0,
    [...jwtCandidates.keys()].join(', '),
  ],
  ['no sb_secret_ key in dist/', secretKeyHits.length === 0, secretKeyHits.join(', ')],
  [
    // Named individually because a shape check cannot recognise these, and a
    // future step adding one of them to the client would otherwise pass silently.
    'no server-only variable names in dist/',
    nameHits.length === 0,
    nameHits.join(', '),
  ],
];

let failed = 0;
let skipped = 0;
for (const [label, ok, detail, skipReason] of checks) {
  if (skipReason) {
    skipped++;
    console.log(`skip ${label} — ${skipReason}`);
    continue;
  }
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail && !ok ? ` — ${detail}` : ''}`);
}

console.log(
  `\n${contents.size} files scanned in ${DIST}/, ${failed} failed, ${skipped} skipped`,
);
process.exit(failed === 0 ? 0 : 1);
