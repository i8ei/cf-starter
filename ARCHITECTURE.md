# ARCHITECTURE

この文書は `cf-starter` の構造を、人間と AI の両方が読みやすい形で固定するためのものです。

## 目的

`cf-starter` は Cloudflare ネイティブな業務アプリを、少人数で安全に立ち上げるための基盤です。

目的は次です。

- 認証、権限、DB、ログ、エラー契約を毎回作り直さない
- AI が既存設計を壊さずに改善を継続できる
- 小規模から中規模の業務ツールを短期間で始められる

## システム概要

主要な流れは次です。

1. React UI
2. Hono RPC client
3. Hono routes on Workers
4. middleware
5. business logic
6. Drizzle ORM
7. D1

補助インフラとして次を持ちます。

- KV
- R2
- Durable Objects
- Queues
- Cron

## Starter Core と Example Features

このリポジトリでは、次を分けて考えます。

### Starter Core

- auth
- sessions
- organization context
- RBAC
- CSRF
- request id
- structured logging
- audit log
- error contract
- queue handling
- migration / build / test flow

### Example Features

- `items`
- `kv`
- `upload`

example feature は使い方の見本であり、すべての派生アプリに残す前提ではありません。

## 認証

現在の認証方式:

- D1 table: `sessions`
- D1 table: `password_reset_tokens`
- D1 table: `email_verification_tokens`
- Cookie: HttpOnly
- Password hash: `PBKDF2-SHA256`
- Legacy upgrade: 旧 `salt:sha256` は login 時に upgrade

セッション方針:

- login ごとに再発行
- user あたり 1 セッションに寄せる
- logout で削除
- Cron で期限切れを削除

## Organization Context

organization-aware なアプリを前提に、core で次を持ちます。

- `organizations`
- `memberships`
- `sessions.current_org_id`
- `organization_invites`

middleware 後の route では次を参照できます。

- `c.get("userId")`
- `c.get("roles")`
- `c.get("orgId")`
- `c.get("orgRole")`
- `c.get("memberships")`

`requireAuth` は session の `current_org_id` を membership と照合し、必要なら session を補正します。

organization 招待は次の前提で扱います。

- current organization に対して owner / admin が招待を作成する
- 招待 token は DB には hash で保持する
- 承諾は login 済みユーザーのみ
- 招待 email と login 中の user email が一致しない場合は拒否する

## 認可

現在の認可は 2 層です。

- global role: `user_roles`
- organization membership role: `memberships.role`

使い分け:

- platform-level の判定: `requireRole()`
- tenant-level の絞り込み: `orgId` と `orgRole`

## API 契約

すべての API エラーは次の形を返します。

```json
{
  "error": {
    "code": "forbidden",
    "message": "Forbidden",
    "requestId": "..."
  }
}
```

validation error も同じ envelope に入れます。

## ログ

ログは JSON structured log を基本とします。

主に出す項目:

- requestId
- method
- path
- userId
- event

`X-Request-Id` はレスポンスにも載せます。

## 監査ログ

`audit_logs` は重要操作の DB 監査ログです。

含む情報:

- actorUserId
- organizationId
- action
- resourceType
- resourceId
- status
- requestId
- metadata

## Queue

`JOBS` Queue binding を持ち、sample job を処理します。

- `user.welcome`
- `upload.process`
- `organization.invite_email`
- `auth.password_reset_email`
- `auth.email_verification_email`

consumer は `src/queues/jobs.ts` と Worker module の `queue()` handler に集約します。
invite email job は `inviteUrl` を含む delivery payload を作り、現状は structured log へ出します。
password reset email job は `resetUrl` を含む delivery payload を作り、現状は structured log へ出します。
email verification job は `verifyUrl` を含む delivery payload を作り、現状は structured log へ出します。

## Security Invariants

AI や開発者は、次を壊さないでください。

- password hash を平文や弱いハッシュへ戻さない
- CSRF 保護を削らない
- request id を外さない
- error contract を route ごとにバラバラにしない
- organization context を無視して multi-tenant data を読む route を増やさない
- 監査対象の操作から audit log を外さない

## 現在の不足

現時点で未実装、または弱いものです。

- optional module install plan
- feature-based structure への整理

## 次の方向

次の優先は次です。

1. password reset hardening
2. optional module install plan
3. docs と app generation path の整備
