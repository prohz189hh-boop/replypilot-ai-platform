# Cloud AI accounting preparation

Status: migration prepared and verified in PGlite; **not applied to hosted Supabase**. Cloud Gemini routes and controls remain disabled. This is a foundation, not completed cloud AI parity.

The current session does not have the Supabase management connector available. No application credential was added or changed, and the fixture-only administrator key was not repurposed for application use.

## Trust boundary

Browser users must not submit trusted provider usage, refund attempts or forge Gemini attribution. The prepared migration exposes reservation/completion RPCs only to `service_role`, with private RLS-protected ledger tables. A future trusted worker must authenticate the original user independently and pass that verified identity; reservation then checks tenant membership, conversation ownership/takeover, consent, mode and active subscription.

A dedicated server execution boundary is required before enabling these calls in the application. Do not use `.env.cloud-test` in the web server. Do not expose service credentials or these trusted operations through an unrestricted proxy. The existing user-session cloud client cannot invoke them.

## Accounting behavior

- Reserve a reply request and provider attempt atomically before contacting Gemini.
- A repeated attempt ID is rejected, never interpreted as permission to call the provider again.
- Seven-day trials permit 30 reserved requests across the trial. Paid plans use their monthly reply limits and UTC calendar months. Reservations, including unknown or failed work, conservatively consume quota; no browser refund is available.
- A completed 503 may authorize one separately counted retry. Pending, successful, timeout and 429 attempts cannot trigger another call. There is no lease-based automatic retry of uncertain provider work.
- Each organization has a hard ceiling of 30 daily attempts, with a shared 100-attempt UTC daily cap. These are call caps, not a guarantee about an external invoice or account billing tier.
- Usage remains null when unknown. Only numeric usage and allowlisted errors are stored, with no message body, prompt, API key or raw exception.

## Adapter and diagnostics

`generateSyntheticReply` accepts a server-owned asynchronous `ProviderRuntime`. Its default SQLite implementation retains existing limits, accounting and consent checks. Cloud integration must supply the verified durable backend; client callbacks must never be accepted. The catalog grounding and locale validation remain unchanged.

Transport diagnostics record elapsed milliseconds, response-header milliseconds, HTTP status and stage only. `before_headers` cannot distinguish DNS, connection, network transit and upstream generation delays by itself. A successful response whose time is close to the deadline does not establish the cause of older failures.

A single diagnostic can be run deliberately with:

```powershell
node --conditions=react-server --import tsx scripts/diagnose-gemini.ts --run-once
```

It uses the existing ignored configuration, creates a fictional local workspace, records one metered attempt, disables the 503 retry and reports safe diagnostics. It is not part of the default test suite.

## Next integration work

Apply and inspect the migration through the authorized Supabase development management connection, run hosted role/tenant tests, provision a properly scoped trusted worker boundary, then connect owner consent/settings, durable request completion, current-catalog validation, message publishing and usage dashboards. Recheck consent, language preference, catalog version and takeover before publishing any asynchronous result. Do not enable cloud generation until that full workflow passes.
