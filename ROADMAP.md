# ROADMAP

`cf-starter` を、Cloudflare 上で業務アプリを量産するための基盤として育てるための roadmap です。

## Phase 1: Security Baseline

目的:

- 公開してもすぐ危険にならない最小線を作る

状態:

- 完了

含まれるもの:

- PBKDF2 password hashing
- session cookies
- CSRF protection
- request id
- structured logs
- unified error contract
- rate limit
- audit log

## Phase 2: Starter Core Stability

目的:

- バックとフロントの契約を壊れにくくする
- build / test / deploy の基本線を固定する

状態:

- 進行中

完了済み:

- Hono RPC client
- Vite build
- Vitest
- Queue sample jobs
- Cron session cleanup

残り:

- README / architecture docs の継続改善
- optional module install plan

## Phase 3: Organization-Aware Core

目的:

- user 単体ではなく `organization の中の user` を扱えるようにする

状態:

- 進行中

完了済み:

- `organizations`
- `memberships`
- `sessions.current_org_id`
- personal workspace 作成
- `/api/orgs`
- `/api/auth/switch-org`
- auth context への `orgId` / `orgRole` / `memberships` 追加

次:

- invite lifecycle
- organization admin UI

## Phase 4: Real App Readiness

目的:

- 派生アプリで毎回必要になる実務機能を core に寄せる

次候補:

1. organization invite lifecycle
2. password reset
3. email verification
4. organization-aware feature examples

## Phase 5: App Factory Readiness

目的:

- AI が新しいアプリを迷わず切れる状態にする

前提:

- README が starter として正しい
- architecture が固定されている
- roadmap が現在地を示している
- core と example の境界が明確

未着手:

- APP_FACTORY.md
- generation playbook
- install / bootstrap scripts の強化
