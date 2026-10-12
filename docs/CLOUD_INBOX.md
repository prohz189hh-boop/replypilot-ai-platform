# Cloud staff inbox

The `/cloud` preview stores fictional customer intake and human service in the existing Supabase development project. Local SQLite conversations remain separate and unchanged.

## Workflow

1. Sign in through Supabase Auth and open the existing business.
2. Add a fictional customer name and incoming message.
3. Select the conversation, inspect history, choose a reply language or Auto-detect, and optionally enable human takeover.
4. Save a human reply or private staff note. These are stored records; no external delivery or cloud Gemini call occurs.
5. Resolve or reopen the conversation. The latest 100 conversations are listed. History uses stable timestamp/UUID cursors, 50 messages per page.

The language preference survives reload. Auto-detect clears the explicit preference and retains the last effective language until a future incoming-message processor detects another language. There is currently no public cloud customer-message endpoint.

## Authorization and retries

The server validates the Supabase user and derives the organization from membership. It does not accept an organization ID from browser mutation payloads. RLS constrains reads. Private transactional functions check membership, while public SECURITY INVOKER wrappers grant authenticated callers access to only the supported operations. Anonymous execution and direct table writes remain denied.

A conversation ID doubles as its intake idempotency key, with a fingerprint covering normalized name, text and detected language. Replies use independent UUID request keys. Matching retries return the existing result; changed requests using the same key fail. The UI retains request keys after failures. Audit events contain action/target identifiers, not message bodies. No public bearer credential is created for staff intake.

New intake requires an active subscription or trial. Human help and notes remain available after expiry, consistent with the local application. This is not a full cloud billing implementation.

## Verification

`tests/cloud-runtime.test.ts` exercises the migration under authenticated/anonymous PostgreSQL roles, including cross-tenant denial, duplicate/conflicting requests, preferences, private notes and expiry. `tests/e2e/cloud.spec.ts` exercises actual hosted Auth, browser interactions, API pagination, cross-tenant RLS/RPCs and the existing catalog/order/Storage workflow.

Provision fresh synthetic users through `node scripts/provision-cloud-tests.mjs` before a full hosted run. It uses the supported Auth Admin API and preserves previous records. Credentials are stored only under ignored `work/`; the application does not load the test administrator key. Build first, then run the cloud Playwright scenario with `RUN_CLOUD_E2E=true`. Never edit internal Auth tables.

Public customer sessions, cloud Gemini/usage processing, staff assignment, conversation search and external delivery remain unfinished.
