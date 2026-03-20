# cf-starter 憲法

cf-starter の設計判断の基準。機能追加・削除・変更の際にこのドキュメントを参照する。

## 使命

**`cp` して即開発できる Cloudflare フルスタックの金型。**
自治体・業務アプリを1人（+AI）で量産するための基盤。

## 不変条件

破ってはならない原則。これに反する変更は reject する。

1. **Cloudflare 完結** — 外部 BaaS（Supabase 等）に依存しない。D1 + R2 + KV + Queues で閉じる
2. **型安全チェーンの貫通** — Zod → @hono/zod-validator → Drizzle → AppType → hc\<AppType\> → TanStack Query。どこかが切れたら壊れている
3. **cp して動く** — `cp -r cf-starter my-app && cd my-app && npm install && npm run init && npm run dev` で動くこと
4. **AUTH_MODE 3モード維持** — none / simple-admin / better-auth。後方互換を壊さない
5. **core-only でも動く** — Record Engine を全削除しても core は壊れない
6. **1プロジェクト統合ビルド** — `vite build` 一発で Worker + SPA が出る

## core に入れるもの

テンプレートのすべてのユーザーが恩恵を受けるもの。

| 領域 | 具体例 |
|------|--------|
| 型安全チェーン | Zod, @hono/zod-validator, Drizzle, Hono, TanStack Query |
| 認証・認可 | Better Auth (per-request factory), AUTH_MODE 切替, seed:demo |
| セキュリティ | CSRF, rate-limit, request-id, CORS バリデーション |
| DB 基盤 | Drizzle スキーマ, D1 マイグレーション, d1-batch |
| UI 基盤 | AppShell, PublicShell, セマンティックトークン |
| 開発 DX | init-copy.mjs, doctor, oxlint, ci:local, setup:remote |
| ビルド | @cloudflare/vite-plugin 統合 |

## addon（削除可能）

使うアプリと使わないアプリがあるもの。削除しても core が壊れないことを保証する。

| addon | 削除ガイド |
|-------|-----------|
| Record Engine | CLAUDE.md「Record Engine を使わない場合」参照 |
| Recharts チャート群 | `app/components/charts/` を削除 |
| Queues / Cron / DurableObjects | wrangler.jsonc のコメントアウトで無効化 |
| FileField（R2 アップロード） | 未実装。定義のみ削除 |

**addon の条件**: core からの直接 import がゼロであること。

## 入れないもの

金型の軽さを濁らせるもの。必要なアプリで個別に実装する。

| 対象 | 理由 |
|------|------|
| AI SDK の core 固定 | プロバイダー・コストがアプリごとに違う。早すぎる抽象化 |
| Analytics 標準搭載 | プライバシー制約がアプリごとに違う |
| TanStack Start / Router 移行 | 今の wouter の軽さが武器。移行は需要が出てから |
| Bun 前提化 | Cloudflare Workers は Node 互換。Bun 依存は制約になる |
| PostHog / GA4 標準搭載 | addon 以前に、需要の繰り返しがまだない |
| examples/ ディレクトリ | 過去に削除済み（-16,291行）。既存の独立リポが生きたサンプル |
| ESLint | OxLint で十分。ESLint は設定が重い |

## 設計パターン（推奨）

アプリ固有コードで繰り返し使われるパターン。core には入れないが、知識として共有する。

| パターン | いつ使うか |
|----------|-----------|
| Wide table > EAV | ドメインが安定しているとき（テーブル設計の原則） |
| アダプタパターン | 外部 API 統合時（SourceAdapter interface + 辞書登録） |
| seed-app.sql | アプリ固有の初期データ投入（べき等に書く） |
| 外部 SQLite → D1 移行 | 既存データの取り込み（Python export → SQL → wrangler d1 execute） |

## 品質ライン

commit 前に `npm run ci:local` が通ること。これが金型の合格ライン。

```bash
npm run ci:local   # lint + typecheck + test + unused + build
```

E2E テスト（Playwright）は別コマンド `npm run test:e2e`。ブラウザDLが任意のため ci:local には含めない。

## 改訂ルール

- この文書は実戦フィードバック（v1〜v4 の実績）に基づいて書かれている
- 新しいアプリを量産するたびに、フィードバックを反映して更新する
- 「入れないもの」に分類したものも、需要が3回繰り返されたら再検討する
