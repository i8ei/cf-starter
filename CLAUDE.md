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
│   ├── features/example/   ← example feature hooks
│   ├── hooks/              ← core hooks
│   ├── lib/api.ts          ← Hono RPC クライアント（型付き）
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── shared/                 ← フロント・バック共有
│   ├── features/example/   ← example feature schemas
│   └── schemas/            ← core Zod スキーマ
├── src/                    ← Hono バックエンド (Worker)
│   ├── db/schema.ts        ← Drizzle スキーマ
│   ├── durable-objects/    ← rate limiter
│   ├── features/example/   ← example feature routes (items/kv/upload)
│   ├── lib/                ← auth, session, audit, orgs, crypto 等
│   ├── middleware/          ← auth, csrf, rate-limit, request-id, role
│   ├── queues/             ← queue producer / consumer
│   ├── routes/             ← core API ルート
│   │   ├── auth/           ← signup/login/logout/me/password-reset/email-verification
│   │   ├── health.ts       ← GET /api/health
│   │   ├── modules.ts      ← GET /api/modules
│   │   └── orgs.ts         ← organization CRUD / invites
│   ├── types.ts            ← Env バインディング型
│   └── index.ts            ← エントリーポイント（ルート集約 + エラーハンドラ）
├── scripts/                ← scaffold, plan, create CLI
├── test/                   ← Vitest テスト
├── migrations/             ← D1 マイグレーション
├── drizzle.config.ts
├── vitest.config.ts
├── vite.config.ts
├── wrangler.jsonc
└── index.html
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
```

## 開発の流れ

1. `wrangler.jsonc` の database_id / kv id を実際の値に置換
2. `npm run db:migrate` でローカルDB作成
3. `npm run dev` で開発開始
4. API追加: `src/routes/` にファイル追加 → `src/index.ts` で `.route()` 登録
5. テーブル追加: `src/db/schema.ts` に定義 → `npm run db:generate`

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

## 規約

- API は `/api/` 以下、Hono ルーターで管理
- Env バインディングの型は `src/types.ts` に集約
- DB スキーマは `src/db/schema.ts` に定義（Drizzle）
- フロントの API 呼び出しは `hc<AppType>` + TanStack Query
- バリデーションは Zod で定義し `shared/schemas/` に置く（フロント・バック共有）
- パスエイリアス: `~/` → app, `@server/` → src, `@shared/` → shared
