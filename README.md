111# SebilLink

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
| Tests | Vitest + Testing Library, Playwright |
| Persistence | Browser `localStorage` |

Planned, not yet present — see the [implementation plan](.kilo/plans/1788175454017-sebillink-super-app-plan.md):

| Layer | Choice |
| --- | --- |
| Routing | React Router with role-aware layouts |
| Backend | Vercel serverless functions under `/api` |
| Database / auth | Supabase (Postgres, Auth, Storage, Realtime, RLS) |
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

### Install and run

```bash
git clone https://github.com/mustapha-bashiru/DEEn.git
cd DEEn
npm install
cp .env.example .env.local   # then add your key
npm run dev
```

The dev server listens on http://localhost:3000.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check, then production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint over all sources |
| `npm run lint:fix` | ESLint with autofix |
| `npm test` | Vitest unit and component tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run generate:icons` | Rebuild PWA raster icons from `public/icon.svg` |

## Environment variables

Copy `.env.example` to `.env.local` — every `.env*` file except `.env.example`
is git-ignored. Missing or malformed values are reported at startup by
`config/env.ts` rather than failing deep inside a feature.

| Variable | Required | Exposure |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | **Server-only** — but currently inlined into the browser bundle. See the warning below. |

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
├── config/
│   ├── env.ts               # Environment validation and typed access
│   └── storage.ts           # localStorage keys + legacy key migration
├── services/
│   └── geminiService.ts     # All Gemini calls — split in plan step 4
├── constants.ts             # System instruction, model IDs
├── translations.ts          # en / ar / ha / fr strings
├── types.ts                 # Shared domain types
├── public/                  # PWA icons, static assets
├── scripts/                 # Build-time utilities
└── .kilo/plans/             # Implementation plan
```

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
sent to a backend, because there is no backend yet.

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
- Any backend, database, or row-level security
- Restaurants, mosques, menus, QR storefronts, carts, orders, delivery
- Paystack payments, donations, refunds, receipts
- Loyalty points, reviews, moderation, community posts
- Google Maps rendering and server-side delivery validation

### Roadmap

Sequenced by the [implementation plan](.kilo/plans/1788175454017-sebillink-super-app-plan.md):

| # | Step | Status |
| --- | --- | --- |
| 1 | Stabilize the application (build, lint, tests, env, PWA) | ✅ done |
| 2 | Supabase schema, RLS, and `/api` foundations | ⬜ |
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
