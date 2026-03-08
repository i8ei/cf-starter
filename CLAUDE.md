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
│   ├── hooks/              ← TanStack Query カスタムフック
│   ├── lib/api.ts          ← Hono RPC クライアント（型付き）
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── shared/                 ← フロント・バック共有
│   └── schemas/            ← Zod バリデーションスキーマ
├── src/                    ← Hono バックエンド (Worker)
│   ├── db/schema.ts        ← Drizzle スキーマ
│   ├── routes/             ← API ルート
│   │   ├── auth.ts         POST signup/login/logout, GET me
│   │   ├── health.ts       GET /api/health
│   │   ├── items.ts        GET/POST /api/items (D1)
│   │   ├── upload.ts       GET/POST /api/upload (R2)
│   │   └── kv.ts           GET/PUT /api/kv/:key (KV)
│   ├── middleware/auth.ts   ← requireAuth ミドルウェア
│   ├── types.ts            ← Env バインディング型
│   └── index.ts            ← エントリーポイント（ルート集約 + エラーハンドラ）
├── migrations/             ← D1 マイグレーション
├── drizzle.config.ts
├── vite.config.ts
├── wrangler.jsonc
└── index.html
```

## コマンド

```bash
npm run dev              # ローカル開発（Vite + workerd 統合）
npm run build            # ビルド
npm run preview          # ビルド後プレビュー
npm run deploy           # Cloudflare にデプロイ
npm run db:generate      # Drizzle スキーマからマイグレーション生成
npm run db:migrate       # D1 ローカルマイグレーション
npm run db:migrate:remote  # D1 リモートマイグレーション
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

## 規約

- API は `/api/` 以下、Hono ルーターで管理
- Env バインディングの型は `src/types.ts` に集約
- DB スキーマは `src/db/schema.ts` に定義（Drizzle）
- フロントの API 呼び出しは `hc<AppType>` + TanStack Query
- バリデーションは Zod で定義し `shared/schemas/` に置く（フロント・バック共有）
- パスエイリアス: `~/` → app, `@server/` → src, `@shared/` → shared
