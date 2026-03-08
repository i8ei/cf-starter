# cf-starter

Cloudflare フルスタック スターターテンプレート。

`cp` して即開発。DB・ストレージ・キャッシュ・API・フロントが全部入り。

## スタック

| レイヤー | 技術 |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS v4 + TanStack Query |
| Backend | Hono on Cloudflare Workers |
| DB | D1 (SQLite) + Drizzle ORM |
| Storage | R2 (オブジェクトストレージ) |
| Cache | KV (キーバリューストア) |
| Validation | Zod (フロント・バック共有) |
| Build | @cloudflare/vite-plugin (統合ビルド) |

## 使い方

### 新プロジェクトを始める

```bash
cp -r cf-starter my-app
cd my-app
git init
npm install
npm run dev
```

### Cloudflare にデプロイする

```bash
# 1. リソース作成（初回のみ）
wrangler d1 create my-app-db
wrangler kv namespace create KV
wrangler r2 bucket create my-app-bucket

# 2. wrangler.jsonc に返ってきた ID を記入

# 3. リモート DB にテーブル作成
npm run db:migrate:remote

# 4. デプロイ
npm run deploy
```

## コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | ローカル開発（React + Worker + DB が同時に起動） |
| `npm run build` | ビルド |
| `npm run preview` | ビルド後プレビュー |
| `npm run deploy` | Cloudflare にデプロイ |
| `npm run db:generate` | Drizzle スキーマからマイグレーション SQL 生成 |
| `npm run db:migrate` | D1 ローカルマイグレーション |
| `npm run db:migrate:remote` | D1 リモートマイグレーション |

## ディレクトリ構成

```
cf-starter/
├── app/                    ← React フロントエンド
│   ├── hooks/              ← TanStack Query カスタムフック
│   ├── lib/api.ts          ← Hono RPC クライアント（型付き）
│   ├── App.tsx
│   └── main.tsx
├── shared/                 ← フロント・バック共有
│   └── schemas/            ← Zod バリデーションスキーマ
├── src/                    ← Hono バックエンド (Worker)
│   ├── db/schema.ts        ← Drizzle テーブル定義
│   ├── routes/             ← API ルート
│   ├── types.ts            ← Env バインディング型
│   └── index.ts            ← エントリーポイント
├── migrations/             ← D1 マイグレーション
├── vite.config.ts
├── wrangler.jsonc
└── index.html
```

## サンプル API

| エンドポイント | 内容 |
|---|---|
| `GET /api/health` | D1 / KV / R2 の接続チェック |
| `GET /api/items` | D1 からアイテム一覧取得 |
| `POST /api/items` | D1 にアイテム追加（Zod バリデーション付き） |
| `GET/POST /api/upload` | R2 ファイル一覧 / アップロード |
| `GET/PUT /api/kv/:key` | KV 読み書き |

## 型安全チェーン

バックエンドからフロントエンドまで型が貫通する。

```
Zod スキーマ (shared/)
    ↓
@hono/zod-validator（リクエスト検証）
    ↓
Drizzle ORM → D1（DB アクセス）
    ↓
Hono ルート → export type AppType
    ↓
hc<AppType>（型付き RPC クライアント）
    ↓
TanStack Query（フロントエンド）
```

API の引数や戻り値を変えると、フロント側でコンパイルエラーになる。バグが本番に行く前に気づける。

## 開発の流れ

**API を追加する:**

1. `src/routes/` にファイル追加
2. `src/index.ts` で `.route()` 登録
3. フロントから `client.api.xxx.$get()` で呼ぶ

**テーブルを追加する:**

1. `src/db/schema.ts` にテーブル定義
2. `npm run db:generate` でマイグレーション SQL 生成
3. `npm run db:migrate` でローカル DB に適用

**バリデーションを共有する:**

1. `shared/schemas/` に Zod スキーマ定義
2. バックエンド: `zValidator("json", schema)` で使う
3. フロントエンド: 同じスキーマで入力チェック

## 本番チェックリスト

- [ ] `wrangler.jsonc` の `database_id` / KV `id` を実際の値に置換
- [ ] CORS の origin を自ドメインに制限（`src/index.ts`）
- [ ] 必要に応じて認証を追加

## License

MIT
