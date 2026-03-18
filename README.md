# cf-starter

Cloudflare Workers 上で、小規模から中規模の業務アプリを安定して立ち上げるための starter です。

`cp` してすぐ開発を始められます。認証、セッション、権限、DB、ログ、テストがそろった状態からスタートできます。

設計の詳細は [ARCHITECTURE.md](./ARCHITECTURE.md)、今後の進行は [ROADMAP.md](./ROADMAP.md) を参照してください。
CLI の運用設計は [CLI_DESIGN.md](./CLI_DESIGN.md) にまとめています。

## 何が入っているか

- React + TypeScript + Tailwind CSS v4 + Recharts
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
- ダッシュボード UI キット（チャート5種 + KPIカード + グラフ/テーブル切替）
- 2種のレイアウト（AppShell: 認証あり / PublicShell: 公開アプリ）
- wouter による SPA ルーティング

## 向いている用途

- 地域向け業務ツール
- 会員制サービス
- 予約、台帳、在庫、配車、マッチング
- ダッシュボード、データ可視化サイト
- 1人から少人数で運用する Cloudflare ネイティブな Web アプリ

## スタック

| レイヤー | 技術 |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS + TanStack Query + Recharts + wouter |
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
npm run init       # 対話で名前入力 → D1作成・URL設定・DB構築まで全自動
npm run dev
```

`npm run init` が自動で行うこと:

1. `cf-starter` → アプリ名への参照置換
2. D1 データベース作成 → `database_id` を `wrangler.jsonc` に書き込み
3. `CORS_ORIGIN` / `APP_BASE_URL` を本番 URL に設定（`.dev.vars` にローカル用オーバーライドも生成）
4. テンプレのマイグレーション削除 → `db:generate` → `db:migrate` → `seed:demo`

### Cloudflare へデプロイ

```bash
npm run setup:remote   # リモートmigrate + seed + secrets確認
npm run deploy
```

`setup:remote` が自動で行うこと:

1. リモート D1 にマイグレーション適用
2. `seed:demo --remote`（org id=1 作成）
3. `seed-app.sql` があればリモートに適用（アプリ固有シード）
4. 必須シークレット（`SESSION_SECRET` 等）の設定確認

KV / R2 / Queue が必要な場合は別途手動で作成:

```bash
wrangler kv namespace create KV
wrangler r2 bucket create my-app-bucket
wrangler queues create my-app-jobs
# wrangler.jsonc の binding ids を更新
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
| `npm run init` | 新プロジェクト初期化（D1作成・URL設定・DB構築） |
| `npm run setup:remote` | リモートDB準備（migrate + seed + secrets確認） |
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
│   ├── components/
│   │   ├── charts/         Recharts ラッパー（5種）
│   │   ├── fields/         フォーム用フィールドコンポーネント
│   │   ├── AppShell.tsx    認証あり用レイアウト
│   │   ├── PublicShell.tsx 公開アプリ用レイアウト（モバイルファースト）
│   │   ├── KpiCard.tsx     数値カード
│   │   ├── Section.tsx     セクション見出し
│   │   ├── ChartTableToggle.tsx  グラフ/テーブル切替
│   │   └── DataTableSimple.tsx   読み取り専用テーブル
│   ├── features/           feature hooks（Record Engine 生成物）
│   ├── hooks/              core hooks
│   ├── lib/
│   │   ├── api.ts          型付き Hono RPC client
│   │   └── format.ts       数値フォーマット置き場
│   ├── pages/              ページコンポーネント
│   │   └── records/        汎用レコード画面（List / Detail / Form）
│   └── App.tsx             wouter ルーティング（AUTH_ENABLEDでレイアウト自動切替）
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
│   │   └── public-example.ts  GET-only 公開 API サンプル
│   └── index.ts            Worker entrypoint
├── scripts/
│   ├── init-copy.mjs       プロジェクト初期化（D1作成・URL設定・DB構築）
│   ├── setup-remote.mjs    リモートDB一括準備
│   ├── generate-record.mjs Record Engine コードジェネレーター
│   ├── seed-demo.mjs       デモデータ投入
│   └── lib/                CLI共通ロジック・record-engine
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

## ダッシュボード UI キット

Recharts ベースのチャートと汎用 UI 部品が組み込み済み。認証不要の公開アプリ（ダッシュボード等）をすぐ作れます。

### チャート（`app/components/charts/`）

| コンポーネント | 用途 |
|---|---|
| `HorizontalBar` | 横棒ランキング |
| `ChangeBar` | 増減棒（正＝緑、負＝赤） |
| `TrendLine` | 折れ線（複数系列） |
| `StackedBar` | 積み上げ棒（縦/横） |
| `PieDonut` | 円/ドーナツ |

### ダッシュボード部品

| コンポーネント | 用途 |
|---|---|
| `KpiCard` | 数値カード（ラベル + 値 + サブテキスト） |
| `Section` | セクション見出し |
| `ChartTableToggle` | グラフ/テーブル切替タブ |
| `DataTableSimple` | 読み取り専用テーブル |

### PublicShell（公開アプリ用レイアウト）

`AUTH_ENABLED=false` 時に自動選択される、モバイルファーストの1カラムレイアウト。

```tsx
// app/App.tsx で自動切替
// AUTH_ENABLED=false → PublicShell
// AUTH_ENABLED=true  → AppShell
```

カスタマイズ: `title`, `navItems`, `headerExtra`（年度セレクタ等）を props で渡す。

### 公開 API パターン

`src/routes/public-example.ts` に GET-only の公開 API サンプルがあります:

```typescript
// src/index.ts
.route("/api/public/example", publicExample)
```

CSRF は GET をスキップするため、GET-only ルートは middleware 変更不要。

## アプリ固有シードデータ

`seed-app.sql` をプロジェクトルートに置くと、`npm run setup:remote` で自動実行されます。
ローカルでも手動適用できます:

```bash
npx wrangler d1 execute <db-name> --local --file seed-app.sql
```

## 本番チェックリスト

`npm run init` + `npm run setup:remote` で大部分は自動化されます。残りの確認事項:

- [ ] KV / R2 / Queue binding が必要なら作成して `wrangler.jsonc` に id を設定
- [ ] `COOKIE_SAME_SITE` / `COOKIE_SECURE` を運用に合わせる
- [ ] Durable Object migration tag を必要に応じて更新する
- [ ] Queue 名を変更した場合は producer / consumer を揃える
- [ ] auth rate limit の閾値を要件に合わせる
- [ ] `scheduled` cleanup が本番でも動くことを確認する
- [ ] `npm run doctor -- --remote` でデプロイ前チェック
