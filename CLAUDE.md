# cf-starter

Cloudflare フルスタック スターターテンプレート。`cp` して使うことを前提に設計。

設計判断の基準は [CONSTITUTION.md](./CONSTITUTION.md) を参照。

## スタック

- **Frontend**: React + TypeScript + Tailwind CSS v4 + TanStack Query + Recharts
- **Backend**: Hono on Cloudflare Workers
- **DB**: D1 + Drizzle ORM（型安全、マイグレーション自動生成）
- **Storage**: R2（オブジェクト）/ KV（キーバリュー、オプション）
- **Validation**: Zod + @hono/zod-validator（フロント・バック共有）
- **統合**: @cloudflare/vite-plugin（1プロジェクト統合ビルド）

## ディレクトリ構成

```
cf-starter/
├── app/                    ← React フロントエンド
│   ├── components/         ← 共通 UI コンポーネント
│   │   ├── charts/         ← Recharts ラッパー（HorizontalBar, ChangeBar, TrendLine, StackedBar, PieDonut, colors.ts）
│   │   ├── fields/         ← フォーム用フィールドコンポーネント
│   │   ├── AppShell.tsx    ← ナビゲーション付きレイアウト（認証あり用）
│   │   ├── PublicShell.tsx ← モバイルファースト1カラムレイアウト（公開アプリ用）
│   │   ├── KpiCard.tsx     ← 数値カード（ダッシュボード用）
│   │   ├── Section.tsx     ← セクション見出し
│   │   ├── ChartTableToggle.tsx ← グラフ/テーブル切替
│   │   ├── DataTableSimple.tsx ← 読み取り専用シンプルテーブル
│   │   ├── Panel.tsx       ← カードUI
│   │   ├── DataTable.tsx   ← ソート付きテーブル表示
│   │   ├── StatusBadge.tsx ← ステータスバッジ
│   │   ├── StatusFilterTabs.tsx ← ステータスフィルタータブ
│   │   └── SummaryCards.tsx ← ステータス別件数カード（RecordListPage 上部）
│   ├── features/           ← feature hooks（Record Engine 生成物）
│   ├── hooks/              ← core hooks
│   ├── lib/
│   │   ├── api.ts          ← Hono RPC クライアント（型付き）
│   │   ├── errors.ts       ← APIエラーパース
│   │   └── format.ts       ← 数値フォーマットユーティリティ（fmtNumber, fmtCurrency, fmtDiff, fmtPercent）
│   ├── pages/              ← ページコンポーネント
│   │   ├── records/        ← 汎用レコード画面（List/Detail/Form）
│   │   ├── AuthPage.tsx
│   │   ├── HomePage.tsx    ← トップページ
│   │   └── SettingsPage.tsx
│   ├── App.tsx             ← wouter ルーティング
│   ├── main.tsx
│   └── index.css
├── shared/                 ← フロント・バック共有
│   ├── features/           ← feature schemas（Record Engine 生成物）
│   ├── lib/record-def.ts   ← Record Engine 型定義（defineRecord）
│   ├── records/            ← レコード定義ファイル置き場
│   └── schemas/            ← core Zod スキーマ
├── src/                    ← Hono バックエンド (Worker)
│   ├── db/schema.ts        ← Drizzle スキーマ
│   ├── durable-objects/    ← rate limiter
│   ├── features/           ← feature routes（Record Engine 生成物）
│   ├── lib/                ← better-auth, session, audit, crypto 等
│   ├── middleware/          ← auth, csrf, rate-limit, request-id, role
│   ├── queues/             ← queue producer / consumer
│   ├── routes/             ← core API ルート
│   ├── types.ts            ← Env バインディング型
│   └── index.ts            ← エントリーポイント（ルート集約 + エラーハンドラ）
├── scripts/
│   ├── generate-record.mjs ← Record Engine コードジェネレーター
│   ├── seed-demo.mjs       ← デモデータ投入
│   ├── d1-migrate.mjs      ← D1 マイグレーション
│   └── lib/record-engine.mjs ← 生成ロジック（純粋関数、テスト付き）
├── test/                   ← Vitest テスト
├── migrations/             ← D1 マイグレーション
└── ...
```

## フロントエンド アーキテクチャ

### 起動フロー

```
QueryClientProvider
  └─ ErrorBoundary
       └─ AppRoutes (wouter Switch)
            ├─ /p/* ── 認証不要ページ（AuthGuard の外）
            └─ /* ── AuthGuard
                      ├─ useHealth() で authMode 取得
                      ├─ authMode=none     → PublicShell（useSession 呼ばない）
                      └─ authMode=other    → AuthShell
                                              ├─ useSession() でログイン確認
                                              ├─ 未ログイン → AuthPage
                                              └─ ログイン済 → AppShell + children
```

### Shell 選択

| authMode | Shell | ナビ定義 |
|----------|-------|---------|
| `none` | `PublicShell` | `publicNavItems` |
| `simple-admin` | `AppShell` | `recordNavItems` |
| `better-auth` | `AppShell` | `recordNavItems` |

### Hook 依存ツリー

```
useHealth()         ← /api/health（authMode 判定、常に呼ばれる）
useSession()        ← /api/auth/me（authMode≠none のときだけ）
  useSignup()       ← Better Auth sign-up
  useLogin()        ← Better Auth sign-in
  useAdminLogin()   ← simple-admin パスワード認証
  useLogout()       ← セッション破棄
```

### API クライアント契約

```ts
// app/lib/api.ts
import { hc } from "hono/client";
import type { AppType } from "@server/index";

export const client = hc<AppType>("/", {
  fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
});
```

- `hc<AppType>` で型安全 RPC。バックエンドのルート定義が変われば型エラーで検知
- `credentials: "include"` で Cookie を自動送信（認証に必要）
- TanStack Query の `queryFn` 内で `client.api.xxx.$get()` / `$post()` を呼ぶ

### ルート規約

| パス | 用途 | AuthGuard |
|------|------|-----------|
| `/p/*` | 公開ページ（認証不要） | 外 |
| `/:record` | Record Engine 一覧 | 内 |
| `/:record/new` | Record Engine 新規作成 | 内 |
| `/:record/:id` | Record Engine 詳細 | 内 |
| `/settings` | 組織設定 | 内 |
| `/` | ホーム | 内 |

## コマンド

```bash
npm run dev              # ローカル開発（統合モード: Vite + workerd）
npm run dev:split        # ローカル開発（分離モード: Vite + wrangler 別起動）
npm run build            # ビルド
npm run preview          # ビルド後プレビュー
npm run deploy           # Cloudflare にデプロイ
npm run cli -- <...>     # unified CLI の生入口
npm run doctor           # ローカル CLI / Wrangler 設定の診断
npm run env:plan         # wrangler.jsonc から Cloudflare 資源計画を出す
npm run lint             # OxLint（React + TypeScript ルール）
npm run unused           # knip（未使用コード・依存検出、テンプレAPI警告は warn のみ）
npm test                 # Vitest テスト
npm run test:e2e         # Playwright E2E（要: npx playwright install chromium）
npm run db:generate      # Drizzle スキーマからマイグレーション生成
npm run db:migrate       # D1 ローカルマイグレーション
npm run db:migrate:remote  # D1 リモートマイグレーション
npm run seed:demo        # デモユーザー・組織を投入
npm run record:generate -- --record shared/records/xxx.ts  # Record Engine でコード生成
npm run setup:remote     # リモートDB準備（migrate + seed + secrets確認）
npm run ci:local          # ローカル品質チェック（lint + typecheck + test + unused + build を一括実行）

# Plan / JSON examples
cf-starter doctor --json
cf-starter doctor --remote --json
cf-starter env plan --json
cf-starter db migrate --plan --json
cf-starter db seed-demo --plan --json
cf-starter record generate --record shared/records/xxx.ts --plan --json
cf-starter deploy --plan --json
npm run cli -- doctor --json
npm run cli -- doctor --remote --json
npm run cli -- env plan --json
npm run cli -- db migrate --plan --json
npm run cli -- db seed-demo --plan --json
npm run cli -- record generate --record shared/records/xxx.ts --plan --json
npm run cli -- deploy --plan --json
npm run doctor -- --json
npm run doctor -- --remote --json
npm run env:plan -- --json
npm run db:migrate -- --plan --json
npm run seed:demo -- --plan --json
npm run record:generate -- --record shared/records/xxx.ts --plan --json
npm run deploy -- --plan --json
```

## 運用ランブック

### request-id 伝搬

```
クライアント → X-Request-Id ヘッダー（任意）
  → requestId middleware（なければ crypto.randomUUID() 生成）
    → c.set("requestId", id)  ← Hono Context に保存
    → レスポンスヘッダー X-Request-Id に付与
    → logRequestEvent() が自動で requestId を含める
```

- `src/middleware/request-id.ts` が全リクエストに適用
- フォーマット: `^[A-Za-z0-9._-]{8,128}$`（外部からの ID も受け入れ可能）

### /api/health レスポンス契約

```json
{
  "status": "ok" | "degraded",
  "checks": {
    "env": "ok" | "missing",
    "d1": "ok" | "error",
    "kv": "ok" | "error",        // KV バインディングがある場合のみ
    "r2": "ok" | "error",        // R2 バインディングがある場合のみ
    "rateLimiter": "ok" | "error", // DO バインディングがある場合のみ
    "config": "ok" | "invalid" | "error",
    "adminPassword": "missing",  // simple-admin で ADMIN_PASSWORD 未設定時のみ
    "betterAuthSecret": "missing" // better-auth で SECRET 未設定時のみ
  },
  "authEnabled": true | false,
  "authMode": "none" | "simple-admin" | "better-auth"
}
```

- `status: "ok"` = 全 checks が "ok"
- フロントは `authMode` を見て Shell を選択（AuthGuard）

### 構造化ログ

```ts
// 汎用（リクエスト外でも使える）
logEvent("info", "cron.started", { jobName: "cleanup" });

// リクエストコンテキスト付き（method, path, ip, requestId を自動付与）
logRequestEvent("error", "auth.failed", c, { reason: "invalid_password" });
```

- `src/lib/logging.ts` に定義
- 出力: JSON 1行（Cloudflare Dashboard Logs でパース可能）
- フィールド: `ts`, `level`, `event`, + カスタムフィールド

### doctor の使い方

```bash
npm run doctor                    # ローカル環境チェック
npm run doctor -- --remote        # リモートデプロイ前チェック
npm run doctor -- --json          # JSON 出力（CI / スクリプト向け）
npm run doctor -- --remote --json # リモート + JSON
```

- checks: Node.js バージョン、npm scripts、必須ファイル、Wrangler 設定、D1 設定
- `--remote`: APP_BASE_URL HTTPS チェック、CORS_ORIGIN チェック、Wrangler 認証確認

### 本番で最低限見るもの

| 何を | どこで |
|------|--------|
| ヘルスチェック | `curl https://<app>.workers.dev/api/health` |
| リアルタイムログ | Cloudflare Dashboard → Workers → Logs → Begin log stream |
| D1 データ確認 | Cloudflare Dashboard → D1 → Console |
| エラー調査 | ログの `requestId` でフィルタ |

## 開発の流れ

### 新プロジェクト開始（理想の1コマンド）
```bash
cp -r cf-starter my-app && cd my-app && npm install && npm run init
```
`npm run init` が自動で:
1. 名前置換（cf-starter → my-app）
2. D1作成 → database_id書き込み
3. CORS_ORIGIN / APP_BASE_URL をprod URL設定
4. migrations クリア → db:generate → db:migrate → seed:demo

### デプロイ準備
```bash
npm run setup:remote   # リモートmigrate + seed + seed-app.sql + secrets確認
npm run deploy
```

### アプリ固有シードデータ
`seed-app.sql` をプロジェクトルートに置くと、`npm run setup:remote` で自動実行される。
ローカルでも `npx wrangler d1 execute <db-name> --local --file seed-app.sql` で適用可能。

### 日常開発
1. テンプレ repo 本体では `wrangler.jsonc` の `database_id` / `APP_BASE_URL` はプレースホルダのまま維持する
2. API追加: `src/routes/` にファイル追加 → `src/index.ts` で `.route()` 登録
3. テーブル追加: `src/db/schema.ts` に定義 → `npm run db:generate`

## Record Engine（レコード駆動開発）

レコード定義を書いてジェネレーターを実行すると、バックエンド（Drizzle + Zod + Hono）とフロントエンド（TanStack Query hooks）のコードが一発生成される。生成後は自由に編集可能。

### レコード追加の手順

1. `shared/records/xxx.ts` にレコード定義を書く（`defineRecord()`）
2. `npm run record:generate -- --record shared/records/xxx.ts`
3. `npm run db:generate && npm run db:migrate`
4. `app/App.tsx` の `recordNavItems` にナビ追加、ルート追加
5. `npm run dev` で動作確認

### 生成物（1レコードあたり）

| ファイル | 内容 |
|---------|------|
| `src/db/schema.ts` に追記 | Drizzle テーブル定義 |
| `shared/features/{key}/schema.ts` | Zod create/update スキーマ |
| `src/features/{key}/routes.ts` | CRUD + PATCH status ルート |
| `app/features/{key}/hooks/use{Key}.ts` | TanStack Query hooks |
| `src/index.ts` に追記 | ルート登録 |

### UI コンポーネント

汎用レコード画面（`app/pages/records/`）を使って一覧・詳細・フォームを組める:
- `RecordListPage` — SummaryCards + status tabs 付き一覧、クライアントサイドソート、空状態アクション誘導
- `RecordDetailPage` — 詳細表示 + status 変更 + 削除確認ダイアログ
- `RecordFormPage` — フォーム（sections ベース）、必須マーカー `*`、送信スピナー

フィールドコンポーネント（`app/components/fields/`）: TextField, NumberField, DateField, SelectField, RelationField
- 全フィールド: `label`/`input` の `htmlFor`/`id` 紐付け、`focus-visible` リング、`aria-required`、エラー `role="alert"`

デザインシステム（melta UI inspired セマンティックトークン）:
- フォント: Inter + Noto Sans JP（`tabular-nums` 対応）
- StatusBadge: セマンティックカラー（ステータスの意味に基づく色割り当て）
- border-radius: input `rounded-lg`、button/panel `rounded-xl`
- **セマンティックカラー**（`:root` CSS変数 → `@theme` で Tailwind 登録）:
  - 背景: `bg-surface`（白）、`bg-surface-alt`（薄灰）、`bg-surface-hover`（ホバー）
  - テキスト: `text-heading`（見出し）、`text-body`（本文）、`text-muted`（補助）
  - ボーダー: `border-border`（標準）、`border-border-strong`（強調）
  - 入力: `bg-input-bg`、`border-input-border`
  - フォーカス: `ring-ring`（アクセント色のリング）
- **色のカスタマイズ**: `index.css` の `:root` 変数を上書きするだけでテーマ変更可能
- 生の Tailwind カラー（`text-gray-900` 等）ではなくセマンティックトークンを使うこと

### ルーティング

wouter による SPA ルーティング:
- 未ログイン時 → AuthPage をインライン表示（専用 `/login` ルートはない）
- `/` → HomePage（スターター案内 + 現在のユーザー/組織表示）
- `/invite?id=<invitationId>` → 招待受諾（AuthGuard内。セッション必須のため未ログインならログイン画面が先に出る）
- `/:record` → 一覧（Record Engine で生成・配線後に有効）
- `/:record/new` → 新規作成（同上）
- `/:record/:id` → 詳細（同上）
- `/:record/:id/edit` → 編集（同上）
- `/settings` → 組織設定

## パブリックページ（認証不要）

`/p/*` プレフィックスで認証不要のページを配置できる。

- **フロント**: `app/App.tsx` の `Switch` 先頭（AuthGuard の外）に `<Route path="/p/xxx">` を追加
- **バック**: `src/index.ts` に `requireAuth` なしのルートを `.route("/api/public/xxx", publicRoutes)` で登録
- CSRF は GET のみなので問題なし
- サンプル: `src/routes/public-example.ts`（GET-only APIルートの雛形。不要なら削除）

### AUTH_MODE（認証モード）

`AUTH_MODE` 環境変数で認証方式を切り替える。

| モード | 用途 | 認証方式 | DB認証テーブル |
|--------|------|----------|---------------|
| `none` | 公開アプリ | なし（mockユーザー） | 不要（存在はする） |
| `simple-admin` | 管理画面 | ADMIN_PASSWORD | 不要（存在はする） |
| `better-auth` | フルユーザー管理 | DB session | 必要 |

- **後方互換**: `AUTH_ENABLED=false` は `AUTH_MODE=none` と同等
- `AUTH_MODE` 未設定時のデフォルトは `better-auth`

#### none モード
```jsonc
// wrangler.jsonc
"AUTH_MODE": "none"
```
- `PublicShell`（モバイルファースト1カラム）を自動選択
- `app/App.tsx` の `publicNavItems` にナビを定義
- APIは `/api/public/*` に GET-only ルートを追加

#### simple-admin モード
```jsonc
// wrangler.jsonc
"AUTH_MODE": "simple-admin"
// .dev.vars（ローカル） or wrangler secret（本番）
ADMIN_PASSWORD=changeme
```
- パスワード1つで管理画面にログイン（ユーザー登録なし）
- HMAC署名Cookie（DBセッション不要）
- `/api/auth/admin-login` でログイン、`/api/auth/me` `/api/auth/logout` は共通
- signup / password-reset / email-verification は 404
- userId="1", orgId="default-org" 固定（`seed:demo` が必要）

#### better-auth モード（デフォルト）
```jsonc
// .dev.vars（ローカル） or wrangler secret（本番）
BETTER_AUTH_SECRET=change-me-to-a-random-string
```
- [Better Auth](https://better-auth.com/) によるフルユーザー認証
- エンドポイント: `/api/auth/sign-up/email`, `/api/auth/sign-in/email`, `/api/auth/sign-out` 等（Better Auth 内蔵）
- カスタムエンドポイント: `/api/auth/me`（ユーザー+組織情報）, `/api/auth/logout`
- 組織操作: `/api/auth/organization/*`（Better Auth org プラグインが全ハンドル）
- DBセッション + Cookie（`ba.session_token`）
- admin() プラグインで `user.role` カラムによるロール管理
- パスワードリセット・メール検証は Better Auth が内蔵処理
- **重要**: per-request auth instance（`createAuth(env)`）。シングルトン厳禁（D1 stale reference で30秒+ハング）

## ダッシュボード UI キット（Recharts + 汎用コンポーネント）

Recharts ベースのチャートラッパーとダッシュボード用UI部品が組み込み済み。

### チャートカラーパレット

`index.css` の `--chart-1`〜`--chart-10` CSS変数でチャート色を一元管理。`getChartColors()` (`app/components/charts/colors.ts`) が解決済みhex値を返す。

- `HorizontalBar` / `PieDonut`: デフォルトで `getChartColors()` を使用（`colors` propで上書き可）
- `TrendLine` / `StackedBar`: `lines[]` / `bars[]` の `color` で明示指定。`var(--chart-1)` 等は使えない（Recharts制約）ので、hex値を直接指定する
- `ChangeBar`: 正負色は `--success` / `--danger` と同値のデフォルト（`positiveColor` / `negativeColor` で上書き可）

プロジェクト固有の色に変更するには、`index.css` の `:root` で `--chart-1` 等を上書きするだけでよい。

### 数値フォーマッター（`app/lib/format.ts`）

ロケールは `ja-JP` 固定（対象ユーザーが日本の自治体のため）。変更する場合は `format.ts` 冒頭のロケール指定を書き換える。

| 関数 | 出力例 | 用途 |
|---|---|---|
| `fmtNumber(n)` | `1,234` | 汎用（チャートのデフォルト `valueFormatter`） |
| `fmtCurrency(yen)` | `¥1,234` | 金額表示 |
| `fmtDiff(val)` | `+1,234` / `-567` | 増減表示（ChangeBarのデフォルト） |
| `fmtPercent(ratio)` | `12.3%` | 割合表示 |

チャートの `valueFormatter` prop に渡して使う。プロジェクト固有のフォーマッターもこのファイルに追加する。

### チャートコンポーネント（`app/components/charts/`）

| コンポーネント | 用途 | 主なprops |
|---|---|---|
| `HorizontalBar` | 横棒ランキング | `data`, `colors`, `valueFormatter`, `tooltipLabel`, `categoryWidth` |
| `ChangeBar` | 増減棒（±色分け） | `data`, `positiveColor`, `negativeColor`, `tooltipLabel`, `categoryWidth` |
| `TrendLine` | 折れ線グラフ（複数系列） | `data`, `lines`, `xKey`, `margin` |
| `StackedBar` | 積み上げ棒（縦/横） | `data`, `bars`, `layout`, `margin` |
| `PieDonut` | 円/ドーナツグラフ | `data`, `innerRadius`（>0でドーナツ）, `tooltipLabel` |

すべて `ResponsiveContainer` でラップ済み、モバイル対応。`valueFormatter` で数値表示をカスタマイズ可能（デフォルトは `fmtNumber`、ChangeBar は `fmtDiff`）。

- `tooltipLabel`: ツールチップに表示するラベル名（デフォルト: `"値"` / ChangeBarは `"増減"`）
- `categoryWidth`: 横棒チャートのカテゴリ軸幅（デフォルト: 120px。長いラベルがある場合に調整）
- `margin`: チャート余白（TrendLine / StackedBar のみ）

### ダッシュボード用コンポーネント

| コンポーネント | 用途 |
|---|---|
| `KpiCard` | 数値カード（ラベル + 値 + サブテキスト）。`variant` で色指定: `"success"` / `"danger"` / `"warning"` / `"primary"` |
| `Section` | セクション見出し（h2 + children） |
| `ChartTableToggle` | グラフ/テーブル切替タブ |
| `DataTableSimple` | 読み取り専用の軽量テーブル（DataTableのソート不要版） |

### レイアウト選択

| レイアウト | 用途 | 選択基準 |
|---|---|---|
| `AppShell` | 認証あり・デスクトップ中心 | Record Engine アプリ、管理画面 |
| `PublicShell` | 認証なし・モバイルファースト | ダッシュボード、公開サイト |

`AUTH_MODE=none` の場合、`AuthGuard` が自動で `PublicShell` を選択する。

## DB スキーマ

Better Auth テーブル（単数形、text ID）:
- `user` — ユーザー（id, email, name, role, emailVerified, ...）
- `session` — セッション（token, expiresAt, userId, activeOrganizationId, ...）
- `account` — 認証アカウント（providerId, password, ...）
- `verification` — 検証トークン
- `organization` — 組織（org プラグイン）
- `member` — 組織メンバーシップ（org プラグイン）
- `invitation` — 組織招待（org プラグイン）

アプリテーブル:
- `audit_logs` — 監査ログ（integer PK、actorUserId/organizationId は text FK）

**ID 型**: userId, orgId は全て `string`（text）。
**org 操作**: Better Auth の `/api/auth/organization/*` エンドポイントが全ハンドル。自作の org ルートは不要。

## D1 パラメータ制限

D1 は1クエリ ~100パラメータ上限。`inArray()` で大量 ID を渡す場合は `src/lib/d1-batch.ts` の `batchInArray()` を使う。

## Record Engine — ソフトデリート

レコード定義で `softDelete: true` を指定すると、生成コードが以下の動作に変わる:

- Drizzle スキーマに `deletedAt` カラム追加
- LIST / GET ONE に `isNull(deletedAt)` フィルタ追加
- DELETE が `deletedAt = now()` のソフトデリートに変更

## 型安全チェーン

```
Zod スキーマ → @hono/zod-validator（リクエスト検証）
    ↓
Drizzle スキーマ → drizzle-orm/d1（DBアクセス）
    ↓
Hono ルート定義 → export type AppType
    ↓
hc<AppType> → TanStack Query（フロントエンド）
```

バックエンドからフロントエンドまで型が貫通する。

## dev:split モード（認証フリッカー回避）

`@cloudflare/vite-plugin` の統合 dev モードで、Cookie ベースの認証フローがフリッカー（画面チラつき・無限リロード）する場合がある。原因はプラグインのリクエスト処理順。

`npm run dev:split` を使うと Vite と wrangler が分離起動し、`/api/*` はプロキシで中継される（`vite.config.split.ts`）。ビルド・デプロイは統合プラグインのままなので本番に影響はない。

- 通常: `npm run dev`（シンプル、認証なしなら問題なし）
- 認証あり: `npm run dev:split`（フリッカーする場合はこちら）

## Record Engine を使わない場合

coreからRecord Engineへの直接importはゼロ。以下を削除すればcoreは壊れない:

### ファイル削除
- `app/pages/records/` — RecordList/Detail/FormPage
- `app/components/fields/` — TextField, NumberField, DateField, SelectField, RelationField
- `app/components/DataTable.tsx, SummaryCards.tsx, StatusFilterTabs.tsx, StatusBadge.tsx`
- `shared/lib/record-def.ts, shared/records/`（task.ts含む）
- `scripts/generate-record.mjs, scripts/lib/record-engine.mjs`
- `test/record-engine.test.ts`
- **注意**: `scripts/seed-demo.mjs` は Record Engine に依存していないので削除しない（org作成に必要）
- `app/features/`, `src/features/`, `shared/features/`（生成済みコードがあれば）
- `src/db/schema.ts` 内のscaffold markersとその間の生成コード（もしあれば）

### package.json
- scripts: `record:generate` を削除（`seed:demo` は残す — core infrastructure）

### 検証
npx tsc --noEmit && npm run build で壊れないことを確認

## 認証を使わない場合

`AUTH_MODE=none`（または `AUTH_ENABLED=false`）で実行時無効化できる。
物理削除は不要 — コードは残るが実行されない。ビルドサイズへの影響も無視できる。

`AUTH_MODE=none` / `simple-admin` の場合、userId="1", orgId="default-org" が固定でセットされる。

**重要**: `seed:demo` を実行してデモ組織（id="default-org"）を作成すること。
seed:demo はべき等（何度実行しても安全）なので、すでに実行済みでも問題ない。

## Record Engine — 注意事項

- **ハイフン入りキー**: `defineRecord()` の `key` にハイフンを含めることができる（例: `"my-record"`）。生成コードはキャメルケースに変換して使う。
- **数値フィールド**: フォームからの入力は文字列になるため、`z.coerce.number()` を使う。`z.number()` ではバリデーションエラーになる。
- **FileField**: 型定義（`shared/lib/record-def.ts`）とバリデーション（Zod `z.string()`）は存在するが、UIのファイルアップロードは未実装。フォームでは「ファイルアップロードは未実装です」のプレースホルダーが表示される。R2連携の実装は将来課題。
- **RelationField 自動解決**: 生成されるForm/Detailページは、relation型フィールドの関連レコードを自動的にフェッチし、`relationOptions`/`relationLabels` として渡す。`relatedLabel` で指定したフィールドが表示ラベルになる。

## オプションバインディング（Queues / Cron / DurableObjects）

`wrangler.jsonc` では Queues・Cron Triggers・DurableObjects のセクションはデフォルトでコメントアウトされている。
必要なときだけアンコメントして使う。

- **DurableObjects** (`RATE_LIMITER`): レートリミットが必要なときにアンコメント。`migrations` も同時にアンコメントする。
- **Queues** (`JOBS`): バックグラウンドジョブ（メール送信など）が必要なときにアンコメント。
- **Cron Triggers**: 定期バッチ（セッション掃除など）が必要なときにアンコメント。

`src/types.ts` の `RATE_LIMITER` と `JOBS` はオプション（`?`）なので、バインディングがない状態でもビルド・実行できる。
health チェック (`/api/health`) もバインディングの有無を動的に確認する。

## 変更時のチェックリスト

コードを変更したら、commit 前に必ず確認する。

- [ ] この変更の影響を受ける他のファイルに波及漏れがないか（grep で確認）
- [ ] 不要になった関数・export・import が残っていないか
- [ ] CLAUDE.md / ARCHITECTURE.md / ROADMAP.md の記述と矛盾しないか（矛盾があればコードと一緒に直す）
- [ ] デザインシステムのルール（input: `rounded-lg`、button/panel: `rounded-xl`、`focus-visible:ring-2`、`text-slate-300` 以上、セマンティックトークン使用）に違反していないか
- [ ] `npm run ci:local` が通るか（lint + typecheck + test + unused + build 一括）

## パターン集

### 外部SQLiteからD1へのデータ移行

既存のSQLite DBからD1にデータを投入するパターン:

1. Pythonスクリプト（`scripts/export-xxx-sql.py`）で既存DBをSELECT → INSERT文を生成
2. `seed-app.sql` に出力（先頭にDELETE文でべき等化）
3. ローカル: `npx wrangler d1 execute <db-name> --local --file seed-app.sql`
4. リモート: `npx wrangler d1 execute <db-name> --remote --file seed-app.sql`（または `npm run setup:remote`）

注意点:
- NULL値はNOT NULLカラムに入れない（`COALESCE` や Python側で0に変換）
- テキストのシングルクォートはエスケープ（`''`）
- D1の1文あたりパラメータ上限に注意（大量INSERTは文を分割）

### アコーディオン式ドリルダウン（階層データ表示）

款→項→目のような階層データを展開表示するパターン。テンプレには含めないが、実装時の参考:

- フラットな配列をツリー構造に変換（Map + ネスト）
- 各ノードを `useState(false)` で開閉
- depth に応じてインデント（`ml-3 border-l`）
- 実例: tara-yosan の `app/components/DrillDown.tsx`

### 数値フォーマットユーティリティ

`app/lib/format.ts` にドメイン固有のフォーマット関数を置く:

- 通貨: `fmtCurrency(yen)` → `¥1,234`
- 増減: `fmtDiff(val)` → `+1,234` / `-567`
- パーセント: `fmtPercent(ratio)` → `12.3%`
- 1人あたり: `perCapita(total, population)` → `123,456円`

チャートの `valueFormatter` に渡すことで統一的な表示になる。

## 編集ガイド（AI向け）

### 自由に編集してよい領域
- `app/pages/` — ページの追加・変更・削除
- `app/components/` — UIコンポーネントの追加・変更
- `app/lib/format.ts` — ドメイン固有フォーマット関数
- `src/routes/` — APIルートの追加・変更
- `src/db/schema.ts` — テーブル追加（scaffold markers 間）
- `shared/schemas/` — Zodスキーマ追加
- `shared/records/` — Record Engine 定義追加
- `app/App.tsx` — ルート追加（`recordNavItems`, `publicNavItems` の編集）
- `seed-app.sql` — アプリ固有データ
- `wrangler.jsonc` の `vars` セクション

### 慎重に編集すべき領域
- `src/middleware/` — セキュリティミドルウェア（CSRF, auth, rate-limit）
- `src/lib/better-auth.ts` — Better Auth factory（per-request 必須）
- `src/lib/session.ts` — Cookie ヘルパー（simple-admin 用）
- `src/lib/crypto.ts` — 暗号処理
- `src/index.ts` — ルート登録順序に注意（middleware適用順に影響）
- `app/index.css` の `:root` — トークン追加は可、既存トークン削除は不可

### 触らないこと
- `src/lib/config.ts` — CORS/Cookie のバリデーション（Zodスキーマで保護）
- `scripts/lib/` — CLI内部ロジック（契約テストで保護）
- `test/` — 既存テストの削除

### 存在しない可能性があるディレクトリ
- `app/features/`, `src/features/`, `shared/features/` — Record Engine で生成後にのみ存在
- `.wrangler/` — `npm run dev` 実行後にのみ存在

## 規約

- API は `/api/` 以下、Hono ルーターで管理
- Env バインディングの型は `src/types.ts` に集約
- DB スキーマは `src/db/schema.ts` に定義（Drizzle）
- フロントの API 呼び出しは `hc<AppType>` + TanStack Query
- バリデーションは Zod で定義し `shared/schemas/` に置く（フロント・バック共有）
- パスエイリアス: `~/` → app, `@server/` → src, `@shared/` → shared
