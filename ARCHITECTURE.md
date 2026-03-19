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

## Starter Core

- Better Auth（認証・セッション・パスワードリセット・メール検証）
- Better Auth organization プラグイン（組織・メンバー・招待）
- Better Auth admin プラグイン（ロール管理・BAN）
- AUTH_MODE 3モード制（none / simple-admin / better-auth）
- CSRF
- request id
- structured logging
- audit log
- error contract
- queue handling
- migration / build / test flow
- dashboard UI kit（Recharts チャート5種 + KPIカード + テーブル切替）
- dual layout（AppShell: 認証あり / PublicShell: 公開アプリ）
- public API pattern（GET-only、認証不要）

## Operational CLI

テンプレを安全に使うための運用 CLI を持ちます。主入口は `scripts/cf-starter.mjs` と `bin/cf-starter` です。

- `init` — プロジェクト初期化（名前置換 + D1作成 + URL設定 + DB構築）
- `doctor` — ローカル前提の診断
- `doctor --remote` — remote deploy 前提の追加診断（CORS_ORIGIN localhost警告、secrets確認ヒント含む）
- `env plan` — `wrangler.jsonc` から Cloudflare 資源と binding の不足を整理
- `db migrate --plan` — D1 migration の apply 前確認
- `db seed-demo --plan` — demo user / org 投入前の確認
- `setup remote` — リモートDB一括準備（migrate + seed:demo + seed-app.sql + secrets確認）
- `record generate --plan` — Record Engine 生成差分の確認
- `deploy --plan` — build + Wrangler deploy 前の確認

この CLI は JSON envelope を返すので、AI / CI から機械可読に扱えます。

テンプレ方針として、repo 本体の `wrangler.jsonc` には `database_id` や本番 `APP_BASE_URL` を固定しません。`npm run init` がコピー先で自動的に実値を埋めます。

## Record Engine

レコードを「保存可能なデータ」から「運用可能な仕事単位」に昇格させる共通基盤です。

レコード定義（`shared/records/*.ts`）を書いて `npm run record:generate` を実行すると、バックエンド（Drizzle テーブル + Zod スキーマ + Hono CRUD ルート）とフロントエンド（TanStack Query hooks）が一発生成されます。

Record Engine は3層で構成されます。

1. **定義層** — schema（フィールド定義）、relation（他レコードとの関係）、status（ワークフローの旗）
2. **操作層** — CRUD（規格化された基本動作）、validation（per-field + cross-field）、activity log（変化の物語）
3. **利用層** — list view（status tabs 付き一覧）、form view（sections ベースのフォーム）

生成物はただのコード。ロックインなし。生成後に自由に編集できます。

生成ロジックは `scripts/lib/record-engine.mjs` に純粋関数として分離されており、テストで保護されています。重複生成チェック、安全な挿入点検出、構造的なエラーメッセージを備えます。

型安全の保証:

- `defineRecord` はジェネリクスで `listView.columns` / `formView.sections[*].fields` を `fields` のキーに制約
- 生成コードに `as any` キャストなし
- `organizationId` は `.notNull()` + index 付きで生成

UI/UX 品質:

- アクセシビリティ: 全フィールドで `label`/`input` 紐付け、`focus-visible` リング、`aria-required`、`role="alert"` エラー通知
- DataTable: ソート（`aria-sort`）、キーボード操作（`tabIndex` + `onKeyDown`）、`<th scope="col">`、`<caption>`、空状態アクション誘導
- フォーム: 必須フィールド `*` 表示、送信スピナー、削除確認ダイアログ
- デザイン: StatusBadge セマンティックカラー（意味ベースの色割り当て）、Inter + Noto Sans JP フォント、`tabular-nums`

フロントエンドは wouter による SPA ルーティングで:

- 未ログイン時 → AuthPage をインライン表示（専用 `/login` ルートはない）
- `/` → HomePage（スターター案内 + 現在のユーザー/組織表示）
- `/:record` → 一覧（Record Engine で生成・配線後に有効）
- `/:record/new` → 新規作成（同上）
- `/:record/:id` → 詳細（status 変更ボタン付き、同上）
- `/:record/:id/edit` → 編集（同上）
- `/settings` → 組織設定

汎用ページコンポーネント（`RecordListPage`, `RecordDetailPage`, `RecordFormPage`）とフィールドコンポーネント（`TextField`, `NumberField`, `DateField`, `SelectField`, `RelationField`）を組み合わせて UI を構築します。

## Dashboard UI Kit

認証不要の公開アプリ（ダッシュボード、データ可視化）を迅速に構築するためのコンポーネント群です。

### レイアウト切替

`App.tsx` の `AuthGuard` が `AUTH_MODE` 環境変数に基づいてレイアウトを自動選択します。

- `AUTH_MODE=better-auth` / `simple-admin` → `AppShell`（デスクトップ向け、サイドバーナビ）
- `AUTH_MODE=none` → `PublicShell`（モバイルファースト、1カラム、ヘッダーナビ）

切替は runtime で行われ、ビルド設定の変更は不要です。

### チャートコンポーネント

`app/components/charts/` に5種の Recharts ラッパーを提供します。

- `HorizontalBar` — 横棒グラフ（ランキング等）
- `ChangeBar` — 増減棒（正=緑、負=赤、ReferenceLine付き）
- `TrendLine` — 折れ線（複数系列、CartesianGrid対応）
- `StackedBar` — 積み上げ棒（vertical/horizontal切替可）
- `PieDonut` — 円グラフ/ドーナツ（innerRadius>0でドーナツ）

すべて `ResponsiveContainer` でラップ済み。`valueFormatter` prop で数値表示をカスタマイズ可能。

### ダッシュボード用 UI 部品

- `KpiCard` — 数値カード（ラベル + 値 + サブテキスト + 色カスタマイズ）
- `Section` — セクション見出し（h2 + children のシンプルラッパー）
- `ChartTableToggle` — グラフとテーブルの切替タブ（WAI-ARIA tablist/tabpanel対応）
- `DataTableSimple` — 読み取り専用の軽量テーブル（DataTableのソート不要版）

### 公開 API パターン

`src/routes/public-example.ts` に GET-only の公開 API ルートのサンプルを置いています。

- `/api/public/*` プレフィックスで認証不要の API を配置
- CSRF middleware は GET をスキップするため、追加設定不要
- `src/index.ts` で `.route("/api/public/example", publicExample)` として登録

### 数値フォーマット

`app/lib/format.ts` にドメイン固有のフォーマット関数を置く規約です。チャートの `valueFormatter` に渡して統一的な表示を実現します。

### Record Engine を使わない場合

coreからRecord Engineへの直接importはゼロ。CLAUDE.md の「Record Engine を使わない場合」セクションに従ってファイルを削除すれば、coreは壊れない。

## Feature Structure

`cf-starter` は feature-based structure を採用しています。

- core routes: `src/routes/`（`health.ts`, `auth/`, `public-example.ts`）
- feature routes: `src/features/{key}/routes.ts`（Record Engine で生成）
- core hooks: `app/hooks/`
- feature hooks: `app/features/{key}/hooks/`（Record Engine で生成）
- core schema: `shared/schemas/`
- feature schema: `shared/features/{key}/schema.ts`（Record Engine で生成）
- record definitions: `shared/records/{key}.ts`
- chart components: `app/components/charts/`（Recharts ラッパー5種）
- dashboard components: `app/components/`（KpiCard, Section, ChartTableToggle, DataTableSimple）
- layout shells: `app/components/`（AppShell: 認証あり、PublicShell: 公開アプリ）

新しい業務機能を追加する場合は、Record Engine でレコード定義を書いてコード生成するのが最速です。
ダッシュボード系アプリの場合は、チャートキット + PublicShell + GET-only API で構築します。
業務テーブルは `organization_id` を持たせて current organization で絞るのを基本にします（生成物に自動で含まれます）。

## 認証（Better Auth）

[Better Auth](https://better-auth.com/) による認証基盤。AUTH_MODE で3モード切替。

### AUTH_MODE

| モード | 認証方式 | DB テーブル | 用途 |
|--------|----------|-------------|------|
| `none` | なし（mock） | 不要 | 公開アプリ |
| `simple-admin` | ADMIN_PASSWORD + HMAC Cookie | 不要 | 管理画面 |
| `better-auth` | Better Auth DB session | 必要 | フルユーザー管理 |

### DB テーブル（Better Auth 管理）

- `user` — ユーザー（text ID, role, emailVerified, banned）
- `session` — セッション（token, activeOrganizationId）
- `account` — 認証アカウント（credential provider, password hash）
- `verification` — 検証トークン（パスワードリセット・メール検証）
- `organization` — 組織（org プラグイン）
- `member` — 組織メンバーシップ（org プラグイン、unique on org+user）
- `invitation` — 組織招待（org プラグイン）

### API エンドポイント

Better Auth 内蔵: `/api/auth/sign-up/email`, `/api/auth/sign-in/email`, `/api/auth/sign-out`, `/api/auth/organization/*` 等
カスタム: `/api/auth/me`（ユーザー+組織情報）, `/api/auth/logout`, `/api/auth/admin-login`（simple-admin 用）

### 重要な制約

- **per-request instance 必須**: `createAuth(env)` をリクエストごとに呼ぶ。シングルトン厳禁（D1 stale reference で30秒+ハング）
- **BETTER_AUTH_SECRET**: better-auth モードで必須。未設定だと health チェックで警告
- **banned ユーザー**: middleware で `user.banned` をチェックし 403 を返す

### 認可

2層の認可:

- platform-level: `user.role`（Better Auth admin プラグイン）→ `requireRole()` middleware
- tenant-level: `member.role`（org プラグイン）→ `requireOrgRole()` middleware

middleware 後の route で参照可能な context:

- `c.get("userId")` — string
- `c.get("roles")` — string[]
- `c.get("orgId")` — string | undefined
- `c.get("orgRole")` — string | undefined

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

`JOBS` Queue binding を持ち、job を処理します。

- `user.welcome` — ウェルカムメール
- `upload.process` — ファイルアップロード処理
- `organization.invite_email` — 組織招待メール

パスワードリセット・メール検証は Better Auth が内蔵処理するため、Queue 不要。
consumer は `src/queues/jobs.ts` と Worker module の `queue()` handler に集約します。

## D1 の既知制約

D1 を使う際に注意すべき制約です。

### パラメータ上限（~100）

D1 は1クエリあたり約100個のバインドパラメータ上限があります。`inArray()` で大量の ID を渡すとクエリが失敗します。`src/lib/d1-batch.ts` の `batchInArray()` を使ってチャンキングしてください。

### トランザクション非対応

D1 は SQL の `BEGIN TRANSACTION` を受け付けません。複数テーブルへのアトミックな書き込みが必要な場合は、1つの `db.batch()` 呼び出しにまとめるか、アプリケーション層で冪等性を担保してください。

### CASCADE DELETE と Drizzle

Drizzle のマイグレーションでテーブルを再作成する際、`PRAGMA foreign_keys` が期待通りに動かないケースがあります。CASCADE DELETE に依存する設計は避け、アプリケーション層で関連レコードの削除を制御してください。

## 現在の不足

現時点で未実装、または弱いものです。Record Engine vNext として優先順に整理しています。

**Tier 1: 複雑な業務レコードに耐える**

- Input / Persist 分離 — 入力モデルと保存モデルの分離（`input`, `persist`, `transform`）
- Relation 強化 — 候補取得 query、dependent relation、表示ラベル、badge 表示
- Domain Hooks — ライフサイクルフック（`beforeCreate`, `afterStatusChange` 等）

**Tier 2: 生成器から運用基盤へ**

- Activity Log 統合 — 差分サマリ、detail 画面の履歴表示、コメント追加
- View Presets — フィルタ+ソート+列の「見方」定義、preset 切替 UI
- Record Actions — CRUD 以外の業務操作（完了、複製、CSV 出力等）

**Tier 3: 使い勝手を上げる**

- Computed Fields — 保存値や relation からの導出値

## Security Invariants

AI や開発者は、次を壊さないでください。

- Better Auth の per-request instance パターンを崩さない（シングルトン厳禁）
- CSRF 保護を削らない
- request id を外さない
- error contract を route ごとにバラバラにしない
- organization context を無視して multi-tenant data を読む route を増やさない
- 監査対象の操作から audit log を外さない
- banned ユーザーチェックを外さない
