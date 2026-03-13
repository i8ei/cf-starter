# ARCHITECTURE

この文書は `cf-starter` の構造を、人間と AI の両方が読みやすい形で固定するためのものです。

## 目的

`cf-starter` は Cloudflare ネイティブな業務アプリを、少人数で安全に立ち上げるための基盤です。

目的は次です。

- 認証、権限、DB、ログ、エラー契約を毎回作り直さない
- AI が既存設計を壊さずに改善を継続できる
- 小規模から中規模の業務ツールを短期間で始められる

## システム概要

主要な流れは次です。

1. React UI
2. Hono RPC client
3. Hono routes on Workers
4. middleware
5. business logic
6. Drizzle ORM
7. D1

補助インフラとして次を持ちます。

- KV
- R2
- Durable Objects
- Queues
- Cron

## Starter Core

- auth
- sessions
- organization context
- RBAC
- CSRF
- request id
- structured logging
- audit log
- error contract
- queue handling
- migration / build / test flow

## Operational CLI

テンプレを安全に使うための運用 CLI を持ちます。主入口は `scripts/cf-starter.mjs` と `bin/cf-starter` です。

- `doctor` — ローカル前提の診断
- `doctor --remote` — remote deploy 前提の追加診断
- `env plan` — `wrangler.jsonc` から Cloudflare 資源と binding の不足を整理
- `db migrate --plan` — D1 migration の apply 前確認
- `db seed-demo --plan` — demo user / org 投入前の確認
- `record generate --plan` — Record Engine 生成差分の確認
- `deploy --plan` — build + Wrangler deploy 前の確認

この CLI は JSON envelope を返すので、AI / CI から機械可読に扱えます。

テンプレ方針として、repo 本体の `wrangler.jsonc` には `database_id` や本番 `APP_BASE_URL` を固定しません。これらはコピー先の実アプリで埋めます。

## Record Engine

レコードを「保存可能なデータ」から「運用可能な仕事単位」に昇格させる共通基盤です。

レコード定義（`shared/records/*.ts`）を書いて `npm run record:generate` を実行すると、バックエンド（Drizzle テーブル + Zod スキーマ + Hono CRUD ルート）とフロントエンド（TanStack Query hooks）が一発生成されます。

Record Engine は3層で構成されます。

1. **定義層** — schema（フィールド定義）、relation（他レコードとの関係）、status（ワークフローの旗）
2. **操作層** — CRUD（規格化された基本動作）、validation（per-field + cross-field）、activity log（変化の物語）
3. **利用層** — list view（status tabs 付き一覧）、form view（sections ベースのフォーム）

生成物はただのコード。ロックインなし。生成後に自由に編集できます。

生成ロジックは `scripts/lib/record-engine.mjs` に純粋関数として分離されており、テストで保護されています。重複生成チェック、安全な挿入点検出、構造的なエラーメッセージを備えます。

型安全の保証:

- `defineRecord` はジェネリクスで `listView.columns` / `formView.sections[*].fields` を `fields` のキーに制約
- 生成コードに `as any` キャストなし
- `organizationId` は `.notNull()` + index 付きで生成

UI/UX 品質:

- アクセシビリティ: 全フィールドで `label`/`input` 紐付け、`focus-visible` リング、`aria-required`、`role="alert"` エラー通知
- DataTable: ソート（`aria-sort`）、キーボード操作（`tabIndex` + `onKeyDown`）、`<th scope="col">`、`<caption>`、空状態アクション誘導
- フォーム: 必須フィールド `*` 表示、送信スピナー、削除確認ダイアログ
- デザイン: StatusBadge セマンティックカラー（意味ベースの色割り当て）、Inter + Noto Sans JP フォント、`tabular-nums`

フロントエンドは wouter による SPA ルーティングで:

- 未ログイン時 → AuthPage をインライン表示（専用 `/login` ルートはない）
- `/` → HomePage（スターター案内 + 現在のユーザー/組織表示）
- `/:record` → 一覧（Record Engine で生成・配線後に有効）
- `/:record/new` → 新規作成（同上）
- `/:record/:id` → 詳細（status 変更ボタン付き、同上）
- `/:record/:id/edit` → 編集（同上）
- `/settings` → 組織設定

汎用ページコンポーネント（`RecordListPage`, `RecordDetailPage`, `RecordFormPage`）とフィールドコンポーネント（`TextField`, `NumberField`, `DateField`, `SelectField`, `RelationField`）を組み合わせて UI を構築します。

### Record Engine を使わない場合

coreからRecord Engineへの直接importはゼロ。CLAUDE.md の「Record Engine を使わない場合」セクションに従ってファイルを削除すれば、coreは壊れない。

## Feature Structure

`cf-starter` は feature-based structure を採用しています。

- core routes: `src/routes/`
- feature routes: `src/features/{key}/routes.ts`（Record Engine で生成）
- core hooks: `app/hooks/`
- feature hooks: `app/features/{key}/hooks/`（Record Engine で生成）
- core schema: `shared/schemas/`
- feature schema: `shared/features/{key}/schema.ts`（Record Engine で生成）
- record definitions: `shared/records/{key}.ts`

新しい業務機能を追加する場合は、Record Engine でレコード定義を書いてコード生成するのが最速です。
業務テーブルは `organization_id` を持たせて current organization で絞るのを基本にします（生成物に自動で含まれます）。

## 認証

現在の認証方式:

- D1 table: `sessions`
- D1 table: `password_reset_tokens`
- D1 table: `email_verification_tokens`
- Cookie: HttpOnly
- Password hash: `PBKDF2-SHA256`

セッション方針:

- login ごとに再発行
- user あたり 1 セッションに寄せる
- logout で削除
- Cron で期限切れを削除
- password reset / email verification token も Cron で清掃する

### 認証を使わない場合

AUTH_ENABLED=false（.dev.varsまたはwrangler.jsonc）で実行時無効化できる。物理削除は不要。

## Organization Context

organization-aware なアプリを前提に、core で次を持ちます。

- `organizations`
- `memberships`
- `sessions.current_org_id`
- `organization_invites`

middleware 後の route では次を参照できます。

- `c.get("userId")`
- `c.get("roles")`
- `c.get("orgId")`
- `c.get("orgRole")`
- `c.get("memberships")`

`requireAuth` は session の `current_org_id` を membership と照合し、必要なら session を補正します。

organization 招待は次の前提で扱います。

- current organization に対して owner / admin が招待を作成する
- 招待 token は DB には hash で保持する
- 承諾は login 済みユーザーのみ
- 招待 email と login 中の user email が一致しない場合は拒否する

## 認可

現在の認可は 2 層です。

- global role: `user_roles`
- organization membership role: `memberships.role`

使い分け:

- platform-level の判定: `requireRole()`
- tenant-level の絞り込み: `orgId` と `orgRole`

## API 契約

すべての API エラーは次の形を返します。

```json
{
  "error": {
    "code": "forbidden",
    "message": "Forbidden",
    "requestId": "..."
  }
}
```

validation error も同じ envelope に入れます。

## ログ

ログは JSON structured log を基本とします。

主に出す項目:

- requestId
- method
- path
- userId
- event

`X-Request-Id` はレスポンスにも載せます。

## 監査ログ

`audit_logs` は重要操作の DB 監査ログです。

含む情報:

- actorUserId
- organizationId
- action
- resourceType
- resourceId
- status
- requestId
- metadata

## Queue

`JOBS` Queue binding を持ち、job を処理します。

- `user.welcome`
- `organization.invite_email`
- `auth.password_reset_email`
- `auth.email_verification_email`

consumer は `src/queues/jobs.ts` と Worker module の `queue()` handler に集約します。

## D1 の既知制約

D1 を使う際に注意すべき制約です。

### パラメータ上限（~100）

D1 は1クエリあたり約100個のバインドパラメータ上限があります。`inArray()` で大量の ID を渡すとクエリが失敗します。`src/lib/d1-batch.ts` の `batchInArray()` を使ってチャンキングしてください。

### トランザクション非対応

D1 は SQL の `BEGIN TRANSACTION` を受け付けません。複数テーブルへのアトミックな書き込みが必要な場合は、1つの `db.batch()` 呼び出しにまとめるか、アプリケーション層で冪等性を担保してください。

### CASCADE DELETE と Drizzle

Drizzle のマイグレーションでテーブルを再作成する際、`PRAGMA foreign_keys` が期待通りに動かないケースがあります。CASCADE DELETE に依存する設計は避け、アプリケーション層で関連レコードの削除を制御してください。

## 現在の不足

現時点で未実装、または弱いものです。Record Engine vNext として優先順に整理しています。

**Tier 1: 複雑な業務レコードに耐える**

- Input / Persist 分離 — 入力モデルと保存モデルの分離（`input`, `persist`, `transform`）
- Relation 強化 — 候補取得 query、dependent relation、表示ラベル、badge 表示
- Domain Hooks — ライフサイクルフック（`beforeCreate`, `afterStatusChange` 等）

**Tier 2: 生成器から運用基盤へ**

- Activity Log 統合 — 差分サマリ、detail 画面の履歴表示、コメント追加
- View Presets — フィルタ+ソート+列の「見方」定義、preset 切替 UI
- Record Actions — CRUD 以外の業務操作（完了、複製、CSV 出力等）

**Tier 3: 使い勝手を上げる**

- Computed Fields — 保存値や relation からの導出値

## Security Invariants

AI や開発者は、次を壊さないでください。

- password hash を平文や弱いハッシュへ戻さない
- CSRF 保護を削らない
- request id を外さない
- error contract を route ごとにバラバラにしない
- organization context を無視して multi-tenant data を読む route を増やさない
- 監査対象の操作から audit log を外さない
