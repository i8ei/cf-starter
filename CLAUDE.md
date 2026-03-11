# cf-starter

Cloudflare フルスタック スターターテンプレート。

## スタック

- **Frontend**: React + TypeScript + Tailwind CSS v4 + TanStack Query
- **Backend**: Hono on Cloudflare Workers
- **DB**: D1 + Drizzle ORM（型安全、マイグレーション自動生成）
- **Storage**: R2（オブジェクト）/ KV（キーバリュー）
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
│   │   └── StatusFilterTabs.tsx ← ステータスフィルタータブ
│   ├── features/           ← feature hooks（生成物もここ）
│   ├── hooks/              ← core hooks
│   ├── lib/api.ts          ← Hono RPC クライアント（型付き）
│   ├── pages/              ← ページコンポーネント
│   │   ├── records/        ← 汎用レコード画面（List/Detail/Form）
│   │   ├── AuthPage.tsx
│   │   └── SettingsPage.tsx
│   ├── App.tsx             ← wouter ルーティング
│   ├── main.tsx
│   └── index.css
├── shared/                 ← フロント・バック共有
│   ├── features/           ← feature schemas（生成物もここ）
│   ├── lib/record-def.ts   ← Record Engine 型定義（defineRecord）
│   ├── records/            ← レコード定義ファイル置き場
│   └── schemas/            ← core Zod スキーマ
├── src/                    ← Hono バックエンド (Worker)
│   ├── db/schema.ts        ← Drizzle スキーマ
│   ├── durable-objects/    ← rate limiter
│   ├── features/           ← feature routes（生成物もここ）
│   ├── lib/                ← auth, session, audit, orgs, crypto 等
│   ├── middleware/          ← auth, csrf, rate-limit, request-id, role
│   ├── queues/             ← queue producer / consumer
│   ├── routes/             ← core API ルート
│   ├── types.ts            ← Env バインディング型
│   └── index.ts            ← エントリーポイント（ルート集約 + エラーハンドラ）
├── scripts/
│   ├── generate-record.mjs ← Record Engine コードジェネレーター
│   ├── lib/record-engine.mjs ← 生成ロジック（純粋関数、テスト付き）
│   └── ...                 ← scaffold, plan, create CLI
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
npm test                 # Vitest テスト
npm run db:generate      # Drizzle スキーマからマイグレーション生成
npm run db:migrate       # D1 ローカルマイグレーション
npm run db:migrate:remote  # D1 リモートマイグレーション
npm run app:scaffold     # 新しいアプリをスキャフォールド
npm run app:plan         # core / example の切り分け確認
npm run modules:plan     # module 導入状況確認
npm run record:generate -- --record shared/records/xxx.ts  # Record Engine でコード生成
```

## 開発の流れ

1. `wrangler.jsonc` の database_id / kv id を実際の値に置換
2. `npm run db:migrate` でローカルDB作成
3. `npm run dev` で開発開始
4. API追加: `src/routes/` にファイル追加 → `src/index.ts` で `.route()` 登録
5. テーブル追加: `src/db/schema.ts` に定義 → `npm run db:generate`

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
- `RecordListPage` — status tabs 付き一覧、クライアントサイドソート、空状態アクション誘導
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
- `/` → ホーム（現在は Example Items ページ）
- `/:record` → 一覧（Record Engine で生成・配線後に有効）
- `/:record/new` → 新規作成（同上）
- `/:record/:id` → 詳細（同上）
- `/:record/:id/edit` → 編集（同上）
- `/settings` → 組織設定

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
