# cf-starter

Cloudflare ネイティブなフルスタック開発を、最短で始めるためのスターターテンプレート。

cp して即開発。DB・ストレージ・キャッシュ・API・認証・フロントが全部入り。

## スタック

| レイヤー | 技術 |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS v4 + TanStack Query |
| Backend | Hono on Cloudflare Workers |
| DB | D1 (SQLite) + Drizzle ORM |
| Storage | R2 (オブジェクトストレージ) |
| Cache | KV (キーバリューストア) |
| Rate Limit | Durable Object |
| Validation | Zod (フロント・バック共有) |
| Build | `@cloudflare/vite-plugin` (統合ビルド) |

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
#    CORS_ORIGIN も本番ドメインに設定（例: https://app.example.com）
#    必要なら COOKIE_SAME_SITE / COOKIE_SECURE も運用に合わせて設定

# 3. リモート DB にテーブル作成
npm run db:migrate:remote

# 4. デプロイ
npm run deploy
```

## コマンド

| コマンド                        | 内容                                 |
| --------------------------- | ---------------------------------- |
| `npm run dev`               | ローカル開発（統合モード: Vite + workerd）      |
| `npm run dev:split`         | ローカル開発（分離モード: Vite + wrangler 別起動） |
| `npm run build`             | ビルド                                |
| `npm run preview`           | ビルド後プレビュー                          |
| `npm run deploy`            | Cloudflare にデプロイ                   |
| `npm run test`              | Vitest による自動テスト                    |
| `npm run db:generate`       | Drizzle スキーマからマイグレーション SQL 生成      |
| `npm run db:migrate`        | D1 ローカルマイグレーション                    |
| `npm run db:migrate:remote` | D1 リモートマイグレーション                    |

GitHub Actions の CI で `npm test` と `npm run build` を毎回実行する。

## ディレクトリ構成

```text
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

| ディレクトリ    | 役割                      |
| --------- | ----------------------- |
| `app/`    | UI とクライアントロジック          |
| `src/`    | Worker 上で動くサーバーロジック     |
| `shared/` | 両方が読む「契約」（バリデーションスキーマ等） |

フロントとバックが `shared/` を介して型とバリデーションを共有することで、API の変更が即座にコンパイルエラーとして検出される。片方だけ変えて齟齬が生まれる事故を防ぐ。

## サンプル API

| エンドポイント                 | 内容                            |
| ----------------------- | ----------------------------- |
| `GET /api/health`       | D1 / KV / R2 / Env の接続・設定チェック |
| `GET /api/items`        | D1 からアイテム一覧取得                 |
| `POST /api/items`       | D1 にアイテム追加（Zod バリデーション付き）     |
| `GET /api/upload`       | R2 ファイル一覧取得（要認証）              |
| `POST /api/upload`      | R2 へアップロード（要認証, 10MB制限）      |
| `GET /api/kv/:key`      | KV 読み取り（要認証, admin ロール必須）       |
| `PUT /api/kv/:key`      | KV 書き込み（要認証, admin ロール必須）       |
| `POST /api/auth/signup` | ユーザー登録 → セッション発行              |
| `POST /api/auth/login`  | ログイン → セッション発行                |
| `POST /api/auth/logout` | ログアウト（要認証）                    |
| `GET /api/auth/me`      | 現在のユーザーとロール取得（要認証）          |

### 認証について

D1 セッション + HttpOnly Cookie によるシンプルな実装。パスワードは PBKDF2 でハッシュ化。旧形式（`salt:sha256`）が残っていても、ログイン成功時に自動で PBKDF2 形式へ再ハッシュされる。

`/api/auth/signup` と `/api/auth/login` には Durable Object ベースのレート制限（1分窓）を適用。ログイン成功時は既存セッションを失効して新しい1本に更新する。

Cookie は `Secure=true` のとき `__Host-session`、`Secure=false` のとき互換用の `session` を使う。Cookie 属性は `wrangler.jsonc` の `vars.COOKIE_SAME_SITE`（`Lax` / `Strict` / `None`）と `vars.COOKIE_SECURE`（`true` / `false`）で切替できる。`SameSite=None` のときは自動で `Secure=true` になる。

### CSRF について

`/api/*` の変更系メソッド（POST/PUT/PATCH/DELETE）で、認証 Cookie（`__Host-session` / `session`）が付いている場合は `Origin` または `Referer` が許可済みオリジンと一致することを必須にしている。

### RBAC について

`roles` / `user_roles` テーブルを持ち、`member` と `admin` を seed する。新規 signup ユーザーには自動で `member` を付与する。サンプルでは `KV` ルートを `admin` 限定にして `requireRole()` の使い方を示している。

### 監査ログについて

`audit_logs` テーブルに `who did what` を残す共通 helper を入れてある。`signup/login/logout`、`item.create`、`kv.put`、`upload.create`、権限不足拒否が監査対象。

### セッション掃除（Cron）

`wrangler.jsonc` の Cron Trigger（デフォルト: 15分ごと）で期限切れセッションを自動削除する。`sessions.expires_at` にはインデックスを貼ってあるため、件数が増えても掃除が重くなりにくい。

### ログについて

`login success/fail`、`rate limit hit`、`csrf reject`、`session purge` は構造化 JSON ログで出力する。Cloudflare Logs での絞り込みやすさを優先している。すべてのレスポンスには `X-Request-Id` を付け、同じ ID をログにも載せる。

### 設定検証について

`CORS_ORIGIN`、`COOKIE_SAME_SITE`、`COOKIE_SECURE` は実行時に Zod で検証する。`CORS_ORIGIN` に path 付き URL など不正値が入っている場合は早めに検出できる。

### `dev:split` について

`@cloudflare/vite-plugin` の統合モードで Cookie / セッションまわりの挙動が不安定な場合は `npm run dev:split` を使う。Vite と Wrangler が分離起動し、`/api/*` はプロキシされる。ビルド・デプロイは統合プラグインのままなので、本番には影響しない。

## 型安全チェーン

バックエンドからフロントエンドまで型が貫通する。

```text
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

### API を追加する

1. `src/routes/` にファイル追加
2. `src/index.ts` で `.route()` 登録
3. フロントから `client.api.xxx.$get()` で呼ぶ

### テーブルを追加する

1. `src/db/schema.ts` にテーブル定義
2. `npm run db:generate` でマイグレーション SQL 生成
3. `npm run db:migrate` でローカル DB に適用

### ルートを認証必須にする

`requireAuth` ミドルウェアを挟むだけ。

```ts
import { requireAuth } from "../middleware/auth";

const app = new Hono<{ Bindings: Env }>()
  .get("/", requireAuth, async (c) => {
    const userId = c.get("userId");
    // ...
  });
```

### ルートをロール必須にする

`requireRole("admin")` のように挟むだけ。

```ts
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/require-role";

const app = new Hono<AppContextEnv>()
  .get("/", requireAuth, requireRole("admin"), async (c) => {
    return c.json({ ok: true });
  });
```

### バリデーションを共有する

- `shared/schemas/` に Zod スキーマ定義
- バックエンド: `zValidator("json", schema)` で使う
- フロントエンド: 同じスキーマで入力チェック

## 本番チェックリスト

- [ ] `wrangler.jsonc` の `database_id` / KV `id` を実際の値に置換
- [ ] `wrangler.jsonc` の `vars.CORS_ORIGIN` を本番ドメインに変更（複数はカンマ区切り）
- [ ] `wrangler.jsonc` の `vars.COOKIE_SAME_SITE` / `vars.COOKIE_SECURE` を配信形態に合わせて調整
- [ ] `wrangler.jsonc` の Durable Object binding / migration を変更した場合は tag を進める
- [ ] 認証 Cookie を使う場合、フロントの API 呼び出しが `credentials: include` になっているか確認
- [ ] Cron を使わない構成にする場合は `wrangler.jsonc` の `triggers.crons` を調整
- [ ] auth レート制限（`src/routes/auth.ts`）の閾値を要件に合わせて調整
- [ ] `CORS_ORIGIN` に origin だけを入れる（path / query / hash は入れない）

## スケールするとき

ルートやフックが増えてきたら、機能単位のディレクトリに移行する。

```text
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
