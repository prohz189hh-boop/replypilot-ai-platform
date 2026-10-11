# ReplyPilot AI 2.0 — implementation status

New standalone repository. No old ReplyPilot or unrelated project was used.

## Current milestone
Milestone 1: foundation in progress. Dependencies are being installed and the first production build is pending.

## External blockers
- GitHub CLI installed; browser authentication requested, pending account holder.
- Supabase organization selected with free-tier-only constraint. Connected cost-check operation returned UNAVAILABLE; cannot verify free provisioning. No existing project modified.
- Gemini API key and explicitly selected model absent. Default deterministic mock provider.
- Real billing and external messaging disabled. No public production deployment authorized.

## Production readiness
Not ready. Local development will use a persistent SQLite adapter with tenant-scoped server operations. This is not a verified Supabase production deployment.

## Next actions
Build and test the foundation, then implement complete local accounts → catalog → chat → order flow. Track actual verification below as it occurs.
