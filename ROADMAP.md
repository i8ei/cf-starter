# ROADMAP

`cf-starter` を、Cloudflare 上で業務アプリを量産するための基盤として育てるための roadmap です。

## Phase 1: Security Baseline — 完了

- PBKDF2 password hashing
- session cookies
- CSRF protection
- request id
- structured logs
- unified error contract
- rate limit
- audit log

## Phase 2: Starter Core Stability — 完了

- Hono RPC client
- Vite build
- Vitest
- Queue sample jobs
- Cron session cleanup

## Phase 3: Organization-Aware Core — 完了

- `organizations` / `memberships` / `sessions.current_org_id`
- personal workspace 作成
- `/api/orgs` / `/api/auth/switch-org`
- auth context への `orgId` / `orgRole` / `memberships` 追加
- invite lifecycle
- feature-based structure の整理
- auth routes のサブモジュール分割
- crypto ユーティリティの集約

## Phase 4: Record Engine — v0.1 完了

- `shared/lib/record-def.ts` — defineRecord 型定義
- `scripts/generate-record.mjs` — レコード定義 → バックエンド＋フロントエンド一発生成
- 生成物: Drizzle テーブル / Zod スキーマ / Hono CRUD+status ルート / TanStack Query hooks
- 汎用 UI: RecordListPage, RecordDetailPage, RecordFormPage
- フィールドコンポーネント: TextField, NumberField, DateField, SelectField, RelationField
- StatusBadge, StatusFilterTabs, DataTable
- wouter ルーティング導入
- audit log 統合
- 型安全強化
- UI/UX 品質改善

### vNext

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

## Phase 5: 削除境界の整備 — 完了

- メタツール削除（scaffold CLI, template, bin, examples, internal scripts）
- module system 削除
- scaffold markers 整理
- coreからRecord Engineへの直接importゼロを確認
- 剥がしガイドをCLAUDE.mdに明記（Record Engine / 認証の削除手順）
- ドキュメント整理

## Phase 6: Agent-Ready CLI — 完了

- `scripts/cf-starter.mjs` と `bin/cf-starter` を追加
- `doctor` / `doctor --remote` / `env plan` / `db migrate` / `db seed-demo` / `record generate` / `deploy` を共通 CLI に統合
- `--plan` / `--json` を主要コマンドで統一
- テンプレ repo 本体はプレースホルダ設定を維持し、実値はコピー先で埋める方針を明記
- 契約テストを追加して CLI 出力 shape を保護
- 詳細は `CLI_DESIGN.md` を参照

## Phase 7: Deploy DX 改善 — 完了

tara-shisetsu（3本目の実アプリ）で毎回引っかかった7つのペインポイントを解消。

- `npm run init` を拡張: D1自動作成 → database_id書き込み → CORS_ORIGIN/APP_BASE_URL設定 → migrations完全クリア → db:generate → db:migrate → seed:demo を一括実行
- `npm run setup:remote` 新設: リモートmigrate + seed:demo --remote + seed-app.sql + secrets確認
- `doctor --remote` にデプロイ前チェック追加: CORS_ORIGIN localhost only警告、必須シークレットヒント
- `.dev.vars` にローカル用 APP_BASE_URL オーバーライドを自動生成
- `seed-app.sql` 規約: アプリ固有シードデータを1ファイルで local/remote 共通化
- 理想フロー: `cp -r cf-starter my-app && cd my-app && npm install && npm run init && npm run dev`

## Phase 8: Dashboard UI Kit — 完了

tara-yosan（太良町予算ダッシュボード）の開発で得た知見をテンプレに還元。

- Recharts 依存追加 + チャートラッパー5種（HorizontalBar, ChangeBar, TrendLine, StackedBar, PieDonut）
- ダッシュボード用 UI 部品（KpiCard, Section, ChartTableToggle, DataTableSimple）
- PublicShell — AUTH_ENABLED=false 時に自動選択されるモバイルファースト1カラムレイアウト
- AppShell / PublicShell の自動切替（App.tsx の AuthGuard が AUTH_ENABLED で判定）
- GET-only 公開 API パターン（`src/routes/public-example.ts` + `/api/public/*` プレフィックス）
- `app/lib/format.ts` — 数値フォーマットユーティリティ置き場
- `init-copy.mjs` — PublicShell.tsx を名前置換対象に追加
- CLAUDE.md の seed-demo.mjs 削除リスト修正（Record Engine 非依存のため残す）
- パターン集ドキュメント（外部DB→D1移行、ドリルダウン、フォーマット関数）
- ARCHITECTURE.md / README.md 更新
