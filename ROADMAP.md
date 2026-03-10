# ROADMAP

`cf-starter` を、Cloudflare 上で業務アプリを量産するための基盤として育てるための roadmap です。

## Phase 1: Security Baseline

目的:

- 公開してもすぐ危険にならない最小線を作る

状態:

- 完了

含まれるもの:

- PBKDF2 password hashing
- session cookies
- CSRF protection
- request id
- structured logs
- unified error contract
- rate limit
- audit log

## Phase 2: Starter Core Stability

目的:

- バックとフロントの契約を壊れにくくする
- build / test / deploy の基本線を固定する

状態:

- 進行中

完了済み:

- Hono RPC client
- Vite build
- Vitest
- Queue sample jobs
- Cron session cleanup
- optional module install plan

残り:

- README / architecture docs の継続改善
- app generation path の整備

## Phase 3: Organization-Aware Core

目的:

- user 単体ではなく `organization の中の user` を扱えるようにする

状態:

- 進行中

完了済み:

- `organizations`
- `memberships`
- `sessions.current_org_id`
- personal workspace 作成
- `/api/orgs`
- `/api/auth/switch-org`
- auth context への `orgId` / `orgRole` / `memberships` 追加
- invite lifecycle
- feature-based structure の整理（example は `src/features/example/` に分離、core は横断基盤として `src/routes/` + `src/lib/` に維持）
- auth routes のサブモジュール分割（`src/routes/auth/`）
- crypto ユーティリティの集約（`src/lib/crypto.ts`）

次:

- reference features の拡張
- app generation path の整備

## Phase 4: Record Engine

目的:

- レコードを"保存可能なデータ"から"運用可能な仕事単位"に昇格させる共通基盤
- DB の能力を人間の仕事単位に翻訳する脚部フレーム

状態:

- v0.1 完了

完了済み:

- `shared/lib/record-def.ts` — defineRecord 型定義
- `scripts/generate-record.mjs` — レコード定義 → バックエンド＋フロントエンド一発生成
- 生成物: Drizzle テーブル / Zod スキーマ / Hono CRUD+status ルート / TanStack Query hooks
- 汎用 UI: RecordListPage, RecordDetailPage, RecordFormPage
- フィールドコンポーネント: TextField, NumberField, DateField, SelectField, RelationField
- StatusBadge, StatusFilterTabs, DataTable
- wouter ルーティング導入
- App.tsx 分解: AppShell + AuthPage + SettingsPage
- audit log 統合（CRUD + status 変更）

次 (vNext):

**Tier 1: 複雑な業務レコードに耐える**

1. Input / Persist 分離 — `input`, `persist`, `transform` で入力モデルと保存モデルを分離
2. Relation 強化 — 候補取得 query、dependent relation、表示ラベル、badge 表示
3. Domain Hooks — `beforeCreate`, `afterStatusChange` 等のライフサイクルフック

**Tier 2: 生成器から運用基盤へ**

4. Activity Log 統合 — 差分サマリ、detail 画面の履歴表示、コメント追加
5. View Presets — フィルタ+ソート+列の「見方」定義、preset 切替 UI
6. Record Actions — CRUD 以外の業務操作（完了、複製、CSV 出力等）

**Tier 3: 使い勝手を上げる**

7. Computed Fields — 保存値や relation からの導出値

検証: 実案件で Tier 1 から順に適用し、フィードバックで Engine を磨く

## Phase 5: App Factory Readiness

目的:

- AI が新しいアプリを迷わず切れる状態にする

前提:

- README が starter として正しい
- architecture が固定されている
- roadmap が現在地を示している
- core と example の境界が明確

未着手:

- APP_FACTORY.md
- generation playbook
- install / bootstrap scripts の強化

直近で追加済み:

- `npm run app:plan`
- `npm run app:plan:core`
- `npm run app:plan:json`
- `npm run modules:plan:json`
- `npm run app:scaffold`
