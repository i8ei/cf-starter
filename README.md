# cf-starter

Cloudflare Workers 上で業務アプリを最短で立ち上げるための starter テンプレートです。

認証・セッション・権限・DB・監査ログ・テスト・CLI・コード生成を最初から備えており、`cp` してすぐ開発を始められます。維持コストはほぼゼロ。Cloudflare の無償枠だけで本番運用できます。

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

---

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| Frontend | React + TypeScript + Tailwind CSS v4 + TanStack Query + Recharts + wouter |
| Backend | Hono on Cloudflare Workers |
| Database | D1 (SQLite) + Drizzle ORM |
| Storage | R2 (optional) / KV (optional) |
| Rate limit | Durable Objects |
| Async jobs | Cloudflare Queues |
| Validation | Zod（フロント・バック共有） |
| Build | Vite + @cloudflare/vite-plugin |
| Testing | Vitest |

型安全チェーン：

```
Zod スキーマ → @hono/zod-validator → Drizzle ORM → AppType → hc<AppType> → TanStack Query
```

バックエンドからフロントエンドまで型が貫通します。

---

## 特徴

### セキュリティ基盤

- D1 session + HttpOnly Cookie 認証
- PBKDF2-SHA256 パスワードハッシュ
- CSRF 保護
- Durable Object ベースのレート制限
- request id + 構造化 JSON ログ
- 監査ログ
- 統一 API エラー形式

### 組織管理

- organization / membership / current organization context
- 招待・承諾フロー
- パスワードリセット / メール認証

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

- Recharts ラッパー 5 種（横棒・増減棒・折れ線・積み上げ棒・円/ドーナツ）
- KPI カード・セクション見出し・グラフ/テーブル切替
- PublicShell（モバイルファースト 1 カラムレイアウト）
- `AUTH_ENABLED=false` で認証を無効化、PublicShell に自動切替

### 2 つのレイアウト

| レイアウト | 用途 |
|------------|------|
| AppShell | 認証ありの業務アプリ |
| PublicShell | 認証なしの公開アプリ・ダッシュボード |

`AUTH_ENABLED` の値で自動切替されます。

---

## コマンド一覧

| コマンド | 内容 |
|----------|------|
| `npm run dev` | 統合開発モード |
| `npm run dev:split` | Vite + Wrangler 分離起動（認証フリッカー回避） |
| `npm run build` | ビルド |
| `npm run deploy` | Cloudflare にデプロイ |
| `npm run init` | 新プロジェクト初期化 |
| `npm run setup:remote` | リモート DB 準備 |
| `npm run doctor` | 設定診断 |
| `npm run doctor -- --remote` | デプロイ前診断 |
| `npm test` | テスト実行 |
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
│   ├── lib/                auth, session, audit, orgs
│   ├── middleware/          auth, csrf, rate-limit, request-id
│   ├── queues/             Queue consumer
│   ├── routes/             core API ルート
│   └── index.ts            Worker エントリーポイント
├── scripts/                CLI・初期化・コード生成
├── migrations/             D1 マイグレーション
├── test/                   Vitest テスト
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

## 本番チェックリスト

`npm run init` + `npm run setup:remote` で大部分は自動化されます。残りの確認事項：

- [ ] KV / R2 / Queue が必要なら作成し `wrangler.jsonc` に設定
- [ ] `COOKIE_SAME_SITE` / `COOKIE_SECURE` を運用に合わせる
- [ ] `npm run doctor -- --remote` でデプロイ前チェック

---

## ドキュメント

| ファイル | 内容 |
|----------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 設計の詳細（認証・組織・Record Engine・セキュリティ不変条件） |
| [ROADMAP.md](./ROADMAP.md) | 開発履歴と今後の計画 |
| [CLI_DESIGN.md](./CLI_DESIGN.md) | CLI の設計と運用 |

---

## ライセンス

MIT
