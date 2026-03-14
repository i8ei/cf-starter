# cf-starter

Cloudflare フルスタック スターターテンプレート。`cp` して使うことを前提に設計。

## スタック

- **Frontend**: React + TypeScript + Tailwind CSS v4 + TanStack Query
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
│   │   ├── fields/         ← フォーム用フィールドコンポーネント
│   │   ├── AppShell.tsx    ← ナビゲーション付きレイアウト
│   │   ├── Panel.tsx       ← カードUI
│   │   ├── DataTable.tsx   ← テーブル表示
│   │   ├── StatusBadge.tsx ← ステータスバッジ
│   │   ├── StatusFilterTabs.tsx ← ステータスフィルタータブ
│   │   └── SummaryCards.tsx ← ステータス別件数カード（RecordListPage 上部）
│   ├── features/           ← feature hooks（Record Engine 生成物）
│   ├── hooks/              ← core hooks
│   ├── lib/api.ts          ← Hono RPC クライアント（型付き）
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
│   ├── lib/                ← auth, session, audit, orgs, crypto 等
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
npm test                 # Vitest テスト
npm run db:generate      # Drizzle スキーマからマイグレーション生成
npm run db:migrate       # D1 ローカルマイグレーション
npm run db:migrate:remote  # D1 リモートマイグレーション
npm run seed:demo        # デモユーザー・組織を投入
npm run record:generate -- --record shared/records/xxx.ts  # Record Engine でコード生成

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

## 開発の流れ

1. テンプレ repo 本体では `wrangler.jsonc` の `database_id` / `APP_BASE_URL` はプレースホルダのまま維持する
2. 実アプリとして使うコピー先で `database_id` / URL / binding ids を実値に置換
3. `npm run db:migrate` でローカルDB作成
4. `npm run dev` で開発開始
5. API追加: `src/routes/` にファイル追加 → `src/index.ts` で `.route()` 登録
6. テーブル追加: `src/db/schema.ts` に定義 → `npm run db:generate`

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

デザインシステム:
- フォント: Inter + Noto Sans JP（`tabular-nums` 対応）
- StatusBadge: セマンティックカラー（ステータスの意味に基づく色割り当て）
- border-radius: input `rounded-lg`、button/panel `rounded-xl`

### ルーティング

wouter による SPA ルーティング:
- 未ログイン時 → AuthPage をインライン表示（専用 `/login` ルートはない）
- `/` → HomePage（スターター案内 + 現在のユーザー/組織表示）
- `/:record` → 一覧（Record Engine で生成・配線後に有効）
- `/:record/new` → 新規作成（同上）
- `/:record/:id` → 詳細（同上）
- `/:record/:id/edit` → 編集（同上）
- `/settings` → 組織設定

## パブリックページ（認証不要）

`/p/*` プレフィックスで認証不要のページを配置できる。

- **フロント**: `app/App.tsx` の `Switch` 先頭（AuthGuard の外）に `<Route path="/p/xxx">` を追加
- **バック**: `src/index.ts` に `requireAuth` なしのルートを `.route("/api/public", publicRoutes)` で登録
- CSRF は GET のみなので問題なし

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
- `scripts/seed-demo.mjs`
- `test/record-engine.test.ts`
- `app/features/`, `src/features/`, `shared/features/`（生成済みコードがあれば）
- `src/db/schema.ts` 内のscaffold markersとその間の生成コード（もしあれば）

### package.json
- scripts: `record:generate`, `seed:demo` を削除

### 検証
npx tsc --noEmit && npm run build で壊れないことを確認

## 認証を使わない場合

AUTH_ENABLED=false（.dev.varsまたはwrangler.jsonc）で実行時無効化できる。
物理削除は不要 — コードは残るが実行されない。ビルドサイズへの影響も無視できる。

AUTH_ENABLED=false の場合、セッション検証がスキップされ orgId が自動的に 1 にセットされる。
ローカル開発や認証不要の公開アプリに使う。

## Record Engine — 注意事項

- **ハイフン入りキー**: `defineRecord()` の `key` にハイフンを含めることができる（例: `"my-record"`）。生成コードはキャメルケースに変換して使う。
- **数値フィールド**: フォームからの入力は文字列になるため、`z.coerce.number()` を使う。`z.number()` ではバリデーションエラーになる。

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
- [ ] デザインシステムのルール（input: `rounded-lg`、button/panel: `rounded-xl`、`focus-visible:ring-2`、`text-slate-300` 以上）に違反していないか
- [ ] `npx tsc --noEmit` && `npm test` && `npm run build` が通るか

## 規約

- API は `/api/` 以下、Hono ルーターで管理
- Env バインディングの型は `src/types.ts` に集約
- DB スキーマは `src/db/schema.ts` に定義（Drizzle）
- フロントの API 呼び出しは `hc<AppType>` + TanStack Query
- バリデーションは Zod で定義し `shared/schemas/` に置く（フロント・バック共有）
- パスエイリアス: `~/` → app, `@server/` → src, `@shared/` → shared
