/**
 * Generates `types/database.ts` from the running local Supabase schema, or verifies
 * that the committed file still matches it.
 *
 *   node scripts/gen-db-types.mjs            regenerate
 *   node scripts/gen-db-types.mjs --check    fail on drift, change nothing
 *
 * Wrapping the CLI in a script rather than shelling out to
 * `supabase gen types typescript --local > types/database.ts` fixes two real
 * problems with that one-liner:
 *
 *   1. The shell creates and truncates the target *before* running the command, so
 *      a failed generation — stack not started, migration error — leaves an empty
 *      committed file. Here nothing is written unless generation succeeded and
 *      produced plausible output.
 *   2. It gives `--check` somewhere to live. A generated file that nothing verifies
 *      drifts from the schema, and then every type in it is a lie that typechecks.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const TARGET = 'types/database.ts';
const check = process.argv.includes('--check');

const BANNER = `/**
 * Generated from the local Supabase schema. Do not edit.
 *
 * Regenerate with \`npm run db:types\` after adding a migration.
 * \`npm run db:types:check\` fails if this file and the schema disagree.
 */
`;

// `shell: true` because on Windows the CLI resolves to node_modules/.bin/supabase.cmd,
// which cannot be spawned directly. There is no interpolated input in the command.
const result = spawnSync('supabase gen types typescript --local', {
  shell: true,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});

if (result.error) {
  console.error(`FAIL could not run the Supabase CLI — ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`FAIL supabase gen types exited ${result.status}`);
  // The CLI's own diagnostics are the useful part: usually "supabase start is not
  // running" or a migration that will not apply.
  if (result.stderr?.trim()) console.error(result.stderr.trim());
  process.exit(1);
}

const generated = (result.stdout ?? '').trim();

/*
 * A successful exit with unusable output is possible — an empty schema, or a CLI
 * that printed a warning to stdout instead of stderr. Overwriting a good file with
 * that is worse than failing, so the shape is checked before anything is written.
 */
if (!generated.includes('export type Database') || generated.length < 200) {
  console.error(
    'FAIL generation produced no Database type. Is the local stack running (`npm run db:start`)?',
  );
  process.exit(1);
}

const expected = `${BANNER}\n${generated}\n`;

if (check) {
  let current;
  try {
    current = readFileSync(TARGET, 'utf8');
  } catch {
    console.error(`FAIL ${TARGET} does not exist. Run \`npm run db:types\` and commit it.`);
    process.exit(1);
  }

  // Newline normalisation, because git may check the file out with CRLF on Windows
  // while the CLI always emits LF. That difference is not drift.
  const normalise = (text) => text.replace(/\r\n/g, '\n').trimEnd();

  if (normalise(current) !== normalise(expected)) {
    console.error(
      `FAIL ${TARGET} is out of date with the database schema.\n` +
        '     Run `npm run db:types` and commit the result.',
    );
    process.exit(1);
  }

  console.log(`ok   ${TARGET} matches the schema`);
  process.exit(0);
}

mkdirSync(dirname(TARGET), { recursive: true });
writeFileSync(TARGET, expected, 'utf8');
console.log(`ok   wrote ${TARGET} (${expected.length} bytes)`);
