# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added weekly Renovate updates with automatic merging for patch and minor releases, manual review for major releases, and lockfile maintenance.
- Added a separate Chromium Playwright job to CI.

### Changed

- Aligned CI with the local quality gate by running lint, typecheck, tests, unused-code checks, and build on Node.js 20.19.0.
- Clarified that Durable Object rate limiting, Queues, and Cron support are included addons that require explicit `wrangler.jsonc` configuration.
- Added a doctor warning when the `RATE_LIMITER` Durable Object binding is not configured.

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
