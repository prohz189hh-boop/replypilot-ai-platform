# Third-party licensing scope

The root MIT license applies to eligible ReplyPilot-owned code and documentation. It does not replace third-party licenses or establish ownership of third-party materials.

## Repository review

At the licensing checkpoint, the tracked repository contained application source, documentation, tests, configuration and database migrations. No existing root license, vendored dependency source, or tracked image/font assets were found. The previous root package metadata said `UNLICENSED`; the project owner's explicit MIT instruction supersedes that designation for eligible project materials. This repository review is not an independent chain-of-title certification.

Framework-generated files (including Next.js agent guidance and type references) retain their upstream provenance. Dependencies are installed separately through npm and are not relicensed by the root LICENSE. Their packaged LICENSE, COPYING and NOTICE files must be retained when applicable, including when distributing bundled or compiled artifacts.

## Direct dependencies

The installed direct package metadata identifies these licenses:

| License | Packages |
| --- | --- |
| Apache-2.0 | `@ai-sdk/google`, `ai`, `sharp`, `@electric-sql/pglite`, `@playwright/test`, `typescript` |
| ISC | `lucide-react` |
| MIT | `@radix-ui/react-dialog`, `@supabase/ssr`, `@supabase/supabase-js`, `csv-parse`, `csv-stringify`, `next`, `react`, `react-dom`, `server-only`, `zod`, `@tailwindcss/postcss`, `@types/node`, `@types/react`, `@types/react-dom`, `eslint`, `eslint-config-next`, `fflate`, `prettier`, `tailwindcss`, `tsx`, `vitest` |

This inventory summarizes direct package metadata, not the complete transitive dependency or binary distribution notice set. Consult the pinned lockfile and each distributed package's actual license and notice files. For example, icon and native image-processing distributions may carry additional upstream notices. No upstream notices were removed by adding the project license.

Google/Gemini, Supabase, Meta/WhatsApp and other service names identify integrations; their trademarks, services, credentials and service terms are not licensed by ReplyPilot's MIT grant.
