# ReplyPilot AI 2.0 — implementation status

Updated 2026-10-12. Existing new project preserved. No old ReplyPilot or unrelated project accessed.

## Current milestone
Verified local workspace plus a separate hosted Supabase development workflow. SQLite remains available. The full application is not production-ready; cloud feature parity and commercial integrations remain incomplete.

## Implemented locally
- Marketing website, pricing, demo, registration/login and responsive dashboard with dark mode and RTL.
- Persistent SQLite accounts, scrypt password hashes, hashed opaque sessions, tenant membership and staff authorization.
- Business onboarding, industry navigation, catalog CRUD/archive, custom specifications, variants, stock reservations and audit records.
- Atomic validated CSV import/export, formula-safe exports, content-validated image uploads and metadata removal.
- Website widget, persisted conversations, staff replies, private notes, mock AI suggestions, explicit automatic mode and human takeover.
- Idempotent order requests, transactional approval/reservation/cancellation. Only completed orders count as revenue.
- Service catalog, staff-created appointments and overlap prevention.
- Exact $9/$18/$30 plans, seven-day Growth trial with 30 replies, product/staff/reply limits, monthly usage buckets, admin-verified simulated plan changes.
- Aggregate admin view excludes customer message contents. Local admin provisioning is audited.
- Four-language navigation and separate Sorani/Badini Arabic-script mock templates; partial localization only.
- Server-only Gemini catalog-selection adapter and optional fixed synthetic smoke-test endpoint, synthetic selection live-verified; opted-in fictional customer chat also supports Gemini with distinct fallback attribution.
- PostgreSQL migration with RLS, composite tenant foreign keys and appointment exclusion constraint. Direct authenticated writes denied until authorized server RPCs exist. The cloud runtime migration now supplies membership-checked catalog and order RPCs.

## Current verification
- 79 automated tests pass, including PostgreSQL/PGlite, local domain logic, simulated expiry/renewal, analytics beyond pagination, tenant isolation, Gemini quota reservations and bounded retry tests.
- TypeScript, lint and production build pass. Five local Chromium scenarios pass, including the billing lifecycle and WhatsApp simulator; cloud and Gemini cases are intentionally skipped unless their flags are set.
- Hosted cloud Playwright passed: official Auth login/logout/refresh, onboarding, catalog edits, stale edits, multi-item reservation/cancellation, private Storage, cross-tenant RPC/read denial, denied direct subscription writes.
- Earlier 2026-10-12 strict live rerun FAILED overall: English, Sorani and Latin Badini generated actual Gemini replies; Kurdish-script Badini returned mock-fallback after two Google HTTP 503 errors. Latin Badini output was Kurdish script with RTL. Earlier timeout failures also remain recorded; fallback never counts as live success.
- The recovered earlier strict live Gemini Playwright report passed English, Sorani and Arabic-script Badini with provider=gemini. Earlier runs correctly failed on timeouts and Google HTTP 503. One separately metered retry is allowed for 503; validation failures, timeouts and 429 fall back without automatic retry.
- Runtime dependency audit: zero known vulnerabilities at last check. Five high development-tool findings remain through the Next ESLint dependency chain.
- Tests use synthetic data. Script/language checks do not establish native-speaker quality or prove complete semantic grounding.

## Cloud state and Auth diagnosis
- Existing private repository: https://github.com/prohz189hh-boop/replypilot-ai-platform.
- Only development project `kjwmyvyjqyildwndkqoc` is used. Initial and cloud-runtime PostgreSQL migrations were applied, with 23 public RLS tables. SQLite was preserved.
- Old manually seeded Auth fixture identities lacked required timestamps and produced an Auth database error. Fresh fixtures are now created exclusively through `auth.admin.createUser` with email confirmation, using `scripts/provision-cloud-tests.mjs`. No further internal Auth table writes are used. Historical fixtures were preserved.
- The test administrator credential exists only in ignored `.env.cloud-test`. The app loads only the publishable key and each user's session; the admin credential is not application configuration.
- Cloud preview `/cloud` currently handles Auth, onboarding, catalog, multi-item orders, inventory, private Storage APIs and whole-tenant analytics. It does not claim cloud parity for inbox, appointments, team administration, Gemini or billing.

## Gemini and privacy
- Existing ignored key and configured Gemini model remain server-only. No paid billing was enabled.
- Natural replies now run only when local development, synthetic-only environment configuration and an explicit fictional-workspace owner opt-in all agree. Existing workspaces remain mock by default.
- Catalog facts use server-supplied placeholders; invalid output falls back and keeps distinct provider attribution. The validator is a defense, not proof that every multilingual statement is correct.
- Quotas reserve slots before calls; duplicate in-flight requests are rejected. The daily call cap, provider ledger, bounded timeout and separately logged retry bound API usage. Timed-out usage can remain unknown and is not reported as zero cost.
- Provider ledger stores counts and safe error codes, not prompts or secrets. Customer content is excluded from the platform aggregate admin view.
- Hosted customer-data use, broader language evaluation and native-speaker review remain launch gates.

## Remaining work
- Extend the verified cloud preview to the remaining local domains; verify actual expiry-driven session refresh and email-confirmation/recovery journeys.
- Expand live Gemini evaluation, informal Latin Badini interpretation and translation generation with native-speaker review.
- Full localization and AI-assisted product translation generation remain. Dialect clarification and editable native-speaker review queue are implemented.
- Variant editing, customer images and logo uploads remain. Version-checked product edits and server-side pagination are implemented.
- Multi-item carts, shipping quotes, notifications, recurring staff availability, rescheduling and customer self-booking.
- Cancellation scheduling, advanced automation/reports/customization and support tickets remain. Local failed-payment simulation, three-day grace, expiry and admin-approved calendar-month renewal are implemented.
- Official messaging adapters, webhook verification, retry/deduplication and credential lifecycle.
- Data export/deletion/retention, production observability, backup/recovery, load testing and native-language evaluation.
- Final legal terms/contact delivery and commercial launch review.

## Exact next actions
Preserve the pushed billing, language, analytics and replay checkpoints. Next priorities are durable WhatsApp incoming-event recovery, additional cloud domain parity, privacy export/deletion and localization review. Do not request Meta credentials yet. Do not enable paid services or deploy publicly.

## Recovery
Uncommitted work must be preserved. Run `git status` and read this file on resume. Browser tests load an isolated SQLite database under ignored `work/`; cloud fixtures persist in the named development project. Use `git log` for the latest pushed checkpoint.

## 2026-10-12 channel milestone
- Checkpoint `a2b7ed6` was pushed before this milestone.
- Informal Latin Badini recognizes the five user examples as greeting, availability, price, purchase and language requests. Product identifiers stay intact. Explicit user language choices still override detection; auto-detected chat now updates RTL. Heuristics do not claim universal semantic accuracy.
- Working WhatsApp simulator is available in Integrations: signed synthetic inbound events, tenant-scoped contacts/history, automatic mock/Gemini pipeline, deduplication, human takeover, attributed human replies, outgoing queue, simulated receipts, bounded retries, service-window checks and simulated spending caps. Real Meta sending and public webhook processing remain disabled.
- 70 unit/domain/PostgreSQL tests passed; three local Playwright scenarios passed, including mobile WhatsApp layout. TypeScript, lint and production build passed.
- Gemini model-list connectivity returned HTTP 200 and confirmed the configured model. The subsequent strict generation run verified English, Sorani and Latin Badini, but failed overall on Kurdish-script Badini HTTP 503 responses.
- See docs/WHATSAPP_SIMULATION.md for the exact supported simulation and remaining production architecture work. No Meta credentials were requested.

## 2026-10-12 billing and provider-safety checkpoint
- Added administrator-only simulated failed payments, three-day grace, grace expiry and idempotent lifecycle events. Renewal clears grace; existing subscriptions retain their prior period end. Simulated billing is excluded from revenue.
- Provider retry rechecks fictional-data consent. Reply commit rejects changed catalog facts or withdrawn consent. HTTP 429 is not retried. Aggregate provider reporting distinguishes unknown usage and error codes.
- Verified TypeScript, lint, 74 automated tests, production build and four local Chromium scenarios (two external scenarios opt-in/skipped). New browser coverage follows owner request → administrator approval → grace → expiry/write denial → renewal → cancellation.
- No new live Gemini calls were needed for these changes. Latest cloud live workflow passed previously on 2026-10-12; this checkpoint does not claim additional cloud parity.

## 2026-10-12 customer language preference
- Billing/provider checkpoint `1bc41d8` is pushed.
- Customer language selection now persists in the tenant-scoped conversation, survives reload and overrides later ambiguous/product-only messages. Choosing Auto-detect clears the explicit preference. Older conversations remain automatic and retain their last detected language.
- Preference changes require the conversation bearer token; existing cross-tenant protections remain. WhatsApp contacts begin in automatic mode. This does not identify a customer across unrelated browser sessions or devices.
- TypeScript, lint, production build, 76 automated tests and five local browser scenarios passed. Two external scenarios remained opt-in/skipped; no new Gemini calls.

## 2026-10-12 cloud analytics checkpoint
- Customer language checkpoint `442f48b` is pushed.
- Applied `20261012073835_cloud_analytics.sql` only to development project `kjwmyvyjqyildwndkqoc`. The new read-only SECURITY INVOKER RPC retains caller RLS, requires membership and denies anonymous execution. No existing records were deleted.
- Cloud overview now shows whole-tenant product, low-stock and order totals beyond the displayed 100 rows. Completed merchandise totals are separated by currency, exclude shipping, cancelled/pending orders and simulated billing, and do not claim collected payments.
- PostgreSQL test covers 103 active products, archived exclusions, currency separation and anonymous/cross-tenant denial. Latest hosted Playwright passed (46.2 seconds): official Auth, tenant isolation, catalog edits, inventory reservation/cancellation, completed-order analytics, private Storage and mobile overflow.
- TypeScript, lint, build and 77 automated tests passed. Local browser suite last passed all five scenarios; strict Gemini was not repeated.
- Security advisor: no database warnings; two informational deny-all private tables. One Auth warning remains for disabled leaked-password protection, which is [available on Pro and above](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Free tier is preserved.
- Further cloud parity, durable WhatsApp event recovery, privacy export/deletion, full localization and native-speaker review remain unfinished.

## 2026-10-12 WhatsApp replay checkpoint
- Cloud analytics checkpoint `f0ee466` is pushed.
- New simulated incoming events preserve the original received timestamp. Delayed replay without a timestamp deduplicates and cannot reopen the service window; an explicitly changed timestamp remains a conflicting event. Existing records are preserved. Historical events without stored received timestamps require their original explicit timestamp.
- Added regression coverage for delayed replay, unchanged inbound window, no duplicated messages/delivery, and a maximum of three transport attempts with no fourth simulated charge.
- TypeScript, lint, 79 automated tests and production build pass. Runtime dependency audit reports zero vulnerabilities. This change makes no additional Gemini calls and does not enable real WhatsApp sending.
- Final local Chromium regression: five passed, two external cases skipped. Hosted cloud test passed separately during this continuation; Gemini was not rerun.

## 2026-10-12 live Gemini verification after credential update
- Updated only the ignored server-side Gemini key; credentials remain untracked.
- Strict live customer-chat Playwright PASSED in 26.9 seconds with real Gemini replies for English, Sorani, Kurdish-script Badini and Latin Badini input (Kurdish-script response with RTL). All four provider calls succeeded without retry or fallback.
- Provider ledger recorded 296, 345, 358 and 427 tokens respectively (1,426 total). Product name, price, stock and specifications came from the fictional catalog. This verifies the sampled workflow; earlier 503/timeouts remain evidence of intermittent provider failures and native-speaker review is still required.
