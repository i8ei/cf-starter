# cf-starter

Cloudflare Workers 上で、小規模から中規模の業務アプリを安定して立ち上げるための starter です。

`cp` してすぐ開発を始められます。認証、セッション、権限、DB、ログ、テストがそろった状態からスタートできます。

設計の詳細は [ARCHITECTURE.md](./ARCHITECTURE.md)、今後の進行は [ROADMAP.md](./ROADMAP.md) を参照してください。
CLI の運用設計は [CLI_DESIGN.md](./CLI_DESIGN.md) にまとめています。

## 何が入っているか

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
cp -r cf-starter my-app
cd my-app
npm install
npm run db:migrate
npm run dev
```

### Cloudflare へデプロイ

`cf-starter` 自体はテンプレートなので、repo 本体の `wrangler.jsonc` には `database_id` や `APP_BASE_URL` の実値を固定しません。
実アプリとして使うコピー先で、環境ごとの値を入れます。

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
| `npm run cli -- <...>` | unified CLI の生入口 |
| `npm run doctor` | ローカル CLI / Wrangler 設定の診断 |
| `npm run env:plan` | `wrangler.jsonc` から Cloudflare 資源計画を出す |
| `npm test` | 自動テスト |
| `npm run test:watch` | テスト watch |
| `npm run db:generate` | Drizzle から migration 生成 |
| `npm run db:migrate` | ローカル D1 に migration 適用 |
| `npm run db:migrate:remote` | リモート D1 に migration 適用 |
| `npm run seed:demo` | ローカル D1 に demo user / org を投入 |
| `npm run record:generate -- --record shared/records/xxx.ts` | Record Engine でコード生成 |

### Plan / JSON モード

機械可読な確認だけしたいときは `--plan --json` を使います。
package を `npm link` または npm 公開後に入れると `cf-starter ...` でも同じ CLI を叩けます。
テンプレ運用では `cf-starter ...` または `npm run cli -- ...` を優先し、`npm run <script>` は互換入口として扱うのが安全です。

```bash
cf-starter doctor --json
cf-starter doctor --remote --json
cf-starter env plan --json
cf-starter db migrate --plan --json
cf-starter db seed-demo --plan --json
cf-starter record generate --record shared/records/task.ts --plan --json
cf-starter deploy --plan --json

npm run cli -- doctor --json
npm run cli -- doctor --remote --json
npm run cli -- env plan --json
npm run cli -- db migrate --plan --json
npm run cli -- db seed-demo --plan --json
npm run cli -- record generate --record shared/records/task.ts --plan --json
npm run cli -- deploy --plan --json

npm run doctor -- --json
npm run doctor -- --remote --json
npm run env:plan -- --json
npm run db:migrate -- --plan --json
npm run seed:demo -- --plan --json
npm run record:generate -- --record shared/records/task.ts --plan --json
npm run deploy -- --plan --json
```

JSON に demo 認証情報も含めたいときだけ `--include-credentials` を付けます。

```bash
npm run seed:demo -- --plan --json --include-credentials
```

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

## ディレクトリ構成

```text
cf-starter/
├── app/                    React UI
│   ├── components/         共通 UI コンポーネント
│   │   └── fields/         フォーム用フィールドコンポーネント
│   ├── features/           feature hooks（Record Engine 生成物）
│   ├── hooks/              core hooks
│   ├── lib/api.ts          型付き Hono RPC client
│   ├── pages/              ページコンポーネント
│   │   └── records/        汎用レコード画面（List / Detail / Form）
│   └── App.tsx             wouter ルーティング
├── shared/                 フロント・バック共有契約
│   ├── features/           feature schemas（Record Engine 生成物）
│   ├── lib/record-def.ts   Record Engine 型定義
│   ├── records/            レコード定義ファイル
│   └── schemas/            core schema
├── src/                    Worker backend
│   ├── db/                 Drizzle schema
│   ├── durable-objects/    rate limiter
│   ├── features/           feature routes（Record Engine 生成物）
│   ├── lib/                auth, session, audit, organizations など
│   ├── middleware/          auth, csrf, role, request-id
│   ├── queues/             queue producer / consumer
│   ├── routes/             core API routes
│   └── index.ts            Worker entrypoint
├── scripts/
│   ├── generate-record.mjs Record Engine コードジェネレーター
│   ├── seed-demo.mjs       デモデータ投入
│   └── lib/                record-engine 生成ロジック
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

## 本番チェックリスト

- [ ] `wrangler.jsonc` の `database_id` / KV / R2 / Queue binding を実値にする
- [ ] `CORS_ORIGIN` を本番 origin にする
- [ ] `COOKIE_SAME_SITE` / `COOKIE_SECURE` を運用に合わせる
- [ ] Durable Object migration tag を必要に応じて更新する
- [ ] Queue 名を変更した場合は producer / consumer を揃える
- [ ] auth rate limit の閾値を要件に合わせる
- [ ] `scheduled` cleanup が本番でも動くことを確認する
