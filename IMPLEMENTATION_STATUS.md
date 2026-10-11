# ReplyPilot AI 2.0 — implementation status

Updated 2026-10-11. Existing new project preserved. No old ReplyPilot or unrelated project accessed.

## Current milestone
Local vertical slice across milestones 1–9 implemented; regression and hardening in progress. Cloud integration and commercial readiness remain incomplete.

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
- PostgreSQL migration with RLS, composite tenant foreign keys and appointment exclusion constraint. Direct authenticated writes denied until authorized server RPCs exist.

## Current verification
- Continuation rerun: 44 tests PASS (36 domain/SQLite/language + 5 PostgreSQL/PGlite + 3 mocked Gemini adapter tests).
- Continuation rerun: 2 Chromium browser scenarios PASS, including registration→catalog→three-language chat→order→stock→staff reply→mobile RTL→logout/login.
- TypeScript PASS. ESLint PASS after correcting the CSV download anchor. Production build PASS.
- Runtime audit: 0 known vulnerabilities. Full audit: 5 high development-tool findings through Next ESLint plugin / fast-glob / micromatch / braces. Compatible remediation not yet verified; no forced downgrade.
- Desktop and 390px mobile RTL screenshots inspected; no tested overview horizontal overflow.
- These results verify local and PGlite behavior, not hosted Supabase, real Gemini, Meta or payments.

## External blockers
- Private GitHub repository created and baseline pushed: https://github.com/prohz189hh-boop/replypilot-ai-platform.
- Supabase cost tool returned UNAVAILABLE; connector subsequently unavailable. Free-tier provisioning cannot be verified. No remote project created or modified.
- Gemini key is saved in ignored .env.local by explicit user authorization. Live gemini-3.8-flash synthetic selection passed (311 tokens). No customer messages sent.
- No Meta permissions/credentials, payment provider or public deployment approval.

## Remaining work
- Supabase auth/session refresh, Storage, transactional domain RPCs and runtime adapter; preserve SQLite until verified.
- Natural Gemini language generation with grounding validation, persistent provider cost ledger, approved synthetic live test.
- Full localization and AI-assisted product translation generation remain. Dialect clarification and editable native-speaker review queue are implemented.
- Variant editing, customer images and logo uploads remain. Version-checked product edits and server-side pagination are implemented.
- Multi-item carts, shipping quotes, notifications, recurring staff availability, rescheduling and customer self-booking.
- Subscription renewal/expiry/grace/failed-payment transitions, advanced automation/reports/customization and support tickets.
- Official messaging adapters, webhook verification, retry/deduplication and credential lifecycle.
- Data export/deletion/retention, production observability, backup/recovery, load testing and native-language evaluation.
- Final legal terms/contact delivery and commercial launch review.

## Exact next actions
Verify the new user-supplied Supabase project kjwmyvyjqyildwndkqoc, then apply tested migrations. Implement opt-in synthetic Gemini chat. No paid resources or public production deployment.

## Continuation checkpoint
44 tests, typecheck, lint, production build and 2 Playwright scenarios passed on 2026-10-11. Includes stale-stock protection, trial quota across month boundaries, full catalog retrieval up to 2,000 products, pagination, dialect clarification, translation review, live demo toggle and provider usage ledger. Provider cost figures are reference estimates, not actual invoices. Prior checkpoint abfe0ff; use git log for the new checkpoint hash.

