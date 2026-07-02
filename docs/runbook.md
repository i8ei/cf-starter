# 運用ランブック

> ログ・ヘルス・診断・オプションバインディングの詳細。デプロイ手順の要点は CLAUDE.md 本体にある。

## request-id 伝搬

```
クライアント → X-Request-Id ヘッダー（任意）
  → requestId middleware（なければ crypto.randomUUID() 生成）
    → c.set("requestId", id)  ← Hono Context に保存
    → レスポンスヘッダー X-Request-Id に付与
    → logRequestEvent() が自動で requestId を含める
```

- `src/middleware/request-id.ts` が全リクエストに適用
- フォーマット: `^[A-Za-z0-9._-]{8,128}$`（外部からの ID も受け入れ可能）

## /api/health レスポンス契約

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

## 構造化ログ

```ts
// 汎用（リクエスト外でも使える）
logEvent("info", "cron.started", { jobName: "cleanup" });

// リクエストコンテキスト付き（method, path, ip, requestId を自動付与）
logRequestEvent("error", "auth.failed", c, { reason: "invalid_password" });
```

- `src/lib/logging.ts` に定義
- 出力: JSON 1行（Cloudflare Dashboard Logs でパース可能）
- フィールド: `ts`, `level`, `event`, + カスタムフィールド

## doctor の使い方

```bash
npm run doctor                    # ローカル環境チェック
npm run doctor -- --remote        # リモートデプロイ前チェック
npm run doctor -- --json          # JSON 出力（CI / スクリプト向け）
npm run doctor -- --remote --json # リモート + JSON
```

- checks: Node.js バージョン、npm scripts、必須ファイル、Wrangler 設定、D1 設定
- `--remote`: APP_BASE_URL HTTPS チェック、CORS_ORIGIN チェック、Wrangler 認証確認

## 本番で最低限見るもの

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

## オプションバインディング / 既定有効の補助バインディング

`wrangler.jsonc` では DurableObjects（`RATE_LIMITER`）と Cron Triggers は既定有効、Queues と Workers AI は既定でコメントアウトされている。

- **DurableObjects** (`RATE_LIMITER`): 認証エンドポイントのレートリミット用。既定有効。不要なら `durable_objects` と `migrations` を同時に削除/コメントアウトする。
- **Cron Triggers**: 期限切れセッション掃除などの定期メンテナンス用。既定で毎日1回（`0 3 * * *`）実行。頻度変更可。
- **Queues** (`JOBS`): バックグラウンドジョブ（メール送信など）が必要なときにアンコメント。
- **Workers AI** (`AI`): AI機能が必要なときに `ai` binding をアンコメント。サンプルルートは `/api/ai/example/prompt`（要認証 + IPレートリミット。Workers AIはクレジットを消費するため匿名公開しない）。

`src/types.ts` の `RATE_LIMITER` / `JOBS` / `AI` はオプション（`?`）なので、バインディングがない状態でもビルド・実行できる。
health チェック (`/api/health`) もバインディングの有無を動的に確認する。

## 全コマンド一覧

```bash
npm run dev              # ローカル開発（統合モード: Vite + workerd）
npm run dev:split        # ローカル開発（分離モード: Vite + wrangler 別起動）
npm run build            # ビルド
npm run preview          # ビルド後プレビュー
npm run security-check   # デプロイ前セキュリティ監査（deploy 時に自動実行）
npm run deploy           # セキュリティチェック → ビルド → Cloudflare にデプロイ
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
npm run ci:local         # ローカル品質チェック（lint + typecheck + test + unused + build 一括）
npm run docs:check       # ドキュメントサイズガード（CLAUDE.md の肥大検知）
```

### Plan / JSON 出力
`--plan --json` で各コマンドを機械可読出力にできる（CI / エージェント向け）。`cf-starter <cmd> --plan --json` または `npm run cli -- <cmd> --plan --json`。対応: `doctor` / `env plan` / `db migrate` / `db seed-demo` / `record generate` / `deploy` / `security-check`。
