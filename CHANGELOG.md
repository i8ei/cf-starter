# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added Record Engine support for audit metadata exclusion via `sensitive: true` or `audit: false` field options.
- Added a Workers AI addon entry point (`/api/ai/example/prompt`) and optional `AI` binding documentation.
- Added an organization-creation screen for better-auth users with no organization memberships. Self-signup users without an invitation were previously stuck on a permanent loading screen.
- Added weekly Renovate updates with automatic merging for patch and minor releases, manual review for major releases, and lockfile maintenance.
- Added a separate Chromium Playwright job to CI.
- Split reference detail out of `CLAUDE.md` into topic files under `docs/` (auth, frontend, ui-kit, runbook, record-engine, patterns), cutting the always-loaded `CLAUDE.md` from ~38KB to ~11KB while keeping load-bearing invariants, Record Engine footguns, and security musts in the root file. Added a task-triggered docs map so assistants read the right detail file before editing.
- Added `npm run docs:check` to guard `CLAUDE.md` against bloat (byte budget), wired into template CI only (skipped in derived apps by repository name).

### Changed

- Record Engine generated hooks now infer success response types from the Hono client using `InferResponseType`.
- Moved Record Engine route/hook templates into pure generator functions covered by unit tests.
- Record Engine date fields now validate real calendar dates, not just the `YYYY-MM-DD` shape.
- Record Engine page imports now use the source record file path so `key` and filename may differ.
- Enabled the `RATE_LIMITER` Durable Object binding and its migration by default so auth endpoints are rate-limited out of the box.
- Enabled a daily Cron Trigger by default for scheduled maintenance such as expired session cleanup.
- Limited Better Auth's wildcard localhost trusted origin to local/non-secure-cookie development.
- Centralized Better Auth cookie `secure` and `sameSite` handling through `getAppConfig`.
- Stopped returning the first configured CORS origin when requests have no `Origin` header.
- Aligned CI with the local quality gate by running lint, typecheck, tests, unused-code checks, and build on Node.js 20.19.0.
- Updated addon documentation: Durable Object rate limiting and Cron are now default-on; Queues and Workers AI remain opt-in.
- The Workers AI example route (`/api/ai/example/prompt`) now requires authentication in addition to per-IP rate limiting.
- Better Auth catch-all rate limiting now applies only to mutating requests, so reads (get-session, organization list) from shared IPs (office NAT, mobile CGNAT) are no longer throttled.

### Fixed

- `security-check` now verifies required secrets via `wrangler secret list` and blocks plaintext secrets committed to `wrangler.jsonc` vars. Previously it only accepted secrets placed in vars, which blocked correctly configured deploys and encouraged committing secrets to git.
- Logout now also clears the `__Secure-`-prefixed Better Auth session cookie used when cookies are marked Secure (production).

## [2.1.0]

### Added

- **Phase 1 — Security Baseline:** PBKDF2 password hashing, session cookies, CSRF protection, request IDs, structured logs, a unified error contract, rate limiting, and audit logs.
- **Phase 2 — Starter Core Stability:** Hono RPC client integration, the unified Vite build, Vitest coverage, Queue sample jobs, and Cron session cleanup.
- **Phase 3 — Organization-Aware Core:** Organization and membership models, personal workspaces, organization switching, invitation lifecycle support, organization-aware auth context, feature-based structure, modular auth routes, and shared crypto utilities.
- **Phase 4 — Record Engine v0.1:** Record definitions, full-stack code generation, generated Drizzle/Zod/Hono/TanStack Query code, reusable record pages and fields, status and table components, routing, audit integration, and type-safety and UX improvements.
- **Phase 6 — Agent-Ready CLI:** A unified `cf-starter` CLI with doctor, environment planning, database migration and seeding, record generation, deploy planning, machine-readable output, and contract tests.
- **Phase 7 — Deploy DX:** Automated project initialization, remote setup, production-origin diagnostics, local environment overrides, and shared app-specific seed conventions.
- **Phase 8 — Dashboard UI Kit:** Recharts wrappers, dashboard components, public layout support, public API patterns, and shared number formatting.
- **Phase 9 — Better Auth:** Three authentication modes, per-request Better Auth integration, admin and organization plugins, invitation acceptance, Queue/direct email delivery, active organization sessions, and organization membership constraints.

### Changed

- **Phase 3:** Reorganized authentication routes and feature boundaries around organization-aware context.
- **Phase 5 — Deletion Boundaries:** Removed obsolete scaffold and module tooling, eliminated core imports from the optional Record Engine, and documented safe removal paths.
- **Phase 8:** Added automatic `AppShell` and `PublicShell` selection for authenticated and public applications.
- **Phase 9:** Replaced the custom authentication and organization implementation with Better Auth while preserving `none`, `simple-admin`, and `better-auth` modes.

### Removed

- **Phase 5:** Removed obsolete meta-tooling, examples, module infrastructure, and scaffold markers.
- **Phase 9:** Removed custom password, RBAC, password-reset, email-verification, user-session, and organization implementations superseded by Better Auth.

### Security

- **Phase 1:** Established the baseline security middleware and audit controls.
- **Phase 9:** Added banned-user enforcement, constant-time password comparison, trusted-origin handling, organization-aware foreign keys, and stricter remote deployment validation.
