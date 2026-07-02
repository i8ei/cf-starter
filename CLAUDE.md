# cf-starter

Cloudflare フルスタック スターターテンプレート。`cp` して使うことを前提に設計。
設計判断の基準は [CONSTITUTION.md](./CONSTITUTION.md) を参照。

## このファイルの編集ポリシー

このファイルは全 AI セッションで毎回フルロードされる。肥大はトークンコストに直結する。
- **毎回効く知見だけ残す**。特定タスクでしか要らない詳細は `docs/` へ。
- **済んだ経緯は CHANGELOG.md へ**。ここは「今どうなっているか」だけ。
- 目安 250 行以内。`npm run docs:check` で超過を検知。

## タスク別に先に読むドキュメント

編集を始める前に、該当タスクなら対応する `docs/` を読むこと（本体には要点のみ）。
- **レコード定義 / 生成された CRUD・フォーム・hooks・ルートを触る** → `docs/record-engine.md`
- **認証・ルーティング・公開ページ・セッション・DB スキーマ** → `docs/auth.md`, `docs/frontend.md`
- **チャート・ダッシュボード UI・フォーマッター** → `docs/ui-kit.md`
- **ログ・health・デプロイ診断・オプションバインディング・全コマンド** → `docs/runbook.md`
- **外部データ移行・階層表示などの実装パターン** → `docs/patterns.md`
- 詳細アーキテクチャの通し説明 → [ARCHITECTURE.md](./ARCHITECTURE.md)

## スタック

- **Frontend**: React + TypeScript + Tailwind CSS v4 + TanStack Query + Recharts
- **Backend**: Hono on Cloudflare Workers
- **DB**: D1 + Drizzle ORM（型安全、マイグレーション自動生成）
- **Storage**: R2（オブジェクト）/ KV（キーバリュー、オプション）
- **Validation**: Zod + @hono/zod-validator（フロント・バック共有）
- **統合**: @cloudflare/vite-plugin（1プロジェクト統合ビルド）

## ディレクトリ構成（トップレベル）

```
app/       ← React フロントエンド（components/ pages/ hooks/ lib/ App.tsx）
shared/    ← フロント・バック共有（schemas/ records/ lib/record-def.ts）
src/       ← Hono バックエンド（db/ lib/ middleware/ routes/ queues/ types.ts index.ts）
scripts/   ← CLI・ジェネレーター（lib/ 配下は契約テストで保護）
test/      ← Vitest / migrations/ ← D1 マイグレーション / docs/ ← 詳細ドキュメント
```

- パスエイリアス: `~/` → app, `@server/` → src, `@shared/` → shared
- `app/features/`, `src/features/`, `shared/features/` は Record Engine 生成後にのみ存在
- 各ファイルの詳細はコードが正。ツリー全体は追わない。

## ルーティング / 認証の不変条件

**壊しやすいので必ず守る**（詳細は `docs/frontend.md`, `docs/auth.md`）:
- `/p/*` は AuthGuard の**外**（認証不要ページ）。API は `/api/public/*` に GET-only で登録
- `useHealth()` は常に呼ばれ `authMode` を判定。`useSession()` は `authMode≠none` のときだけ
- 専用 `/login` ルートは**ない**。未ログイン時は AuthPage をインライン表示
- `AUTH_MODE=none` / `simple-admin` は userId="1", orgId="default-org" 固定 → **`seed:demo` 必須**
- better-auth モードで組織未所属なら `OrgGate` が組織作成画面を出す（レンダリング中の直接 `mutate` 禁止＝無限ループ）
- **per-request auth instance**（`createAuth(env)`）。シングルトン厳禁（D1 stale reference で30秒+ハング）

`AUTH_MODE` は `none`（公開）/ `simple-admin`（ADMIN_PASSWORD）/ `better-auth`（DB session、デフォルト）。
後方互換: `AUTH_ENABLED=false` = `AUTH_MODE=none`。各モードの設定は `docs/auth.md`。

## Record Engine（レコード駆動開発）

レコード定義を書いて生成すると、バックエンド（Drizzle+Zod+Hono）とフロント（TanStack Query hooks）が一発生成される。**生成コードを触るなら先に `docs/record-engine.md` を読む。**

手順:
1. `shared/records/xxx.ts` に `defineRecord()` で定義
2. `npm run record:generate -- --record shared/records/xxx.ts`
3. `npm run db:generate && npm run db:migrate`
4. `app/App.tsx` の `recordNavItems` にナビ・ルート追加
5. `npm run dev` で確認

**footgun（繰り返しバグの原因。必ず守る）:**
- **数値フィールドは `z.coerce.number()`**。フォーム入力は文字列で来るため `z.number()` はエラー
- **リストフックは `use{Key}List`**（旧 `use{Key}s` は s 終わりキーで二重 s になるバグ）
- **日付フィールド**は `YYYY-MM-DD` 形式＋実在日付（うるう年含む）を検証
- **`sensitive: true` / `audit: false`** のフィールドは audit metadata から除外される
- **FileField は UI 未実装**（型・Zod は存在、フォームはプレースホルダー表示。R2 連携は将来課題）
- **RelationField** は Form/Detail が関連レコードを自動フェッチ。`relatedLabel` が表示ラベル
- **ハイフン入りキー可**（`"my-record"`）。生成コードはキャメルケースに変換
- **`softDelete: true`** で `deletedAt` 追加＋LIST/GET に `isNull` フィルタ＋DELETE がソフト化

## デザインシステム（トークン規則）

**通常のフロント編集全部に効くので本体に残す**（部品詳細は `docs/ui-kit.md`）:
- 生の Tailwind カラー（`text-gray-900` 等）ではなく**セマンティックトークン**を使う（`bg-surface` / `text-heading` / `text-muted` / `border-border` / `bg-accent` / `ring-ring` 等）
- トークンは `index.css` の `:root` CSS変数 → `@theme` で Tailwind 登録。`bg-accent` を使うなら `--accent` が**両方に登録**されているか確認
- border-radius: input `rounded-lg`、button/panel `rounded-xl`。フォーカスは `focus-visible:ring-2`
- **input は `text-base`（16px）以上**（`text-sm` だと iOS が自動ズーム）
- UI 文字列は**日本語で統一**（`index.html` が `lang="ja"`）

## 型安全チェーン

```
Zod スキーマ → @hono/zod-validator → Drizzle → export type AppType
  → hc<AppType> + InferResponseType → TanStack Query（フロント）
```

バックからフロントまで型が貫通する。Record Engine 生成 hooks は Hono ルートの成功レスポンス型を推論するので、レスポンス型を手書きしない。

## D1 パラメータ制限

D1 は1クエリ ~100パラメータ上限。`inArray()` で大量 ID を渡す場合は `src/lib/d1-batch.ts` の `batchInArray()` を使う。

## よく使うコマンド（全一覧は `docs/runbook.md`）

```bash
npm run dev            # ローカル開発（認証フリッカー時は dev:split）
npm run ci:local       # lint + typecheck + test + unused + build 一括
npm run record:generate -- --record shared/records/xxx.ts
npm run db:generate && npm run db:migrate
npm run seed:demo      # デモユーザー・組織（default-org）投入
npm run setup:remote   # リモート migrate + seed + secrets 確認
npm run deploy         # security-check → build → deploy
```

## 編集ガイド（AI向け）

**自由に編集**: `app/pages/`, `app/components/`, `app/lib/format.ts`, `src/routes/`, `src/db/schema.ts`（scaffold markers 間）, `shared/schemas/`, `shared/records/`, `app/App.tsx`（nav/route）, `seed-app.sql`, `wrangler.jsonc` の `vars`

**慎重に**（動作を理解してから）: `src/middleware/`（CSRF/auth/rate-limit）, `src/lib/better-auth.ts`（per-request 必須）, `src/lib/session.ts`, `src/lib/crypto.ts`, `src/index.ts`（ルート登録順＝middleware 適用順）, `app/index.css` の `:root`（トークン追加可・既存削除不可）

**触らない**: `src/lib/config.ts`（CORS/Cookie バリデーション、Zod で保護）, `scripts/lib/`（CLI 内部、契約テストで保護）, `test/`（既存テスト削除禁止）

## 規約

- API は `/api/` 以下、Hono ルーターで管理
- Env バインディングの型は `src/types.ts` に集約
- DB スキーマは `src/db/schema.ts` に定義（Drizzle）
- フロントの API 呼び出しは `hc<AppType>` + TanStack Query
- バリデーションは Zod で定義し `shared/schemas/` に置く（フロント・バック共有）

## 実戦で判明した注意点

派生アプリ（tara-grant-scout / volunteer-taxi / tara-shisetsu / tara-ocean / taradake-ai）で判明し、テンプレに反映済みの知見。上の footgun / 不変条件と重複するものは省略。

- **seed-demo.mjs**: `better-auth/crypto` の `hashPassword()` を直接使用。カスタム scrypt は廃止（形式不一致バグの根本原因だった）
- **CSRF と非ブラウザクライアント**: 全ミューテーション（POST/PUT/PATCH/DELETE）で Origin/Referer 検証が必須。curl や外部スクリプトから `/api/*` に POST するなら `Origin: <CORS_ORIGIN に含まれる origin>` ヘッダを付けないと 403
- **AppShell モバイル**: ヘッダーは2段化済み（ナビが溢れないように）

## セキュリティ必須（派生アプリで守る）

- **サーバー側で認可を強制**: フロントだけで権限判定しない。保護 API に `requireAuth`、管理者 API に `requireRole("admin")`、組織操作に `requireOrgRole()`。取得・更新・削除で `organizationId` スコープ必須（Record Engine 生成ルートは自動適用済み）
- **課金・プラン判定はサーバー側**: `plan === "pro"` をフロント/localStorage/state だけで解放しない。DB/Webhook で検証
- **入力は信用しない**: 全エンドポイントで Zod 検証（`validator("json", schema)`）。本文の `userId`/`role`/`plan` やクエリ `?admin=true` を信用しない。権限はセッション/ミドルウェアから取得
- **秘密情報を漏らさない**: レスポンスにパスワードハッシュ・トークン・内部 ID・billing metadata を含めない。本番で stack trace/SQL/env を返さない（`onError` は `"Internal Server Error"` のみ）。`select *` を避ける。エクスポートは権限チェック付き
- **シークレット管理**: `BETTER_AUTH_SECRET` / `ADMIN_PASSWORD` は `npx wrangler secret put` で設定。`wrangler.jsonc` の `vars` に書くと平文コミットになり security-check がブロックする（存在確認は `wrangler secret list`）
- 型安全な権限チェックの書き方は `docs/auth.md`

## 変更時のチェックリスト（commit 前）

- [ ] 影響を受ける他ファイルに波及漏れがないか（grep で確認）
- [ ] 不要になった関数・export・import が残っていないか
- [ ] CLAUDE.md / `docs/` / ARCHITECTURE.md の記述と矛盾しないか（矛盾はコードと一緒に直す）
- [ ] デザインシステム規則（input `rounded-lg` / button・panel `rounded-xl` / `focus-visible:ring-2` / セマンティックトークン / `text-base`）に違反していないか
- [ ] CLAUDE.md を肥大させていないか（詳細は `docs/` へ、経緯は CHANGELOG へ）
- [ ] `npm run ci:local` が通るか
