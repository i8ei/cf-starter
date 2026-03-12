# cf-starter

Cloudflare Workers 上で、小規模から中規模の業務アプリを安定して立ち上げるための starter です。

目的は `1つのアプリを育てること` ではなく、`複数のアプリを安全に始められる core を揃えること` です。

デフォルトの導線は `core-first` です。

- Core: 認証、セッション、権限、organization context、API 契約、DB、ログ、テスト、Cloudflare bindings
- Optional examples: `examples/feature-packs/` に置いた `items`、`kv`、`upload` の最小サンプル

設計の詳細は [ARCHITECTURE.md](./ARCHITECTURE.md)、今後の進行は [ROADMAP.md](./ROADMAP.md) を参照してください。

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
- Cloudflare Queues integration
- organization / membership / current organization context
- password reset request / confirm flow
- email verification request / confirm flow
- Vitest ベースの自動テスト
- Record Engine（レコード定義 → コード一発生成）
- wouter による SPA ルーティング

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
| Frontend | React + TypeScript + Tailwind CSS + TanStack Query + wouter |
| Backend | Hono on Cloudflare Workers |
| Database | D1 (SQLite) + Drizzle ORM |
| Storage | R2 (optional) |
| Cache | KV (optional) |
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

### 新しい app を切る

```bash
npx . regional-ops
npx . regional-ops --include items
npx . regional-ops --plan --json
```

デフォルトは `core-only` です。example feature を含めたい時だけ `--include` を使います。`--starter` は bundled examples を全部入れる互換ショートカットです。

```bash
npx . regional-ops --include items,upload
npx . regional-ops --starter
```

`create-cf-starter` は npm 公開前です。公開後は `npx create-cf-starter@latest regional-ops` を入口にします。

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
| `npm run test:create` | create CLI で temp app を生成し、install + build まで確認 |
| `npm run test:watch` | テスト watch |
| `npm run check:publish` | npm publish 前提の package / tarball チェック |
| `npm run doctor` | generated app に starter 残骸がないか検査 |
| `npm run db:generate` | Drizzle から migration 生成 |
| `npm run db:migrate` | ローカル D1 に migration 適用 |
| `npm run db:migrate:remote` | リモート D1 に migration 適用 |
| `npm run seed:demo` | ローカル D1 に demo user / org を投入 |
| `npm run record:generate -- --record shared/records/xxx.ts` | Record Engine でコード生成 |
| `npx . my-app` | 未公開の create CLI をローカルから実行 |
| `npx . my-app --include items` | selected example feature を含めて app を作る |
| `npx . my-app --starter` | bundled example feature を全部入れる互換ショートカット |
| `npx . my-app --plan --json` | create plan を JSON で確認 |

## Optional Examples

bundled examples は default app の一部ではなく、`examples/feature-packs/` に退避しています。

- `items`: D1 + organization scope の最小 CRUD
- `kv`: organization scope の KV read/write
- `upload`: R2 upload/list と queue enqueue

新しい app を空の業務アプリとして始めたい場合は無視して構いません。必要な時だけ `--include` で持ち込みます。全部欲しい時だけ `--starter` を使います。

## Record Engine

レコード定義を書いて CLI を実行すると、バックエンド（Drizzle テーブル + Zod スキーマ + Hono CRUD ルート）とフロントエンド（TanStack Query hooks）が一発生成されます。生成後はただのコード — 自由に編集できます。

### レコード定義の例

```typescript
// shared/records/requests.ts
import { defineRecord } from "../lib/record-def";

export const requestRecord = defineRecord({
  key: "request",
  label: "配車依頼",
  tableName: "requests",
  fields: {
    passengerName: { type: "text", label: "利用者名", required: true, maxLength: 100 },
    pickupDate:    { type: "date", label: "乗車日", required: true },
    passengers:    { type: "number", label: "人数", min: 1, max: 10, defaultValue: 1 },
    vehicleType:   { type: "select", label: "車種", options: ["sedan", "van"] },
    notes:         { type: "text", label: "備考", multiline: true },
  },
  status: {
    field: "status",
    label: "ステータス",
    options: ["受付", "配車済", "完了", "取消"],
    defaultValue: "受付",
  },
  listView: {
    columns: ["passengerName", "pickupDate", "vehicleType", "status"],
    defaultSort: { field: "pickupDate", direction: "desc" },
  },
  formView: {
    sections: [
      { label: "利用者情報", fields: ["passengerName", "passengers"] },
      { label: "行程", fields: ["pickupDate", "vehicleType"] },
      { label: "備考", fields: ["notes"] },
    ],
  },
});
```

### コード生成

```bash
npm run record:generate -- --record shared/records/requests.ts
npm run db:generate
npm run db:migrate
```

### 生成物

| ファイル | 内容 |
|---------|------|
| `src/db/schema.ts` に追記 | Drizzle テーブル定義 |
| `shared/features/{key}/schema.ts` | Zod create / update スキーマ |
| `src/features/{key}/routes.ts` | CRUD + GET /:id + PATCH /:id/status |
| `app/features/{key}/hooks/use{Key}.ts` | TanStack Query hooks |
| `src/index.ts` に追記 | ルート登録 |

### フィールド型

| type | Drizzle | Zod | UI |
|------|---------|-----|----|
| text | `text()` | `z.string().max(N)` | `<input>` / `<textarea>` |
| number | `integer()` | `z.number().min().max()` | `<input type="number">` |
| date | `text()` (ISO) | `z.string().regex(...)` | `<input type="date">` |
| select | `text()` | `z.enum([...])` | `<select>` |
| relation | `integer()` | `z.number().int()` | `<select>` |
| file | `text()` (R2 key) | `z.string()` | upload widget |

### 汎用 UI コンポーネント

生成後、フロントエンドは汎用レコードページを使って組めます:

- `RecordListPage` — status filter tabs 付き一覧
- `RecordDetailPage` — 詳細表示 + status 変更ボタン
- `RecordFormPage` — sections ベースのフォーム

## ディレクトリ構成

```text
cf-starter/
├── app/                    React UI
│   ├── components/         共通 UI コンポーネント
│   │   ├── fields/         フォーム用フィールドコンポーネント
│   │   ├── AppShell.tsx    ナビゲーション付きレイアウト
│   │   ├── DataTable.tsx   テーブル表示
│   │   ├── Panel.tsx       カードUI
│   │   ├── StatusBadge.tsx ステータスバッジ
│   │   └── StatusFilterTabs.tsx ステータスフィルタータブ
│   ├── features/           feature hooks（生成物もここ）
│   ├── hooks/              core hooks
│   ├── lib/api.ts          型付き Hono RPC client
│   ├── pages/              ページコンポーネント
│   │   ├── records/        汎用レコード画面（List / Detail / Form）
│   │   ├── AuthPage.tsx    認証画面
│   │   ├── HomePage.tsx    トップページ（スターター案内）
│   │   └── SettingsPage.tsx 組織設定画面
│   └── App.tsx             wouter ルーティング
├── shared/                 フロント・バック共有契約
│   ├── features/           feature schemas（生成物もここ）
│   ├── lib/record-def.ts   Record Engine 型定義
│   ├── records/            レコード定義ファイル
│   └── schemas/            core schema
├── src/                    Worker backend
│   ├── db/                 Drizzle schema
│   ├── durable-objects/    rate limiter
│   ├── features/           feature routes（生成物もここ）
│   ├── lib/                auth, session, audit, organizations など
│   ├── middleware/          auth, csrf, role, request-id
│   ├── queues/             queue producer / consumer
│   ├── routes/             core API routes
│   └── index.ts            Worker entrypoint
├── scripts/
│   ├── generate-record.mjs Record Engine コードジェネレーター
│   └── ...
├── examples/
│   └── feature-packs/      optional example features
├── migrations/             D1 migrations
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

`JOBS` Queue binding を持ち、core と optional examples の両方で job を enqueue します。

- `user.welcome`

consumer は Worker module の `queue()` handler で処理します。

organization invite 作成時には `organization.invite_email` job も enqueue されます。
現状の consumer は delivery payload を structured log に出す実装で、実メール送信プロバイダへの差し替え点として使います。

password reset request 時には `auth.password_reset_email` job も enqueue されます。
signup と verification 再送時には `auth.email_verification_email` job も enqueue されます。
`EMAIL_PROVIDER=resend`、`RESEND_API_KEY`、`EMAIL_FROM` を設定すると Resend 経由で実送信します。未設定時は `log` fallback です。

`upload.process` は `upload` example feature を含めた時だけ使います。

## Module Status

- runtime: `GET /api/modules`
- runtime: `GET /api/health` の `modules`

`GET /api/modules` は `wrangler.jsonc` の binding 状態に基づいて、core / optional module の導入状況を返します。
`GET /api/health` の `modules` でも同じ系統の状態を確認できます。

## Create Flow

- `npx . ../new-app`
- `npx . ../new-app --include items`
- `npx . ../new-app --include items,upload`
- `npx . ../new-app --starter`
- `npx . ../new-app --exclude kv,upload`
- `npx . ../new-app --plan --json`
- `npx . ../new-app --plan --plan-out ./scaffold-plan.json`

`create-cf-starter` は現在の starter を別ディレクトリへコピーします。
何も付けなければ `core-only` で始まります。
`--include` / `--exclude` を付けると example feature を選択して残せます。
`--starter` は bundled example feature を全部入れる互換ショートカットです。
`--plan` を付けるとコピーせずに `profile`、`selectedFeatures`、`removedFeatures`、`coreBindingsKept`、`coreBindingReasons`、`bindingsRemoved`、`bindingRemovalReasons`、`filesRemoved`、`filesRewritten`、`warnings`、`requiredBindings`、`transforms`、`nextSteps` だけを確認できます。
JSON には互換のため `mode` も残りますが、新規利用では `profile` と `selectedFeatures` を使います。
`--plan-out` を付けると plan JSON をファイルへ保存します。
生成先の `wrangler.jsonc` は `requiredBindings` に合わせて不要な KV / R2 binding を落とします。
生成先の `README.md` は selected features に合わせて `ディレクトリ構成`、`Feature Structure`、`Queue`、`Optional Example APIs` を絞ります。

### Compatibility Note

`scripts/compat/` には旧 CLI wrapper が残っていますが、通常の導線には含めません。新規利用では `create-cf-starter` だけを使います。

## Feature Structure

`cf-starter` は feature-based structure を採用しています。

- core routes: `src/routes/`
- feature routes: `src/features/{key}/routes.ts`（Record Engine で生成）
- core hooks: `app/hooks/`
- feature hooks: `app/features/{key}/hooks/`（Record Engine で生成）
- core schema: `shared/schemas/`
- feature schema: `shared/features/{key}/schema.ts`（Record Engine で生成）
- record definitions: `shared/records/{key}.ts`
- optional examples: `examples/feature-packs/{key}/`

新しい業務機能を追加する場合は、Record Engine でレコード定義を書いてコード生成するのが最速です。
業務テーブルは `organization_id` を持たせて current organization で絞るのを基本にします（生成物に自動で含まれます）。

## Optional Example APIs

default app には含まれません。対応する example feature を選んだ時だけ使います。

| エンドポイント | 内容 |
|---|---|
| `GET /api/items` | current organization の item 一覧 |
| `POST /api/items` | current organization に item 作成 |
| `GET /api/upload` | current organization prefix の R2 ファイル一覧取得 |
| `POST /api/upload` | current organization prefix に R2 アップロード |
| `GET /api/kv/:key` | current organization scope の KV 読み取り |
| `PUT /api/kv/:key` | current organization scope の KV 書き込み |

## 開発の流れ

### Record Engine でレコードを追加する（推奨）

1. `shared/records/xxx.ts` にレコード定義を書く
2. `npm run record:generate -- --record shared/records/xxx.ts`
3. `npm run db:generate && npm run db:migrate`
4. `app/App.tsx` の `recordNavItems` にナビ追加、ルート追加
5. `npm run dev` で動作確認

### API を手動で追加する

1. `src/routes/` に route を追加
2. `src/index.ts` で `.route()` 登録
3. `app/lib/api.ts` 経由でフロントから呼ぶ

### テーブルを手動で追加する

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
