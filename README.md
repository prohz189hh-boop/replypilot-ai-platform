# ReplyPilot AI 2.0

A multilingual business workspace. Local development uses Next.js, React, TypeScript and persistent SQLite. A separate `/cloud` development workflow connects to the existing Supabase project; SQLite remains the main workspace fallback.

## What ReplyPilot does

ReplyPilot brings customer conversations, catalog information and everyday business operations into one development workspace:

- **Multilingual support:** English, Arabic, Kurdish Sorani and Kurdish Badini, with RTL rendering and persistent customer language choices. Informal Latin-written Badini is recognized in tested phrases and answered using Kurdish script; dialect coverage and translation quality still need native-speaker review.
- **Customer AI:** deterministic mock replies by default, plus an optional server-side Gemini integration for explicitly opted-in fictional workspaces. Catalog facts, quotas, bounded retries and distinct fallback attribution support controlled testing.
- **Products and inventory:** specifications, variants, images, CSV import/export, stock tracking and low-stock reporting in the local workspace.
- **Orders and appointments:** inventory reservation/cancellation, order status tracking and completed-order reporting; local service catalogs and staff-created appointments with conflict checks. Cloud orders support multiple items; full appointment parity is unfinished.
- **WhatsApp simulation:** signed fictional incoming events, conversation history, automatic replies, human takeover, an outgoing queue, delivery receipts and bounded simulated retries. The production WhatsApp API is not connected, and no real messages are sent.
- **Business administration:** tenant isolation, staff permissions, analytics, trials and simulated subscriptions. Payment processing is not connected.

## Start on Windows

Requires Node.js 24+ and npm. From PowerShell:

```powershell
git clone https://github.com/prohz189hh-boop/replypilot-ai-platform.git
cd replypilot-ai-platform
npm ci
npm run dev
```

If you already have the repository, use that checkout. Open [the local app](http://127.0.0.1:3000), register a fictional account and create a workspace. The default SQLite/mock workflow requires no provider credentials. The launcher binds to loopback; data persists in ignored `.data/`. See [.env.example](.env.example) for optional server configuration, and keep personal values in ignored `.env.local`. Never commit credentials.

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

## Contributing

Contributions are welcome, especially bug fixes, accessibility improvements, reproducible tests, cloud feature parity and native-speaker reviews of Sorani and Badini. Start with [implementation status](IMPLEMENTATION_STATUS.md) and [security boundaries](docs/SECURITY.md), then open an issue describing the problem or a focused pull request with relevant verification. Use synthetic fixtures and clearly distinguish mock, hosted and real-provider test results.

Only contribute code and assets you own or have permission to contribute under the applicable license. Preserve third-party attribution and license notices. Do not include customer data, credentials or proprietary assets in issues, screenshots, fixtures or pull requests.

## Development limitations

This is an active development project, not a production-ready service. SQLite and the separate Supabase preview do not yet have full feature parity. Cloud Gemini, appointments, team administration and billing need further implementation. Privacy export/deletion, durable incoming WhatsApp recovery, complete localization and native-speaker evaluation remain unfinished. Gemini can time out or return service errors; mock fallback is never reported as a verified Gemini reply. See [current verification and blockers](IMPLEMENTATION_STATUS.md) for dated results.

External tests require authorized development infrastructure and explicit opt-in. The fixture script is intentionally restricted to this project's Supabase development instance; contributors should use the default local tests unless working with that authorized setup. Do not enable paid billing or send real customer messages for testing. No commercial-user adoption is claimed.

## License

Eligible ReplyPilot project code and documentation owned by Hzr_Dev, or contributed with permission to license them, are licensed under the [MIT License](LICENSE), copyright © 2026 Hzr_Dev.

Third-party dependencies, generated framework files and any separately identified third-party materials remain under their respective licenses; the project license does not relicense them. Preserve their copyright, attribution and license notices when redistributing them. See [third-party licensing scope](THIRD_PARTY_NOTICES.md). This license grants no rights to third-party trademarks, service accounts or API credentials.
