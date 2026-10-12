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
- Server-only Gemini catalog-selection adapter and optional fixed synthetic smoke-test endpoint, synthetic selection live-verified; customer chat remains mock.
- PostgreSQL migration with RLS, composite tenant foreign keys and appointment exclusion constraint. Direct authenticated writes denied until authorized server RPCs exist. The cloud runtime migration now supplies membership-checked catalog and order RPCs.

## Current verification
- 70 automated tests pass, including PostgreSQL/PGlite, local domain logic, simulated expiry/renewal, analytics beyond pagination, tenant isolation, Gemini quota reservations and bounded retry tests.
- TypeScript, lint and production build pass. Three local Chromium scenarios pass; cloud and Gemini cases are intentionally skipped unless their flags are set.
- Hosted cloud Playwright passed: official Auth login/logout/refresh, onboarding, catalog edits, stale edits, multi-item reservation/cancellation, private Storage, cross-tenant RPC/read denial, denied direct subscription writes.
- Latest 2026-10-12 live rerun FAILED: English, Sorani and Badini each hit the 30-second timeout, returned mock-fallback, and retained unknown token usage. No live-success claim is made for this rerun.
- The recovered earlier strict live Gemini Playwright report passed English, Sorani and Arabic-script Badini with provider=gemini. Earlier runs correctly failed on timeouts and Google HTTP 503. One separately metered retry is allowed for 503; validation failures, timeouts and 429 fall back without automatic retry.
- Runtime dependency audit: zero known vulnerabilities at last check. Five high development-tool findings remain through the Next ESLint dependency chain.
- Tests use synthetic data. Script/language checks do not establish native-speaker quality or prove complete semantic grounding.

## Cloud state and Auth diagnosis
- Existing private repository: https://github.com/prohz189hh-boop/replypilot-ai-platform.
- Only development project `kjwmyvyjqyildwndkqoc` is used. Initial and cloud-runtime PostgreSQL migrations were applied, with 23 public RLS tables. SQLite was preserved.
- Old manually seeded Auth fixture identities lacked required timestamps and produced an Auth database error. Fresh fixtures are now created exclusively through `auth.admin.createUser` with email confirmation, using `scripts/provision-cloud-tests.mjs`. No further internal Auth table writes are used. Historical fixtures were preserved.
- The test administrator credential exists only in ignored `.env.cloud-test`. The app loads only the publishable key and each user's session; the admin credential is not application configuration.
- Cloud preview `/cloud` currently handles Auth, onboarding, catalog, multi-item orders, inventory and private Storage APIs. It does not claim cloud parity for inbox, appointments, team administration, analytics, Gemini or billing.

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
- Grace/failed-payment simulation and cancellation scheduling, advanced automation/reports/customization and support tickets. Local simulated expiry and admin-approved calendar-month renewal are implemented.
- Official messaging adapters, webhook verification, retry/deduplication and credential lifecycle.
- Data export/deletion/retention, production observability, backup/recovery, load testing and native-language evaluation.
- Final legal terms/contact delivery and commercial launch review.

## Exact next actions
Complete the current verification and push a checkpoint, then add informal Latin Badini recognition, a tenant-isolated WhatsApp simulation (live sending disabled), remaining billing simulation states and cloud parity. Do not request Meta credentials yet. Do not enable paid services or deploy publicly.

## Recovery
Uncommitted work must be preserved. Run `git status` and read this file on resume. Browser tests load an isolated SQLite database under ignored `work/`; cloud fixtures persist in the named development project. Use `git log` for the latest pushed checkpoint.

## 2026-10-12 channel milestone
- Checkpoint `a2b7ed6` was pushed before this milestone.
- Informal Latin Badini recognizes the five user examples as greeting, availability, price, purchase and language requests. Product identifiers stay intact. Explicit user language choices still override detection; auto-detected chat now updates RTL. Heuristics do not claim universal semantic accuracy.
- Working WhatsApp simulator is available in Integrations: signed synthetic inbound events, tenant-scoped contacts/history, automatic mock/Gemini pipeline, deduplication, human takeover, attributed human replies, outgoing queue, simulated receipts, bounded retries, service-window checks and simulated spending caps. Real Meta sending and public webhook processing remain disabled.
- 70 unit/domain/PostgreSQL tests passed; three local Playwright scenarios passed, including mobile WhatsApp layout. TypeScript, lint and production build passed.
- Gemini model-list connectivity returned HTTP 200 and confirmed the configured model. The latest generation run still timed out; new Latin Badini live-generation verification is pending and has strict provider assertions.
- See docs/WHATSAPP_SIMULATION.md for the exact supported simulation and remaining production architecture work. No Meta credentials were requested.
