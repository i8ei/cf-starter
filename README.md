# cf-starter

<p align="center">
  <img src="docs/hero.webp" alt="cf-starter — Edge Platform Framework" width="800" />
</p>

Cloudflare Workers 上で業務アプリを最短で立ち上げるための starter テンプレートです。

認証・セッション・権限・DB・監査ログ・テスト・CLI・コード生成を最初から備えており、`cp` してすぐ開発を始められます。維持コストはほぼゼロ。Cloudflare の無償枠だけで本番運用できます。

## 前提条件

- Node.js 20.19 以上
- Wrangler（`npm install -g wrangler`）
- Cloudflare アカウント（無料枠で可）
- `wrangler login` でログイン済み

## クイックスタート

```bash
cp -r cf-starter my-app
cd my-app
npm install
npm run init
npm run dev
```

`npm run init` が自動で行うこと：

- `cf-starter` → アプリ名への参照置換
- D1 データベース作成・`wrangler.jsonc` への ID 書き込み
- `CORS_ORIGIN` / `APP_BASE_URL` の設定
- `.dev.vars` にローカル用オーバーライド生成
- マイグレーション整理 → `db:generate` → `db:migrate` → `seed:demo`

### デプロイ

```bash
npm run setup:remote
npm run deploy
```

`npm run setup:remote` はリモート D1 へのマイグレーション適用、デモデータ投入、シークレット確認を一括で行います。

注意:
生成後アプリを remote に出す前に、そのアプリ固有の `APP_BASE_URL` と `CORS_ORIGIN` を本番 URL に設定してください。`localhost` のままでは `npm run doctor -- --remote` / `npm run setup:remote` / `npm run deploy` が失敗します。

---

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| Auth | Better Auth (admin + organization plugins) |
| Frontend | React + TypeScript + Tailwind CSS v4 + TanStack Query + Recharts + wouter |
| Backend | Hono on Cloudflare Workers |
| Database | D1 (SQLite) + Drizzle ORM |
| Storage | R2 (optional) / KV (optional) |
| Rate limit | Durable Objects |
| Async jobs | Cloudflare Queues |
| Validation | Zod（フロント・バック共有） |
| Build | Vite + @cloudflare/vite-plugin |
| Testing | Vitest + Playwright (E2E) |
| Lint | OxLint + knip (unused code) |

型安全チェーン：

```
Zod スキーマ → @hono/zod-validator → Drizzle ORM → AppType → hc<AppType> → TanStack Query
```

バックエンドからフロントエンドまで型が貫通します。

---

## 特徴

### 認証（Better Auth）

3つのモードを `AUTH_MODE` 環境変数で切替：

| モード | 用途 |
|--------|------|
| `none` | 認証なしの公開アプリ |
| `simple-admin` | パスワード1つで管理画面にログイン |
| `better-auth` | フルユーザー管理（signup/signin/roles/org） |

- [Better Auth](https://better-auth.com/) — DB session + HttpOnly Cookie
- admin プラグイン（ロール管理・BAN）
- organization プラグイン（組織・メンバー・招待）
- 招待メールは `/invite?id=...` のリンクを生成し、受信者がそのまま承認可能
- CSRF 保護（Origin/Referer 検証、全 POST/PUT/PATCH/DELETE に自動適用）
- Durable Object レート制限（認証エンドポイントに適用済み）
- 監査ログ（認可失敗・重要操作を D1 に記録）
- request id + 構造化 JSON ログ / 統一 API エラー形式
- デプロイ前セキュリティチェック（`npm run security-check` / `npm run deploy` で自動実行）

### Record Engine（コード生成）

レコード定義を書いてコマンドを叩くと、バックエンドとフロントエンドのコードが一発生成されます。生成後はただのコード。自由に編集できます。

```bash
# 1. レコード定義を書く
# 2. コード生成
npm run record:generate -- --record shared/records/requests.ts
# 3. DB 反映
npm run db:generate && npm run db:migrate
```

生成されるもの：

| ファイル | 内容 |
|----------|------|
| `src/db/schema.ts` に追記 | Drizzle テーブル定義 |
| `shared/features/{key}/schema.ts` | Zod スキーマ |
| `src/features/{key}/routes.ts` | CRUD + ステータス変更 API |
| `app/features/{key}/hooks/use{Key}.ts` | TanStack Query hooks |
| `src/index.ts` に追記 | ルート登録 |

レコード定義の例：

```typescript
// shared/records/requests.ts
import { defineRecord } from "../lib/record-def";

export const requestRecord = defineRecord({
  key: "request",
  label: "配車依頼",
  tableName: "requests",
  fields: {
    passengerName: { type: "text", label: "利用者名", required: true },
    pickupDate:    { type: "date", label: "乗車日", required: true },
    passengers:    { type: "number", label: "人数", min: 1, max: 10 },
    vehicleType:   { type: "select", label: "車種", options: ["sedan", "van"] },
    notes:         { type: "text", label: "備考", multiline: true },
  },
  status: {
    field: "status",
    label: "ステータス",
    options: ["受付", "配車済", "完了", "取消"],
    defaultValue: "受付",
  },
  listView: {
    columns: ["passengerName", "pickupDate", "vehicleType", "status"],
    defaultSort: { field: "pickupDate", direction: "desc" },
  },
  formView: {
    sections: [
      { label: "利用者情報", fields: ["passengerName", "passengers"] },
      { label: "行程", fields: ["pickupDate", "vehicleType"] },
      { label: "備考", fields: ["notes"] },
    ],
  },
});
```

Record Engine は不要なら削除できます。core への依存はゼロです。

### ダッシュボード UI キット

認証不要の公開アプリ（ダッシュボード等）もすぐ作れます。

- Recharts ラッパー 5 種（横棒・増減棒・折れ線・積み上げ棒・円/ドーナツ）— CSS変数でチャート色を一元管理
- KPI カード（`variant` でセマンティックカラー指定）・セクション見出し・グラフ/テーブル切替
- 数値フォーマッター（`fmtNumber`, `fmtCurrency`, `fmtDiff`, `fmtPercent`）
- PublicShell（モバイルファースト 1 カラムレイアウト）
- `AUTH_MODE=none` で認証を無効化、PublicShell に自動切替

### 2 つのレイアウト

| レイアウト | 用途 |
|------------|------|
| AppShell | 認証ありの業務アプリ |
| PublicShell | 認証なしの公開アプリ・ダッシュボード |

`AUTH_MODE` の値で自動切替されます。

---

## コマンド一覧

| コマンド | 内容 |
|----------|------|
| `npm run dev` | 統合開発モード |
| `npm run dev:split` | Vite + Wrangler 分離起動（認証フリッカー回避） |
| `npm run build` | ビルド |
| `npm run deploy` | セキュリティチェック → ビルド → Cloudflare にデプロイ |
| `npm run security-check` | デプロイ前セキュリティ監査（deploy 時に自動実行） |
| `npm run init` | 新プロジェクト初期化 |
| `npm run setup:remote` | リモート DB 準備 |
| `npm run doctor` | 設定診断 |
| `npm run doctor -- --remote` | デプロイ前診断（`APP_BASE_URL` / `CORS_ORIGIN` の本番設定も検証） |
| `npm run lint` | OxLint（React + TypeScript ルール） |
| `npm run unused` | knip（未使用コード・依存検出） |
| `npm test` | Vitest ユニットテスト |
| `npm run test:e2e` | Playwright E2E（要: `npx playwright install chromium`） |
| `npm run ci:local` | 品質チェック一括（lint → typecheck → test → unused → build） |
| `npm run db:generate` | マイグレーション生成 |
| `npm run db:migrate` | ローカル DB にマイグレーション適用 |
| `npm run db:migrate:remote` | リモート DB にマイグレーション適用 |
| `npm run seed:demo` | デモデータ投入 |
| `npm run record:generate -- --record shared/records/xxx.ts` | Record Engine コード生成 |

CLI は `--plan --json` オプションで機械可読な出力にも対応しています。

---

## ディレクトリ構成

```
cf-starter/
├── app/                    React フロントエンド
│   ├── components/         UI コンポーネント
│   │   ├── charts/         Recharts ラッパー（5種）
│   │   ├── fields/         フォーム用フィールド
│   │   ├── AppShell.tsx    認証あり用レイアウト
│   │   └── PublicShell.tsx 公開アプリ用レイアウト
│   ├── features/           feature hooks（Record Engine 生成物）
│   ├── hooks/              core hooks
│   ├── lib/                API client, フォーマット
│   ├── pages/              ページコンポーネント
│   └── App.tsx             ルーティング
├── shared/                 フロント・バック共有
│   ├── features/           feature schemas（生成物）
│   ├── lib/record-def.ts   Record Engine 型定義
│   ├── records/            レコード定義
│   └── schemas/            core Zod スキーマ
├── src/                    Hono バックエンド (Worker)
│   ├── db/                 Drizzle スキーマ
│   ├── features/           feature routes（生成物）
│   ├── lib/                better-auth, session, audit, crypto
│   ├── middleware/          auth, csrf, rate-limit, request-id
│   ├── queues/             Queue consumer
│   ├── routes/             core API ルート
│   └── index.ts            Worker エントリーポイント
├── scripts/                CLI・初期化・コード生成
├── migrations/             D1 マイグレーション
├── test/                   Vitest ユニットテスト
├── e2e/                    Playwright E2E テスト
├── CONSTITUTION.md         設計判断の基準（憲法）
├── ARCHITECTURE.md         設計の詳細
└── ROADMAP.md              開発履歴と今後
```

---

## 向いている用途

- 地域向け業務ツール
- 予約・台帳・在庫・配車・マッチング
- ダッシュボード・データ可視化
- 会員制サービス
- 1 人〜少人数で運用する Cloudflare ネイティブな Web アプリ

## 向いていない用途

- 超大規模マルチテナント SaaS
- 複雑な BPM / ワークフローエンジン
- エンタープライズ権限制御
- メール配信・課金・全文検索をフル装備したプラットフォーム

必要な機能は追加できますが、狙いは **「業務アプリを速く・安全に・量産できること」** です。

---

## セキュリティ

cf-starter はテンプレートの時点でセキュリティの基盤を組み込んでいます。コピーして作ったアプリは、初期状態から以下の防御が有効です。

### 組み込み済みの防御

| 層 | 仕組み |
|----|--------|
| 認証 | Better Auth / HMAC セッション。HttpOnly + Secure + SameSite Cookie。`__Host-` プレフィックス |
| 認可 | `requireAuth` → `requireRole` → `requireOrgRole` のミドルウェアチェーン。型安全（タイポはコンパイルエラー） |
| CSRF | Origin/Referer 検証。POST/PUT/PATCH/DELETE に自動適用。認証ミドルウェアより前に実行 |
| CORS | 許可リストベース（ワイルドカード不可）。Zod でオリジン形式を検証 |
| レート制限 | Durable Object による IP ベース制限。認証エンドポイントに適用済み |
| 入力検証 | Zod + @hono/zod-validator。フロント・バック共有スキーマ |
| エラー制御 | 本番では `"Internal Server Error"` のみ返却。詳細はサーバーログに記録 |
| 監査 | 認可失敗・重要操作を D1 に記録。request id で追跡可能 |
| データ分離 | Record Engine 生成ルートは全クエリが `organizationId` スコープ |

### デプロイ前チェック

`npm run deploy` 実行時にセキュリティチェックが自動で走ります。ブロック項目があるとデプロイは中止されます。

```bash
# 手動で実行する場合
npm run security-check
```

チェック項目:

- シークレット（`ADMIN_PASSWORD`, `BETTER_AUTH_SECRET`）が設定済みか
- `CORS_ORIGIN` がワイルドカードでないか
- `AUTH_MODE` が意図した値か
- デモ/サンプルファイルが残っていないか
- D1 データベースが設定済みか
- レート制限用 Durable Object が設定されているか

### 派生アプリで守るべきこと

テンプレートが提供する基盤の上で、アプリ固有のセキュリティは開発者が担保します。

- **権限判定をフロントだけで行わない** — UI でボタンを隠してもAPIを直叩きされたら意味がない
- **課金・プラン判定はサーバー側で行う** — localStorage や state だけで有料機能を解放しない
- **APIレスポンスに不要な情報を含めない** — `select *` を避け、必要なカラムだけ返す
- **エクスポート機能には権限チェックをつける** — 全件ダウンロードは管理者のみに制限

---

## 本番チェックリスト

`npm run init` + `npm run setup:remote` で大部分は自動化されます。残りの確認事項：

- [ ] `npm run security-check` が通ることを確認
- [ ] `npm run ci:local` が通ることを確認
- [ ] `vars.APP_BASE_URL` をそのアプリの本番 HTTPS URL にする
- [ ] `vars.CORS_ORIGIN` に上記本番 URL を含める
- [ ] KV / R2 / Queue が必要なら作成し `wrangler.jsonc` に設定
- [ ] `COOKIE_SAME_SITE` / `COOKIE_SECURE` を運用に合わせる
- [ ] `npm run doctor -- --remote` でデプロイ前チェック

例:

```jsonc
{
  "vars": {
    "CORS_ORIGIN": "http://localhost:5173, https://my-app.ichevi.workers.dev",
    "APP_BASE_URL": "https://my-app.ichevi.workers.dev"
  }
}
```

---

## ドキュメント

| ファイル | 内容 |
|----------|------|
| [CONSTITUTION.md](./CONSTITUTION.md) | 設計判断の基準（何を入れ、何を入れないか） |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 設計の詳細（認証・組織・Record Engine・セキュリティ不変条件） |
| [ROADMAP.md](./ROADMAP.md) | 開発履歴と今後の計画 |
| [CLI_DESIGN.md](./CLI_DESIGN.md) | CLI の設計と運用 |
| CLAUDE.md | AI 向けガイド（セキュリティルール含む） |

---

## ライセンス

MIT
