# SebilLink

A mosque and community super app for Ghana and Nigeria, built as a responsive
progressive web app.

> **Current state:** this repository is an early-stage build. What ships today is
> the Islamic AI assistant ("Sacred Sanctuary") — Gemini-powered chat, a Quran
> explorer, daily lessons with quizzes, a live voice session, generated sacred
> art, and a spiritual briefing. The marketplace, payments, and community
> features described in the roadmap are **not implemented yet**. See
> [Project status](#project-status) for exactly what exists.

## What SebilLink is being built into

One web app serving mosque-goers and local halal businesses:

- QR-code menus for restaurants near mosques
- An AI Islamic Q&A assistant with voice input
- Halal food ordering — pickup and vendor-managed delivery
- Donations to verified mosques
- Per-restaurant loyalty points
- Verified-organization announcements and events, plus verified-order reviews
- Prayer times and a mosque locator

Two decisions worth stating up front, because they constrain the whole design:

- **SebilLink never holds customer funds.** Payments use Paystack split
  settlement directly to verified organization subaccounts. The "wallet" is a
  payment/donation/refund history and receipt archive — there is no stored cash
  balance, no transfers, and no withdrawals.
- **Rewards have no cash value.** Points are non-transferable, non-withdrawable,
  and scoped to the individual restaurant that issued them.

## Tech stack

Present in this repository today:

| Layer | Choice |
| --- | --- |
| UI | React 19 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS 3 (Vite-integrated) |
| AI | Google Gemini via `@google/genai` |
| PWA | `vite-plugin-pwa` (Workbox) |
| Tests | Vitest + Testing Library, Playwright, pgTAP |
| Database | Supabase Postgres — schema, row-level security, storage buckets |
| Backend | Vercel serverless functions under `/api` |
| Persistence (client) | Browser `localStorage` |

The last two rows are **foundations, not integrations.** The database schema and the
`/api` request pipeline exist and are tested, but no component calls them yet: the
app still runs entirely on `localStorage`, and identity is still fabricated in the
browser. Step 3 connects auth, step 4 moves Gemini behind `/api`.

Planned, not yet present — see the implementation plan in `.kilo/plans/` (untracked,
so it is not in a fresh clone):

| Layer | Choice |
| --- | --- |
| Routing | React Router with role-aware layouts |
| Payments | Paystack split payments |
| Maps | Google Maps / Places / Geocoding / Routes |
| Hosting | Vercel |

There is **no Flutter, Firebase, Express, Stripe, or Razorpay code** in this
repository. Earlier revisions of this README described such a stack; that was
never accurate and has been corrected.

## Getting started

### Prerequisites

- Node.js 20.19+ or 22.12+ (developed on 24.x)
- npm 10+
- A Google Gemini API key — https://aistudio.google.com/apikey
- **Optional:** Docker Desktop, for the local Supabase stack. Only needed to work on
  the database or `/api`; the app itself runs without it.

### Install and run

```bash
git clone https://github.com/mustapha-bashiru/DEEn.git
cd DEEn
npm install
cp .env.example .env.local   # then add your Gemini key
npm run dev
```

The dev server listens on http://localhost:3000. That is all you need to work on the
UI — see [Database and server foundations](#database-and-server-foundations) for the
backend.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check, build to `dist/`, then verify the service worker and scan for leaked secrets |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc` over the client project and the `api/` project |
| `npm run lint` | ESLint over all sources |
| `npm run lint:fix` | ESLint with autofix |
| `npm test` | Vitest unit and component tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run test:rls` | pgTAP row-level-security suite (needs the local stack) |
| `npm run db:start` / `db:stop` | Start / stop the local Supabase stack |
| `npm run db:reset` | Drop and re-apply every migration, then the seed |
| `npm run db:types` | Regenerate `types/database.ts` from the live schema |
| `npm run db:types:check` | Fail if `types/database.ts` has drifted from the schema |
| `npm run verify:bundle` | Assert no server-only credential is in `dist/` |
| `npm run generate:icons` | Rebuild PWA raster icons from `public/icon.svg` |

## Environment variables

Copy `.env.example` to `.env.local` — every `.env*` file except `.env.example`
is git-ignored. Missing or malformed values are reported at startup by
`config/env.ts` rather than failing deep inside a feature.

| Variable | Required | Exposure |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | **Server-only** — but currently inlined into the browser bundle. See the warning below. |
| `VITE_SUPABASE_URL` | for `/api` | Browser. The project API URL. |
| `VITE_SUPABASE_ANON_KEY` | for `/api` | Browser. Public by design — row-level security is what protects the data. |
| `SUPABASE_SERVICE_ROLE_KEY` | for `/api` | **Server-only.** Bypasses row-level security entirely. |

`npm run db:start` prints all three Supabase values; `npx supabase status` shows them
again later.

Two guards exist because the failure modes here are quiet rather than loud:

- `config/env.ts` and `api/_lib/env.ts` both check whether the `service_role` key has
  been pasted into an anon slot. That mistake does not break anything — it works, and
  publishes a full-access database credential to every visitor.
- `scripts/verify-bundle.mjs` runs as part of `npm run build` and fails it if a
  service-role credential appears anywhere in `dist/`.

### ⚠️ The Gemini key is currently exposed to the browser

`vite.config.ts` inlines `GEMINI_API_KEY` into the client bundle so that
`services/geminiService.ts` can call Gemini directly from the browser. **Anyone
who loads the app can extract that key from the JavaScript.**

This is a known, tracked defect, not a design choice. Until step 4 of the
implementation plan moves Gemini behind Vercel functions:

- Use a **development-only key** with a low quota cap.
- Do **not** deploy this build publicly with a key you care about.
- Restrict the key in Google AI Studio wherever possible.

Once step 4 lands, the key becomes genuinely server-only and the browser will
talk to `/api` endpoints that enforce per-user quotas.

## Project structure

```
DEEn/
├── App.tsx                  # Root component: state, layout, view switching
├── index.tsx                # Entry point: env validation, storage migration, mount
├── index.css                # Tailwind entry, CSS variables, base styles
├── components/              # Feature UI (13 components)
│   ├── AuthScreen.tsx           # Simulated auth — replaced in plan step 3
│   ├── ChatInterface.tsx        # Main AI chat
│   ├── QuranExplorer.tsx        # Surah/ayah browser with tafsir
│   ├── SacredArts.tsx           # Gemini image and video generation
│   ├── LiveSessionOverlay.tsx   # Voice AI session
│   ├── QuizOverlay.tsx          # Daily lesson assessment
│   ├── SpiritualBriefingOverlay.tsx  # Prayer times, Hijri date, daily verse
│   ├── BookmarksLibrary.tsx     # Saved sessions
│   ├── ArticlePreviewOverlay.tsx
│   ├── DiscoveryOverlay.tsx
│   ├── ProfileOverlay.tsx
│   ├── SettingsOverlay.tsx
│   └── Sidebar.tsx
├── api/                     # Vercel serverless functions
│   ├── _lib/                    # Request pipeline — see the section below
│   └── health.ts                # GET /api/health
├── supabase/
│   ├── config.toml              # Local stack ports and auth settings
│   ├── migrations/              # Ordered schema + RLS policies
│   ├── seed.sql                 # pgTAP helpers; local and CI only
│   └── tests/rls/               # Row-level-security assertions
├── config/
│   ├── env.ts               # Environment validation and typed access
│   └── storage.ts           # localStorage keys + legacy key migration
├── services/
│   └── geminiService.ts     # All Gemini calls — split in plan step 4
├── types/
│   └── database.ts          # Generated from the schema; do not edit
├── constants.ts             # System instruction, model IDs
├── translations.ts          # en / ar strings
├── types.ts                 # Shared domain types
├── public/                  # PWA icons, static assets
├── scripts/                 # Build-time utilities and verification checks
└── .kilo/plans/             # Implementation plan (untracked)
```

## Database and server foundations

Nothing in this section is reachable from the UI yet. It is the ground steps 3 and 4
build on.

### Running the stack

```bash
npm run db:start     # first run pulls container images; give it a few minutes
npm run db:reset     # apply every migration from scratch, then the seed
npm run test:rls     # pgTAP suite
npm run db:types     # regenerate types/database.ts
```

`npm run db:start` prints the API URL and both keys. Studio is at
http://127.0.0.1:54323. `npm run db:stop` shuts it down.

### Schema

Fifteen tables across three groups, each defined in a migration that also contains
its own row-level-security policies — a reviewer reading one file sees the table, its
constraints, and who can reach it, rather than hunting for a policies-only migration.

| Group | Tables |
| --- | --- |
| identity | `profiles`, `user_roles`, `addresses`, `user_preferences`, `consents` |
| ai / content | `chat_sessions`, `chat_messages`, `bookmarks`, `quiz_progress`, `generated_media`, `ai_usage` |
| operations | `audit_logs`, `idempotency_keys`, `webhook_events`, `notifications` |

Organizations, marketplace, money, community, and rewards tables are deliberately
deferred to the steps that consume them (5, 7, 8, 10, 11). Landing them now would
mean writing policies that could only be asserted against synthetic fixtures.

Four schema decisions worth knowing before you extend it:

- **Roles live in `user_roles`, not in the JWT.** A role baked into a token goes
  stale — a grant would not take effect until the user signed in again. Policies read
  it through `app.has_role()`, a `security definer` function that pins
  `search_path = ''`. `user_roles`' own policy must never call that helper, or it
  recurses; it uses a plain `user_id = auth.uid()` self-read instead.
- **`profiles` has no email column.** `auth.users.email` is the single source of
  truth, which removes an entire class of sync triggers and guard policies, and means
  an email change goes through Supabase's verification flow rather than around it.
- **`audit_logs`, `idempotency_keys`, and `webhook_events` have RLS enabled and no
  policies at all.** RLS denies whatever no policy permits, so an empty policy set is
  a complete deny. Not even an admin reads the audit log through PostgREST — admin
  views will call `/api`, which uses the service role. The absence of a policy in
  those files is the security control, not an omission.
- **`ai_usage` stores no prompts.** One append-only row per billable operation, with
  `(user_id, kind, created_at)` indexed for the windowed quota counting step 4 needs.

### Row-level-security tests

`supabase/tests/rls/` asserts what each role *cannot* reach, which is the half that
matters and the half that silently regresses. Three semantics make these tests read
strangely if you are not expecting them:

- A blocked `SELECT`, `UPDATE`, or `DELETE` is **silent** — the policy filters rows
  out, so the assertion is "zero rows", never an error.
- A blocked `INSERT` **raises** `42501`.
- A check-constraint violation raises `23514`, and a unique violation `23505`.

Impersonation needs both `set_config('role', …)` and
`set_config('request.jwt.claims', …)`. Setting only the claims leaves the session as
superuser, which bypasses RLS — and then every test passes while proving nothing.

The helpers live in `supabase/seed.sql` rather than a migration, because
`supabase db push` does not run seeds. A migration would ship test helpers to
production; a `*.test.sql` file would have them rolled back by the per-test
transaction.

> **When changing a policy, verify the test can fail.** Comment out the `using`
> clause you are editing, confirm the matching assertion goes red, then restore it. A
> policy suite that passes against no policies is worthless.

### The `/api` pipeline

```
api/_lib/
├── errors.ts         # ApiError + the safe response envelope
├── correlation.ts    # one request id, echoed in the response and stored in audit rows
├── env.ts            # server env validation; catches both anon/service key swaps
├── supabase.ts       # user client (RLS applies) + service client (bypasses it)
├── auth.ts           # bearer token -> { userId, roles, db }
├── handler.ts        # withHandler(): method routing, zod parse, auth, errors
└── idempotency.ts    # claim / replay by key
```

Every endpoint is a `withHandler({ methods, schema, auth, handler })`. The wrapper
sets the correlation header before anything can fail, marks the response `no-store`,
answers `OPTIONS`, sends `405` with an `Allow` header, validates input, authenticates,
and converts anything thrown into a safe envelope.

The rule the envelope exists to enforce: **a message reaches the client only if a
developer wrote it.** Provider errors are informative and dangerous — a Postgres error
names columns and constraints, a Gemini error quotes the prompt that tripped a safety
filter, a connection failure carries the host and credentials. So `toErrorBody` has
exactly two paths: an `ApiError`, whose message was authored deliberately, and
anything else, which becomes one fixed generic string. The real error goes to the log
with the correlation id.

Two boundaries are enforced by ESLint rather than convention: `api/**` may not import
from `config/`, and client code may not import from `api/_lib`. Either direction drags
a secret or a browser global into the wrong runtime. `api/**` is also typechecked by
`tsconfig.api.json`, which removes the DOM lib so a server function referencing
`window` is a compile error rather than a runtime one.

`npm run dev` stays frontend-only — nothing in the client calls `/api` yet, so a local
API runtime would be a second thing to keep in agreement with Vercel's. Handlers are
covered by unit tests in `tests/api/`; use `vercel dev` for manual work:

```bash
npx vercel dev            # then:
curl -i localhost:3000/api/health
```

`/api/health` returns `200` with coarse `ok` booleans, or `503` when degraded. It
deliberately does not say *what* is wrong: it is unauthenticated, so which variable is
missing and what Postgres said go to the server log against the correlation id.

## AI behaviour and limitations

The assistant answers through an Islamic lens and adapts to the user's selected
sect (Sunni / Shia) and madhab. For contested matters it is instructed to act as
a neutral rapporteur — presenting the positions and their evidences rather than
issuing a single ruling.

**It is not a mufti.** Answers are generated by a language model and can be
wrong, incomplete, or missing important context. For any personal ruling,
consult a qualified scholar. Prayer times shown in the briefing are
model-estimated approximations; step 10 of the plan replaces them with
mosque-provided authoritative schedules.

Video generation (Veo) and live voice sessions consume significant quota. On the
Gemini free tier these will rate-limit quickly.

## Data storage

All user data currently lives in the browser under `sebillink_*` keys — chats,
bookmarks, progress, preferences, and the simulated user profile. Nothing is
sent to a backend: the database and `/api` foundations exist, but no component calls
them yet.

Keys from earlier builds (`sanctuary_*`, `sabil_*`) are copied forward
automatically on first load. The originals are left in place, so downgrading
does not lose data.

Clearing site data erases everything. Plan step 3 adds Supabase-backed accounts
with a one-time import of existing local data.

## Project status

**Implemented**

- Gemini chat with sect/madhab-aware system instruction, Google Search and Maps
  grounding, attachments, and streaming-free retry with backoff
- Quran explorer, daily "Legacy of Knowledge" lesson with generated quiz and XP
- Live voice session, sacred art image/video generation, spiritual briefing
- Multilingual UI with RTL support, light/dark/system themes
- Installable PWA with offline app-shell fallback

**Not implemented** — the entire commerce and community surface

- Real authentication (`AuthScreen.tsx` fabricates a user object client-side)
- Any client use of the database — the schema and RLS exist, nothing calls them
- Restaurants, mosques, menus, QR storefronts, carts, orders, delivery
- Paystack payments, donations, refunds, receipts
- Loyalty points, reviews, moderation, community posts
- Google Maps rendering and server-side delivery validation

### Roadmap

Sequenced by the implementation plan in `.kilo/plans/` (untracked, so it is not in a
fresh clone):

| # | Step | Status |
| --- | --- | --- |
| 1 | Stabilize the application (build, lint, tests, env, PWA) | ✅ done |
| 2 | Supabase schema, RLS, and `/api` foundations | 🟡 |
| 3 | Replace simulated auth with Supabase Auth | ⬜ |
| 4 | Move Gemini behind protected server APIs | ⬜ |
| 5 | Organization onboarding and admin verification | ⬜ |
| 6 | Public discovery and maps | ⬜ |
| 7 | Restaurant catalog, QR menus, cart, checkout | ⬜ |
| 8 | Paystack integration and payment ledger | ⬜ |
| 9 | Vendor-managed fulfillment | ⬜ |
| 10 | Mosque pages, donations, community | ⬜ |
| 11 | Per-restaurant rewards | ⬜ |
| 12 | Production readiness, CI, staged rollout | ⬜ |

✅ done · 🟡 code landed, verification pending · ⬜ not started

Deliberately out of scope: stored-value wallets, peer-to-peer transfers,
platform-dispatched couriers, an unrestricted social feed, native mobile apps,
and markets beyond Ghana and Nigeria at launch.

## Contributing

1. Fork the project
2. Create a feature branch — `git checkout -b feature/AmazingFeature`
3. Make your change; `npm run typecheck && npm run lint && npm test` must pass
4. Commit — `git commit -m 'feat: add AmazingFeature'`
5. Push and open a pull request describing what changed and why

## License

Not yet licensed. Until a `LICENSE` file is added, default copyright applies and
no reuse rights are granted. An earlier README claimed MIT licensing without a
corresponding file; that claim has been removed rather than assumed.

## Contact

Mustapha Bashiru — mustaphabashiru442@gmail.com

## Acknowledgments

- Google Gemini
- The React and Vite communities
- Local mosque communities for the original inspiration
- Halal restaurant partners for early feedback
