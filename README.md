# cf-starter

cf-starter は、**Cloudflare Workers 上で小規模〜中規模の業務アプリを最短で立ち上げるための starter** です。

認証、セッション、権限、DB、監査ログ、ログ、テスト、CLI、コード生成を最初から備えており、`cp` してすぐ開発を始められます。
地域向け業務ツール、会員制サービス、予約・台帳・在庫・配車・マッチング、公開ダッシュボードなど、**少人数で運用する Cloudflare ネイティブな Web アプリ** に向いています。

設計の詳細は [`ARCHITECTURE.md`](./ARCHITECTURE.md)、今後の進行は [`ROADMAP.md`](./ROADMAP.md)、CLI の運用設計は [`CLI_DESIGN.md`](./CLI_DESIGN.md) を参照してください。

---

## 特徴

### 実運用を見据えた基盤
- D1 session + HttpOnly Cookie 認証
- PBKDF2-SHA256 パスワードハッシュ
- CSRF 保護
- organization / membership / current organization context
- password reset request / confirm flow
- email verification request / confirm flow
- Durable Object ベースの auth rate limit
- request id
- 構造化 JSON ログ
- 統一 API エラー形式
- audit log

### Cloudflare ネイティブ構成
- Hono on Cloudflare Workers
- D1 + Drizzle ORM
- Cloudflare Queues integration
- KV / R2 optional
- Durable Objects によるレート制御

### 開発を加速する仕組み
- Zod による shared schema
- Hono RPC client による型付き API 呼び出し
- Vitest ベースの自動テスト
- **Record Engine**（レコード定義 → バックエンド / フロントエンドコード生成）
- ダッシュボード UI キット（チャート5種 + KPIカード + グラフ/テーブル切替）
- 2種のレイアウト（AppShell / PublicShell）
- wouter による SPA ルーティング

---

## 向いている用途

- 地域向け業務ツール
- 会員制サービス
- 予約、台帳、在庫、配車、マッチング
- ダッシュボード、データ可視化サイト
- 1人〜少人数で運用する業務アプリ
- Cloudflare Workers 上で素早く立ち上げたい社内・地域向けツール

## 向いていない用途

cf-starter は万能ではありません。次のような用途は別設計を推奨します。

- 超大規模マルチテナント SaaS
- 複雑な BPM / ワークフローエンジン
- 高度なファイル管理中心のシステム
- 強い要件を持つエンタープライズ権限制御
- メール配信、課金、全文検索などを最初からフル装備したプラットフォーム

必要な機能は追加できますが、**最初の狙いは「業務アプリを速く・安全に・量産できること」** です。

---

## 技術スタック

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
| Build | Vite + @cloudflare/vite-plugin |
| Testing | Vitest |

---

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
npm run init
npm run dev
```

`npm run init` は以下を自動で行います。

- `cf-starter` → アプリ名への参照置換
- D1 データベース作成
- `wrangler.jsonc` への `database_id` 書き込み
- `CORS_ORIGIN` / `APP_BASE_URL` の設定
- `.dev.vars` にローカル用オーバーライド生成
- テンプレ migration の整理
- `db:generate` → `db:migrate` → `seed:demo`

---

## Cloudflare へデプロイ

```bash
npm run setup:remote
npm run deploy
```

`npm run setup:remote` は以下を自動で行います。

- リモート D1 に migration 適用
- `seed:demo --remote` 実行（org id=1 作成）
- `seed-app.sql` があればリモート適用
- 必須シークレット（`SESSION_SECRET` 等）の設定確認

KV / R2 / Queue が必要な場合は別途作成してください。

```bash
wrangler kv namespace create KV
wrangler r2 bucket create my-app-bucket
wrangler queues create my-app-jobs
```

その後、`wrangler.jsonc` の binding ids を更新します。

---

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
| `npm run typecheck` | TypeScript 型チェック |
| `npm test` | 自動テスト |
| `npm run test:watch` | テスト watch |
| `npm run db:generate` | Drizzle から migration 生成 |
| `npm run db:migrate` | ローカル D1 に migration 適用 |
| `npm run db:migrate:remote` | リモート D1 に migration 適用 |
| `npm run seed:demo` | ローカル D1 に demo user / org を投入 |
| `npm run init` | 新プロジェクト初期化 |
| `npm run setup:remote` | リモート DB 準備 |
| `npm run record:generate -- --record shared/records/xxx.ts` | Record Engine でコード生成 |

---

## Plan / JSON モード

機械可読な確認だけしたいときは `--plan --json` を使います。
`npm link` または npm 公開後に導入すると `cf-starter ...` でも同じ CLI を叩けます。

テンプレ運用では **`cf-starter ...` または `npm run cli -- ...` を優先**し、`npm run <script>` は互換入口として扱うのが安全です。

```bash
cf-starter doctor --json
cf-starter doctor --remote --json
cf-starter env plan --json
cf-starter db migrate --plan --json
cf-starter db seed-demo --plan --json
cf-starter record generate --record shared/records/task.ts --plan --json
cf-starter deploy --plan --json
```

JSON に demo 認証情報も含めたいときだけ `--include-credentials` を付けます。

```bash
npm run seed:demo -- --plan --json --include-credentials
```

---

## Record Engine

Record Engine は、**レコード定義からバックエンドとフロントエンドのコードを一発生成する仕組み**です。
生成後はただのコードなので、自由に編集できます。

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

### 生成されるもの

| ファイル | 内容 |
|---------|------|
| `src/db/schema.ts` に追記 | Drizzle テーブル定義 |
| `shared/features/{key}/schema.ts` | Zod create / update スキーマ |
| `src/features/{key}/routes.ts` | CRUD + `GET /:id` + `PATCH /:id/status` |
| `app/features/{key}/hooks/use{Key}.ts` | TanStack Query hooks |
| `src/index.ts` に追記 | ルート登録 |

### フィールド型

| type | Drizzle | Zod | UI |
|------|---------|-----|----|
| `text` | `text()` | `z.string().max(N)` | `<input>` / `<textarea>` |
| `number` | `integer()` | `z.number().min().max()` | `<input type="number">` |
| `date` | `text()` (ISO) | `z.string().regex(...)` | `<input type="date">` |
| `select` | `text()` | `z.enum([...])` | `<select>` |
| `relation` | `integer()` | `z.number().int()` | `<select>` |
| `file` | `text()` (R2 key) | `z.string()` | placeholder（UI未実装） |

---

## ディレクトリ構成

```text
cf-starter/
├── app/                    React UI
│   ├── components/
│   │   ├── charts/         Recharts ラッパー（5種）
│   │   ├── fields/         フォーム用フィールドコンポーネント
│   │   ├── AppShell.tsx    認証あり用レイアウト
│   │   ├── PublicShell.tsx 公開アプリ用レイアウト
│   │   ├── KpiCard.tsx     数値カード
│   │   ├── Section.tsx     セクション見出し
│   │   ├── ChartTableToggle.tsx
│   │   └── DataTableSimple.tsx
│   ├── features/           feature hooks（生成物）
│   ├── hooks/              core hooks
│   ├── lib/
│   │   ├── api.ts          型付き Hono RPC client
│   │   └── format.ts       数値フォーマット
│   ├── pages/
│   │   └── records/        汎用レコード画面
│   └── App.tsx             wouter ルーティング
├── shared/                 フロント・バック共有契約
│   ├── features/           feature schemas（生成物）
│   ├── lib/record-def.ts   Record Engine 型定義
│   ├── records/            レコード定義
│   └── schemas/            core schema
├── src/                    Worker backend
│   ├── db/                 Drizzle schema
│   ├── durable-objects/    rate limiter
│   ├── features/           feature routes（生成物）
│   ├── lib/                auth, session, audit, organizations
│   ├── middleware/          auth, csrf, role, request-id
│   ├── queues/             queue producer / consumer
│   ├── routes/             core API routes
│   │   └── public-example.ts
│   └── index.ts            Worker entrypoint
├── scripts/
│   ├── init-copy.mjs
│   ├── setup-remote.mjs
│   ├── generate-record.mjs
│   ├── seed-demo.mjs
│   └── lib/
├── migrations/
├── test/
├── ARCHITECTURE.md
├── ROADMAP.md
└── README.md
```

---

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

---

## 開発の流れ

### 1. Record Engine でレコードを追加する（推奨）

1. `shared/records/xxx.ts` にレコード定義を書く
2. `npm run record:generate -- --record shared/records/xxx.ts`
3. `npm run db:generate && npm run db:migrate`
4. `app/App.tsx` の `recordNavItems` にナビ追加、ルート追加
5. `npm run dev` で動作確認

### 2. API を手動で追加する

1. `src/routes/` に route を追加
2. `src/index.ts` で `.route()` 登録
3. `app/lib/api.ts` 経由でフロントから呼ぶ

### 3. テーブルを手動で追加する

1. `src/db/schema.ts` にテーブル定義を追加
2. `npm run db:generate`
3. `npm run db:migrate`

---

## ダッシュボード UI キット

Recharts ベースのチャートと汎用 UI 部品が組み込み済みです。
認証不要の公開アプリ（ダッシュボード等）もすぐ作れます。

### チャート（`app/components/charts/`）

| コンポーネント | 用途 |
|---|---|
| `HorizontalBar` | 横棒ランキング |
| `ChangeBar` | 増減棒 |
| `TrendLine` | 折れ線（複数系列） |
| `StackedBar` | 積み上げ棒 |
| `PieDonut` | 円 / ドーナツ |

### ダッシュボード部品

| コンポーネント | 用途 |
|---|---|
| `KpiCard` | 数値カード |
| `Section` | セクション見出し |
| `ChartTableToggle` | グラフ / テーブル切替 |
| `DataTableSimple` | 読み取り専用テーブル |

---

## レイアウト

### AppShell

認証あり業務アプリ向けレイアウトです。

### PublicShell

公開アプリ向けのモバイルファースト 1 カラムレイアウトです。
`AUTH_ENABLED=false` のとき自動で選択されます。

```tsx
// app/App.tsx で自動切替
// AUTH_ENABLED=false → PublicShell
// AUTH_ENABLED=true  → AppShell
```

`title`, `navItems`, `headerExtra` などを props で渡してカスタマイズできます。

---

## 公開 API パターン

`src/routes/public-example.ts` に GET-only の公開 API サンプルがあります。

```typescript
// src/index.ts
.route("/api/public/example", publicExample)
```

CSRF は GET をスキップするため、GET-only ルートは middleware の変更不要です。

---

## アプリ固有シードデータ

プロジェクトルートに `seed-app.sql` を置くと、`npm run setup:remote` で自動実行されます。
ローカルでも手動適用できます。

```bash
npx wrangler d1 execute <db-name> --local --file seed-app.sql
```

---

## 本番チェックリスト

`npm run init` + `npm run setup:remote` で大部分は自動化されます。
残りは以下を確認してください。

- [ ] KV / R2 / Queue binding が必要なら作成し、`wrangler.jsonc` に id を設定
- [ ] `COOKIE_SAME_SITE` / `COOKIE_SECURE` を運用に合わせる
- [ ] Durable Object migration tag を必要に応じて更新
- [ ] Queue 名を変更した場合は producer / consumer を揃える
- [ ] auth rate limit の閾値を要件に合わせる
- [ ] scheduled cleanup が本番でも動くことを確認
- [ ] `npm run doctor -- --remote` でデプロイ前チェック

---

## 設計方針

cf-starter は、次の考え方で設計しています。

- **Cloudflare ネイティブ**
- **少人数開発 / 少人数運用**
- **型共有を前提にした安全な変更**
- **業務アプリを量産できること**
- **コード生成しても、最後は普通のコードとして触れること**
- **最初から最低限の認証・監査・運用機能を持つこと**

---

## 今後

今後の拡張予定や進行中の整理は [`ROADMAP.md`](./ROADMAP.md) を参照してください。
