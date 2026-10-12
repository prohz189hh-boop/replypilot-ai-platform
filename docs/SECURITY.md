# Security boundaries and verification

ReplyPilot is a loopback-only development application. Public repository access does not grant access to its private configuration. This is not a claim that a credential cannot be misused if obtained elsewhere.

## Gemini credentials

The existing key and model stay in ignored `.env.local`. The fixture-only Supabase administrator key stays in ignored `.env.cloud-test`, which the application launcher never loads. Neither file is tracked. Do not copy either file into public assets or deployment directories. Future deployments must use protected server environment variables.

Gemini modules import `server-only`, which makes Next reject client imports at build time. The browser calls ReplyPilot routes; those routes enforce either a staff session and tenant membership or a high-entropy, tenant-bound customer conversation capability. The optional fixed-data Gemini diagnostic requires a platform administrator. The public demonstration remains mock by default.

Gemini requests require fictional-workspace consent, an active entitlement, reserved reply quota and the persistent daily provider call cap. Each retry consumes another daily call. Inputs, outputs and timeouts are bounded. Provider diagnostics store allowlisted error codes and usage counts, never raw exceptions, prompts or credentials. Unknown usage remains unknown. The application does not prove the external account's billing tier or invoice amount.

## Audit

Run `npm run build`, `npm run audit:secrets` and `npm run test:e2e`. The audit compares current private configuration values (including common encodings) and recognizable credential signatures against working source, staged changes, reachable Git history, public assets and generated build/test artifacts. Findings identify locations without printing matching values. No history rewriting or credential rotation is performed by the audit.

This is a repeatable exposure check, not proof against every unknown credential format, arbitrary encoding, external log destination or future defect. Credentials shared outside the repository require separate account-level protection. The current key is deliberately preserved at the owner's request.

Tests use fabricated credential canaries for errors and provider failures. Browser tests check actual configured values using boolean assertions so failures do not print the key. They verify anonymous/ordinary-user diagnostic denial, cross-tenant conversation denial, oversized requests, API output and browser assets. Mocked provider tests verify quota exhaustion before an upstream call, duplicate reservations and safe fallback. Explicit live tests remain separate and are run only when needed.

## Data and deployment

Local and cloud paths remain separate. Supabase uses the publishable key and each user's verified session, RLS and membership-checked operations. No service key is used by application routes. API responses are private/no-store. Real messaging, paid billing and commercial deployment remain disabled.
