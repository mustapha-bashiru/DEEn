# SebilLink Super App Implementation Plan

## Goal and fixed decisions

Build the existing React/Vite repository into one responsive, production-capable web app deployed on Vercel, backed by Supabase and protected Vercel API functions.

- Initial markets: Ghana and Nigeria; country/currency behavior is configuration-driven (`GH/GHS`, `NG/NGN`).
- Payments: Paystack split payments to verified organization subaccounts; SebilLink never stores reusable cash balances.
- Roles: consumer, organization owner/operator, vendor-managed courier, moderator, admin.
- Organizations: mosque or restaurant accounts require an application and admin verification.
- Delivery: restaurants define zones, fees, hours, minimums, and assign their own couriers.
- QR menus: public mobile storefronts; authentication is required for checkout, rewards, and reviews.
- Community: verified-organization announcements/events plus verified-order reviews and reporting, not an unrestricted social network.
- Rewards: non-transferable, no-cash-value points scoped to each restaurant; donations do not earn points.
- Authentication: verified email/password and Google OAuth; MFA required for privileged roles.
- AI: limited guest text access, higher authenticated quotas, and authenticated quotas for expensive media operations.
- Maps: Google Maps/Places/Geocoding/Routes with restricted keys and server-side delivery validation.

## Target architecture

- Keep React 19 + TypeScript + Vite; add React Router and role-aware route layouts in this repository.
- Use Vercel functions under `/api` for Gemini, Paystack, Google server APIs, signed uploads, and privileged workflows. Shared server modules own validation, auth extraction, errors, rate limits, provider clients, and audit logging.
- Use Supabase Auth, Postgres, Storage, Realtime, migrations, generated database types, and row-level security. Browser code uses only the anon key; service-role and provider secrets remain server-side.
- Treat Paystack webhooks as payment truth. Persist integer minor units and ISO currency codes; never infer success from a browser redirect.
- Use Vitest/Testing Library for units/components and Playwright for critical end-to-end flows. Add ESLint, Prettier, typecheck, and GitHub Actions.

## Implementation sequence

1. **Stabilize the current application**
   - Record the current build/typecheck baseline and preserve unrelated worktree changes; add `package-lock.json` to the intended change set.
   - Remove the React 18 import map and `window.process` shim from `index.html`; use npm React 19 exclusively. Replace CDN Tailwind with a Vite-integrated Tailwind setup and move inline styles/config into source CSS/config.
   - Add `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, and `test:e2e` scripts plus strict lint/test configuration. Resolve existing compile/lint failures before feature work.
   - Add `.env.example`, ignore all real environment variants, validate required environment variables at startup, and document browser-safe versus server-only variables.
   - Normalize branding to SebilLink and migrate legacy `sanctuary_*`/`sabil_*` local-storage keys once without deleting existing data. Correct title and metadata.
   - Replace the hand-written source-file service worker with `vite-plugin-pwa`, a manifest, icons, offline navigation fallback, cache update UX, and no caching of authenticated/API responses.

2. **Create secure server and data foundations**
   - Add Vercel function routing and shared typed request/response contracts. Validate payloads with Zod; standardize correlation IDs and safe error envelopes.
   - Create Supabase local/project config and ordered SQL migrations. Generate TypeScript database types; seed only local/test data.
   - Initial schema groups:
     - identity: `profiles`, `user_roles`, `addresses`, `user_preferences`, `consents`;
     - organizations: `organizations`, `organization_members`, `organization_applications`, `organization_documents`, `settlement_accounts`, `business_hours`;
     - marketplace: `menus`, `menu_categories`, `menu_items`, `item_options`, `delivery_zones`, `carts`, `cart_items`, `orders`, `order_items`, `order_status_events`, `courier_assignments`;
     - money: `payment_attempts`, `payment_events`, `refunds`, `donations`, `receipts` (immutable event/reference records, integer minor units, currency on every row);
     - rewards: `reward_programs`, `reward_ledger` (append-only entries scoped to restaurant/customer);
     - community: `posts`, `events`, `reviews`, `content_reports`, `moderation_actions`;
     - AI/content: `chat_sessions`, `chat_messages`, `bookmarks`, `quiz_progress`, `generated_media`, `ai_usage`;
     - operations: `notifications`, `webhook_events`, `idempotency_keys`, `audit_logs`.
   - Add constraints for country/currency pairs, unique provider references, valid state transitions, organization membership, review/order linkage, positive prices, and reward balances derived from ledger entries.
   - Enable RLS on every exposed table. Write and test policies for public published data, consumer-owned records, organization-scoped operations, courier-assigned orders, moderator access, and admin-only approval/settlement actions. Service-role writes must be limited to server functions.
   - Configure private buckets for verification documents and AI attachments, plus public/signed delivery for approved logos, menu media, and post media. Enforce MIME type, size, ownership, and lifecycle rules.

3. **Replace simulated authentication and local-only identity**
   - Build Supabase Auth context/session restoration, verified email signup/login/reset, Google OAuth callback, logout, MFA enrollment/challenge for privileged roles, and protected route guards.
   - Replace fake `AuthScreen` user creation and simulated profile saves with authenticated profile operations. Email changes use Supabase verification rather than direct profile mutation.
   - Add account export/deletion request flows and consent records. Preserve guest preferences locally.
   - After first login, offer a one-time import of local chats, bookmarks, profile preferences, and progress into the authenticated account; mark imported records and retain local data until successful completion.

4. **Move Gemini behind protected APIs**
   - Split `geminiService.ts` into a browser API client and server-only Gemini provider functions. Remove all `process.env.API_KEY` replacements from Vite and verify no Gemini secret appears in built assets.
   - Implement endpoints for chat, briefing, reverse-location naming, quizzes/grading, Quran retrieval, image generation, video job creation/status, and live-session token/proxy behavior supported by the selected Gemini SDK.
   - Apply Zod validation, attachment limits, MIME allowlists, timeouts, retries only for transient errors, safe provider-error mapping, and request cancellation.
   - Enforce quotas server-side: low IP/session guest text allowance, higher per-user text allowance, strict per-user media quotas, concurrency caps, and admin-configurable limits. Persist usage without storing raw prompts in operational logs.
   - Store authenticated chat/bookmark/progress data in Supabase; keep a guest local mode. Show explicit AI limitations, source attribution, differences of scholarly opinion, and “consult a qualified scholar” guidance for personal rulings.
   - Make model identifiers environment/config driven and use stable supported models by default; disable unavailable features with a clear capability response rather than silently failing.

5. **Build organization onboarding and administration**
   - Add mosque/restaurant application flows for legal/display name, registration details where applicable, country, address, contacts, ownership evidence, payout details, and acceptance of platform terms.
   - Store verification documents privately; admins approve/reject/request changes with reasons and audit records. Only approved organizations can publish, receive payments, or invite operators.
   - Create role-based organization dashboards for profile, locations, members, hours, media, Paystack subaccount status, and operational settings.
   - Add admin dashboards for applications, role grants, organizations, AI quotas, payment exceptions, reports, refunds, and audit trails. Never expose service-role or provider credentials to these dashboards.

6. **Deliver public discovery and maps**
   - Replace prompt-based mosque/restaurant lookup with structured public listings and route pages. Add country/city/category/halal-attribute filters and accessible list/map views.
   - Store normalized addresses plus coordinates. Use Google Places autocomplete for entry, server-side geocoding verification, and Google Maps rendering with a browser-restricted key.
   - Implement nearby discovery and distance display. Consent-gate geolocation and provide manual city/address fallback.
   - Restaurant delivery eligibility is authoritative on the server: validate customer coordinates against active zones and business hours, then calculate fee/minimum using the persisted zone configuration. Client map estimates are informational only.

7. **Implement restaurant catalog, QR, cart, and checkout**
   - Add operator CRUD for menus, categories, items, option groups, allergens, availability, schedules, prices, taxes/fees configuration, and stock toggles. Publish changes atomically.
   - Add public routes such as `/r/:slug` and `/r/:slug/menu`; generate downloadable QR assets that resolve to stable HTTPS URLs. Public menu browsing requires no account.
   - Implement one-restaurant-per-cart behavior, option validation, pickup/vendor-delivery choice, address selection, notes, contact details, and server-side cart repricing before checkout.
   - Snapshot item names, options, quantities, unit prices, fees, currency, and tax presentation into order rows so later menu edits cannot alter history.
   - Model explicit order states (`pending_payment`, `paid`, `accepted`, `preparing`, `ready`, `out_for_delivery`, `completed`, `cancelled`, `refunded`) and validate permitted actor transitions server-side.

8. **Integrate Paystack and the payment ledger**
   - Create verified Paystack settlement subaccounts for approved organizations and store only provider references/status. Use country-appropriate supported payout details and test-mode onboarding before live activation.
   - Initialize order and donation transactions server-side with amount/currency/organization metadata, split configuration, platform fee, idempotency key, and authenticated owner context.
   - Implement a signature-verified webhook endpoint that stores each provider event once, acknowledges quickly, and processes idempotently. Verify transaction details from Paystack before changing internal state.
   - Add reconciliation jobs/admin views for initialized-but-unresolved attempts, amount/currency mismatches, failed splits, chargebacks, and webhook retries.
   - Build customer “wallet” pages as payment/donation/refund/reward history and receipts only. Do not expose deposits, transfers, withdrawals, or a reusable cash balance.
   - Implement authorized full/partial refunds using Paystack support and platform policy; record immutable refund events and adjust order/reward state idempotently.

9. **Implement vendor-managed fulfillment**
   - Restaurant operators accept/reject orders, set preparation estimates, mark ready, assign an active courier member, and update fulfillment status.
   - Couriers see only assigned order details needed for fulfillment, can mark pickup/delivery, and cannot access payment/admin data. Capture timestamps and actor IDs for every transition.
   - Consumers receive realtime status updates with polling fallback. Add in-app notifications first; design email/SMS adapters but enable only configured providers.
   - Handle closures, out-of-zone addresses, rejected orders, customer cancellation windows, delivery failure, and refund escalation explicitly.

10. **Implement mosque pages, donations, and community**
   - Add mosque profiles, verified location/contact details, prayer-time presentation, events, announcements, and donation campaigns. Organization-provided schedules are authoritative; calculated times are labeled as estimates.
   - Use the same Paystack initialization/webhook/reconciliation pipeline for donations, with organization split settlement, optional donor display name, anonymous public display choice, and private financial records.
   - Permit only verified organization members to publish posts/events. Add draft/published/archived states, media rules, date/location details, and organization ownership.
   - Permit one review per completed order, with rating/text/media constraints and an edit window. Mark reviews as verified purchases.
   - Add report reasons, moderation queues, hide/remove/restore actions, organization responses, rate limits, and complete moderator audit records.

11. **Implement per-restaurant rewards**
   - Let approved restaurants configure earn rates, eligible order types, minimum redemption, and optional expiration prospectively.
   - Credit points only after completed paid orders; debit on redemption; reverse proportionally for refunds/cancellations. Use unique source references so retries cannot double-credit/debit.
   - Reprice redemptions server-side, cap them by restaurant policy/order subtotal, and clearly state that points are non-transferable, non-withdrawable, restaurant-specific, and have no cash value.

12. **Production readiness, documentation, and rollout**
   - Add error boundaries, accessible loading/empty/error states, keyboard/focus support, RTL regression coverage, responsive checks, observability with secret/PII redaction, and structured audit events.
   - Add Content Security Policy and security headers; restrict CORS/origins, provider keys, OAuth redirects, upload types, and Vercel preview/production environment separation.
   - Replace the inaccurate Flutter README with actual local setup, Supabase migration/seed commands, Vercel deployment, required environment variables, webhook setup, role workflows, and architecture. Add an MIT `LICENSE` only after confirming ownership intent; otherwise remove the unsupported README claim. Add privacy, terms, AI disclaimer, refund, marketplace, and organization policies before public launch.
   - Add GitHub Actions for clean install, generated-type drift check, typecheck, lint, unit/integration tests, production build, migration verification, RLS tests, and Playwright smoke tests.
   - Roll out behind feature flags in this order: secured AI foundation; auth/data sync; public organizations/discovery; sandbox catalog/orders; Paystack test transactions/webhooks; internal organization pilot; live payments for selected verified organizations; community/rewards; broader Ghana/Nigeria availability.
   - Preserve a kill switch for checkout, donations, expensive AI generation, and community posting independently. Database migrations must be additive/backward-compatible during rollout, with destructive cleanup deferred until old clients and local-key migration are retired.

## Critical validation scenarios

- A production bundle contains no Gemini, Supabase service-role, Paystack secret, or Google server key.
- RLS tests prove users cannot read another user’s addresses/chats/orders, restaurant A cannot access restaurant B, couriers see only assignments, and public users see only published/approved content.
- Duplicate/reordered Paystack webhooks, browser refreshes, and retried checkout requests cannot duplicate orders, charges, refunds, donations, or reward entries.
- Price changes between cart and payment cause a clear reprice/confirmation flow; cross-currency carts and unsupported country/currency combinations are rejected.
- Unapproved organizations cannot publish or receive payments; suspended organizations disappear from checkout while historical receipts remain available.
- Public QR menus work on small mobile screens without authentication; checkout requires verified identity and server-side delivery/address validation.
- Refunds and cancellations result in correct immutable payment history, order status, settlement records, and reward reversal.
- Geolocation denial, Google/Paystack/Gemini/Supabase outages, webhook delay, and offline navigation each produce safe recoverable behavior.
- Organization post/report/review permissions and moderation actions are enforced server-side and audited.
- `npm ci`, typecheck, lint, unit/integration tests, production build, RLS tests, and Playwright critical-path tests pass in CI.

## Explicitly out of scope for this plan

- A stored-value cash wallet, peer-to-peer transfers, withdrawals, lending, or custody of customer funds.
- Platform-dispatched independent couriers, route optimization, or courier payroll.
- An unrestricted user social feed, direct messaging, or user-created public posts.
- Native Flutter/iOS/Android applications; the responsive PWA is the launch client.
- Countries/currencies beyond configured Ghana and Nigeria launch support; the schema remains extensible.
- Legal certification: local counsel, Paystack approval, organization verification policy, tax treatment, and privacy/payment compliance remain launch gates, not assumptions made by code.
