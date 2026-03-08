# cf-starter

Cloudflare ネイティブなフルスタック開発を、最短で始めるためのスターターテンプレート。

`cp` して即開発。DB・ストレージ・キャッシュ・API・認証・フロントが全部入り。

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

### 前提

- Node.js 20+
- npm
- Wrangler CLI にログイン済み (`npx wrangler login`)

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

# 2. wrangler.jsonc の bindings に返ってきた ID / name を記入

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

## 設計思想

| ディレクトリ | 役割 |
|---|---|
| `app/` | UI とクライアントロジック |
| `src/` | Worker 上で動くサーバーロジック |
| `shared/` | 両方が読む「契約」（バリデーションスキーマ等） |

フロントとバックが `shared/` を介して型とバリデーションを共有することで、API の変更が即座にコンパイルエラーとして検出される。片方だけ変えて齟齬が生まれる事故を防ぐ。

## サンプル API

| エンドポイント | 内容 |
|---|---|
| `GET /api/health` | D1 / KV / R2 / Env の接続・設定チェック |
| `GET /api/items` | D1 からアイテム一覧取得 |
| `POST /api/items` | D1 にアイテム追加（Zod バリデーション付き） |
| `GET/POST /api/upload` | R2 ファイル一覧 / アップロード（10MB制限） |
| `GET/PUT /api/kv/:key` | KV 読み書き（キーバリデーション付き） |
| `POST /api/auth/signup` | ユーザー登録 → セッション発行 |
| `POST /api/auth/login` | ログイン → セッション発行 |
| `POST /api/auth/logout` | ログアウト（要認証） |
| `GET /api/auth/me` | 現在のユーザー取得（要認証） |

> **認証について:** D1 セッション + HttpOnly Cookie によるシンプルな実装。小規模業務ツール（~100ユーザー）向け。大規模 SaaS には向かない。さらに外側の門が必要な場合は [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) を前段に置くこともできる。

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

**ルートを認証必須にする:**

`requireAuth` ミドルウェアを挟むだけ。

```typescript
import { requireAuth } from "../middleware/auth";

const app = new Hono<{ Bindings: Env }>()
  .get("/", requireAuth, async (c) => {
    const userId = c.get("userId");
    // ...
  });
```

**バリデーションを共有する:**

1. `shared/schemas/` に Zod スキーマ定義
2. バックエンド: `zValidator("json", schema)` で使う
3. フロントエンド: 同じスキーマで入力チェック

## 本番チェックリスト

- [ ] `wrangler.jsonc` の `database_id` / KV `id` を実際の値に置換
- [ ] CORS の origin を自ドメインに制限（`src/index.ts`）
- [ ] 認証が必要なルートにだけ `requireAuth` を付ける（デフォルトは認証なし）

## スケールするとき

ルートやフックが増えてきたら、機能単位のディレクトリに移行する。

```
features/
  items/
    api.ts
    schema.ts
    hooks.ts
    components/
```

小さいうちは今の flat 構成で十分。育ったら移行。

## このテンプレで作れるもの

- ボランティアタクシー配車
- 集会所・施設予約
- 農作業・栽培記録
- 地域イベント管理
- 漁業ダッシュボード
- 会員限定の業務ツール
- 小規模マッチングサービス
- 在庫・出荷管理
- アンケート・投票システム
- 地域通貨・ポイント管理

## 向いているもの / 向いていないもの

### 向いているもの

- 小規模〜中規模の業務ツール
- 地域向け Web アプリ
- 会員限定ツール
- ダッシュボード / CRUD / 予約 / 配車

### 向いていないもの

- 超高トラフィックなリアルタイムゲーム
- GPU 前提の AI 処理
- 複雑すぎる大規模 SaaS 基盤

## License

MIT
