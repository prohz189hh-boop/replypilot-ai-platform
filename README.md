# ReplyPilot AI 2.0

A multilingual business workspace. Local development uses Next.js, React, TypeScript and persistent SQLite. A separate `/cloud` development workflow connects to the existing Supabase project; SQLite remains the main workspace fallback.

## Start on Windows

Requires Node.js 24+ and npm. Run `npm ci`, then `npm run dev` in this folder. Open http://127.0.0.1:3000. Register a fictional account and create a workspace. The launcher binds to loopback; data persists in ignored `.data/`.

For a production-mode local test: `npm run build`, then `npm start`. This is not a public production deployment.

## Verification

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run audit:secrets`, `npm run test:e2e`, and `npm audit --omit=dev`. Install the test browser once with `npx playwright install chromium`. Browser tests use port 3100 and isolated databases under ignored `work/`. PostgreSQL tests run PGlite without Docker; they do not verify Supabase Auth or Storage.

## Demonstration

Register → create an electronics workspace → add a laptop with specifications/price/stock → explicitly enable automatic mock replies in AI settings → open customer chat from Integrations in a separate browser context → ask in English, Sorani or Badini → request a product → confirm in Orders → verify inventory. Requests do not reserve stock or count as revenue. Completed orders alone count as revenue.

## Local admin

Register an account first. An authorized local operator runs `npm run admin -- registered-email`. This creates an audit event and grants local platform access at `/admin`. Ordinary users cannot activate their own paid plans. All billing remains simulated.

## Important boundaries

- Use fictional data only. Local auth uses scrypt and hashed opaque sessions; cloud auth uses Supabase SSR sessions.
- SQLite powers the main workspace. The separate cloud preview supports official Auth, catalog, multi-item orders/inventory, private images and whole-tenant analytics. Direct client writes remain denied; authorized RPCs enforce server-side permissions.
- Customer conversations default to deterministic mock AI. Owners can opt fictional workspaces into server-side Gemini using the existing synthetic-only configuration. Strict live English, Sorani and Badini tests distinguish Gemini from fallback.
- External messaging and real payments are disabled. No production deployment has been made.
- Sorani/Badini templates and partial UI localization require native-speaker review.
- See IMPLEMENTATION_STATUS.md for remaining work and exact blockers.


## Opt-in external development tests

Keep `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_PROJECT_REF` in ignored `.env.local`. For fixture provisioning only, keep `SUPABASE_TEST_ADMIN_KEY` in ignored `.env.cloud-test`; never load that file in the web server. `node scripts/provision-cloud-tests.mjs` creates two fresh synthetic Auth users through the supported Admin API and preserves prior fixture files. It is restricted to the named development project. These tests write synthetic data to that project; they never delete historical data.

After building, run cloud and Gemini checks separately in PowerShell:

```powershell
$env:RUN_CLOUD_E2E='true'
npx playwright test tests/e2e/cloud.spec.ts
Remove-Item Env:RUN_CLOUD_E2E
$env:RUN_GEMINI_E2E='true'
npx playwright test tests/e2e/gemini-chat.spec.ts
Remove-Item Env:RUN_GEMINI_E2E
```

Gemini testing requires `AI_PROVIDER=gemini`, the existing server key/model, and `GEMINI_SYNTHETIC_DATA_ONLY=true`. Tests explicitly opt a fictional workspace in; other workspaces stay mock. The strict live test fails if a response falls back. External service failures are reported honestly and do not disable the local fallback.

Auth reference: https://supabase.com/docs/reference/javascript/auth-admin-createuser
Server sessions: https://supabase.com/docs/guides/auth/server-side/advanced-guide
Gemini model-specific thinking levels: https://ai.google.dev/gemini-api/docs/thinking

See [security boundaries and audit coverage](docs/SECURITY.md). The optional live Gemini demo diagnostic requires a signed-in platform administrator; normal customer chat requires an authorized conversation token and fictional-workspace opt-in.
