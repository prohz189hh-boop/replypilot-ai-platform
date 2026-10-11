# ReplyPilot AI 2.0

A multilingual business workspace. Local development uses Next.js, React, TypeScript and persistent SQLite. PostgreSQL schema is independently tested but not connected to hosted Supabase.

## Start on Windows

Requires Node.js 24+ and npm. Run `npm ci`, then `npm run dev` in this folder. Open http://127.0.0.1:3000. Register a fictional account and create a workspace. The launcher binds to loopback; data persists in ignored `.data/`.

For a production-mode local test: `npm run build`, then `npm start`. This is not a public production deployment.

## Verification

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, and `npm audit --omit=dev`. Install the test browser once with `npx playwright install chromium`. Browser tests use port 3100 and isolated databases under ignored `work/`. PostgreSQL tests run PGlite without Docker; they do not verify Supabase Auth or Storage.

## Demonstration

Register → create an electronics workspace → add a laptop with specifications/price/stock → explicitly enable automatic mock replies in AI settings → open customer chat from Integrations in a separate browser context → ask in English, Sorani or Badini → request a product → confirm in Orders → verify inventory. Requests do not reserve stock or count as revenue. Completed orders alone count as revenue.

## Local admin

Register an account first. An authorized local operator runs `npm run admin -- registered-email`. This creates an audit event and grants local platform access at `/admin`. Ordinary users cannot activate their own paid plans. All billing remains simulated.

## Important boundaries

- Use fictional data only. Local auth uses scrypt and hashed opaque sessions; cloud auth is pending.
- The running database is SQLite. Supabase migration is a separately tested foundation with direct client writes denied.
- Customer conversations use deterministic mock AI. A live synthetic Gemini catalog-selection test passed; natural live customer replies are not implemented yet.
- External messaging and real payments are disabled. No production deployment has been made.
- Sorani/Badini templates and partial UI localization require native-speaker review.
- See IMPLEMENTATION_STATUS.md for remaining work and exact blockers.

