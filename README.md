# cf-starter

Cloudflare Workers 上で、小規模から中規模の業務アプリを安定して立ち上げるためのスターターです。

目的は `1つのアプリを育てること` ではなく、`複数のアプリを安全に始められる土台を揃えること` です。

このリポジトリは 2 層で考えます。

- Starter Core: 認証、セッション、権限、organization context、API 契約、DB、ログ、テスト、Cloudflare bindings
- Example Features: `items`、`kv`、`upload` のような最小サンプル

設計の詳細は [ARCHITECTURE.md](/tmp/cf-starter-clean/ARCHITECTURE.md)、今後の進行は [ROADMAP.md](/tmp/cf-starter-clean/ROADMAP.md) を参照してください。

## 何が入っているか

現在の core は次を提供します。

- React + TypeScript + Tailwind CSS v4
- Hono on Cloudflare Workers
- D1 + Drizzle ORM
- Zod による shared schema
- Hono RPC client による型付き API 呼び出し
- D1 session + HttpOnly Cookie 認証
- PBKDF2-SHA256 パスワードハッシュ
- CSRF 保護
- request id
- 構造化 JSON ログ
- 統一 API エラー形式
- Durable Object ベースの auth rate limit
- audit log
- Cloudflare Queue sample jobs
- organization / membership / current organization context
- password reset request / confirm flow
- email verification request / confirm flow
- Vitest ベースの自動テスト

## 向いている用途

- 地域向け業務ツール
- 会員制サービス
- 予約、台帳、在庫、配車、マッチング
- 1人から少人数で運用する Cloudflare ネイティブな Web アプリ

## 向いていない用途

- 巨大 SaaS 向けの複雑なマイクロサービス構成
- 重いリアルタイム同期が中心のシステム
- GPU 前提の AI ワークロード

## スタック

| レイヤー | 技術 |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS + TanStack Query |
| Backend | Hono on Cloudflare Workers |
| Database | D1 (SQLite) + Drizzle ORM |
| Storage | R2 |
| Cache | KV |
| Rate limit | Durable Object |
| Async jobs | Cloudflare Queues |
| Validation | Zod |
| Build | Vite + `@cloudflare/vite-plugin` |
| Testing | Vitest |

## クイックスタート

### 前提

- Node.js 20+
- npm
- Wrangler CLI

### ローカル開発

```bash
npm install
npm run db:migrate
npm run dev
```

### Cloudflare へデプロイ

```bash
# 1. リソース作成
wrangler d1 create my-app-db
wrangler kv namespace create KV
wrangler r2 bucket create my-app-bucket
wrangler queues create my-app-jobs

# 2. wrangler.jsonc の bindings / ids を更新
# 3. リモート DB へ migration 適用
npm run db:migrate:remote

# 4. デプロイ
npm run deploy
```

## コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 統合開発モード |
| `npm run dev:split` | Wrangler と Vite を分離起動 |
| `npm run build` | ビルド |
| `npm run preview` | ビルド後プレビュー |
| `npm run deploy` | Cloudflare にデプロイ |
| `npm test` | 自動テスト |
| `npm run test:watch` | テスト watch |
| `npm run db:generate` | Drizzle から migration 生成 |
| `npm run db:migrate` | ローカル D1 に migration 適用 |
| `npm run db:migrate:remote` | リモート D1 に migration 適用 |
| `npm run modules:plan` | binding ベースの module 導入状況を確認 |
| `npm run modules:plan:json` | module plan を JSON で出力 |
| `npm run app:plan` | starter core と example feature の切り分けを確認 |
| `npm run app:plan:core` | core-only で始めるときの削除対象を確認 |
| `npm run app:plan:json` | app plan を JSON で出力 |
| `npm run app:plan:core:json` | core-only app plan を JSON で出力 |
| `npm run app:scaffold -- --target ../new-app` | 新しい app ディレクトリを scaffold |

## ディレクトリ構成

```text
cf-starter/
├── app/                    React UI
│   ├── features/example/   example feature hooks
│   ├── hooks/              core hooks
│   └── lib/api.ts          型付き Hono RPC client
├── shared/                 フロント・バック共有契約
│   ├── features/example/   example feature schema
│   └── schemas/            core schema
├── src/                    Worker backend
│   ├── db/                 Drizzle schema
│   ├── durable-objects/    rate limiter
│   ├── features/example/   example feature routes
│   ├── lib/                auth, session, audit, organizations など
│   ├── middleware/         auth, csrf, role, request-id
│   ├── queues/             queue producer / consumer
│   ├── routes/             core API routes
│   └── index.ts            Worker entrypoint
├── migrations/             D1 migrations
├── scripts/                補助スクリプト
├── test/                   unit / integration tests
├── ARCHITECTURE.md
├── ROADMAP.md
└── README.md
```

## Core API

| エンドポイント | 内容 |
|---|---|
| `GET /api/health` | DB / KV / R2 / Env の基本チェック |
| `GET /api/modules` | core / optional module の runtime status |
| `GET /api/orgs` | 所属 organization 一覧と current organization |
| `POST /api/orgs` | organization 作成 + current organization 切替 |
| `GET /api/orgs/current/invites` | current organization の招待一覧 |
| `POST /api/orgs/current/invites` | current organization の招待作成 |
| `POST /api/orgs/invites/accept` | organization 招待承諾 |
| `POST /api/auth/signup` | ユーザー登録 |
| `POST /api/auth/login` | ログイン |
| `POST /api/auth/logout` | ログアウト |
| `POST /api/auth/switch-org` | current organization 切替 |
| `POST /api/auth/password-reset/request` | password reset 開始 |
| `POST /api/auth/password-reset/confirm` | password reset 完了 |
| `POST /api/auth/email-verification/request` | verification mail 再送 |
| `POST /api/auth/email-verification/confirm` | email verification 完了 |
| `GET /api/auth/me` | 現在のユーザー取得 |

## Example Feature API

| エンドポイント | 内容 |
|---|---|
| `GET /api/items` | current organization の item 一覧 |
| `POST /api/items` | current organization に item 作成 |
| `GET /api/upload` | current organization prefix の R2 ファイル一覧取得 |
| `POST /api/upload` | current organization prefix に R2 アップロード |
| `GET /api/kv/:key` | current organization scope の KV 読み取り |
| `PUT /api/kv/:key` | current organization scope の KV 書き込み |

## Security Invariants

現在の core で維持している前提です。

- session cookie は HttpOnly
- パスワードは PBKDF2 で保存
- 旧 `salt:sha256` 形式は login 時に upgrade
- write 系 API は CSRF 保護
- auth API は rate limit 付き
- すべてのエラーは `{ error: { code, message, requestId, details? } }`
- 監査ログは `audit_logs` に保存
- `X-Request-Id` をレスポンスとログに載せる
- organization context は `memberships` と `sessions.current_org_id` で解決

## Organization Context

`cf-starter` は user 単体ではなく、`organization の中の user` を扱えるようにしています。

- `organizations`
- `memberships`
- `sessions.current_org_id`

signup / login 時には personal workspace を自動作成し、session に current organization を持たせます。

招待の基本ライフサイクルも core に含みます。

- `organization_invites`
- owner / admin による招待作成
- login 済みユーザーによる招待承諾
- 招待 token は作成レスポンスでのみ返す
- 一覧 API は `pending / accepted / expired` を返す

認証後の context では次が使えます。

- `c.get("orgId")`
- `c.get("orgRole")`
- `c.get("memberships")`

新しい業務テーブルを multi-tenant にする場合は、`organization_id` を持たせてここで絞ってください。

## Queue

`JOBS` Queue binding を持ち、現在は sample job として次を enqueue します。

- `user.welcome`
- `upload.process`

consumer は Worker module の `queue()` handler で処理します。

organization invite 作成時には `organization.invite_email` job も enqueue されます。
現状の consumer は delivery payload を structured log に出す実装で、実メール送信プロバイダへの差し替え点として使います。

password reset request 時には `auth.password_reset_email` job も enqueue されます。
signup と verification 再送時には `auth.email_verification_email` job も enqueue されます。
`EMAIL_PROVIDER=resend`、`RESEND_API_KEY`、`EMAIL_FROM` を設定すると Resend 経由で実送信します。未設定時は `log` fallback です。

## Module Plan

- runtime: `GET /api/modules`
- runtime: `GET /api/health` の `modules`
- CLI: `npm run modules:plan`
- CLI: `npm run modules:plan:json`

`modules:plan` は `wrangler.jsonc` を読み、core / optional module の導入状況を一覧表示します。
`modules:plan:json` は同じ情報を機械可読な JSON で返します。

## App Plan

- CLI: `npm run app:plan`
- CLI: `npm run app:plan:core`
- CLI: `npm run app:plan:json`
- CLI: `npm run app:plan:core:json`

`app:plan` は、新しいアプリを切るときに `core として残す部分` と `example として置き換える部分` を一覧表示します。
`app:plan:core` は example feature を外して core-only で始める前提の出力です。
JSON variants は将来の scaffold や CI から plan を読むための出口です。

## App Scaffold

- `npm run app:scaffold -- --target ../new-app`
- `npm run app:scaffold -- --target ../new-app --core-only`
- `npm run app:scaffold -- --target ../new-app --app-name regional-ops`
- `npm run app:scaffold -- --target ../new-app --exclude kv,upload`
- `npm run app:scaffold -- --target ../new-app --include items`

`app:scaffold` は現在の starter を別ディレクトリへコピーします。
`--core-only` を付けると example feature を外し、`src/index.ts` と `app/App.tsx` を core-only 用に置き換えます。
`--app-name` を付けると `package.json`、`wrangler.jsonc`、`README.md`、`app/App.tsx` の名前を生成先用に書き換えます。
`--include` / `--exclude` を付けると example feature を選択して残せます。

## Feature Structure

`cf-starter` は段階的に feature-based structure へ寄せています。

- core routes: `src/routes/`
- example feature routes: `src/features/example/*/routes.ts`
- core hooks: `app/hooks/`
- example feature hooks: `app/features/example/*/hooks/`
- core schema: `shared/schemas/`
- example feature schema: `shared/features/example/`

新しい業務機能を追加する場合は、まず `core` へ入れるべき共通機能か、`example` や派生アプリ固有の feature かを分けてから配置してください。
example feature であっても、業務テーブルは `organization_id` を持たせて current organization で絞るのを基本にします。

## 開発の流れ

### API を追加する

1. `src/routes/` に route を追加
2. `src/index.ts` で `.route()` 登録
3. `app/lib/api.ts` 経由でフロントから呼ぶ

### テーブルを追加する

1. `src/db/schema.ts` にテーブル定義を追加
2. `npm run db:generate`
3. `npm run db:migrate`

### organization-aware にする

1. テーブルに `organization_id` を追加
2. 認証済み route で `c.get("orgId")` を使って絞る
3. 必要なら membership role で認可する

## 本番チェックリスト

- [ ] `wrangler.jsonc` の `database_id` / KV / R2 / Queue binding を実値にする
- [ ] `CORS_ORIGIN` を本番 origin にする
- [ ] `COOKIE_SAME_SITE` / `COOKIE_SECURE` を運用に合わせる
- [ ] Durable Object migration tag を必要に応じて更新する
- [ ] Queue 名を変更した場合は producer / consumer を揃える
- [ ] auth rate limit の閾値を要件に合わせる
- [ ] `scheduled` cleanup が本番でも動くことを確認する

## 現在の不足

まだ入っていないものです。

- feature-based structure への整理
