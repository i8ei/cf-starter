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

- ほぼ完了

完了済み:

- Hono RPC client
- Vite build
- Vitest
- Queue sample jobs
- Cron session cleanup
- optional module install plan
- planner / renderers / transforms / orchestrator 分離
- marker-first transform への寄せ
- `doctor` の template-first 化
- `scaffold-app` / internal maintenance CLI の整理

残り:

- README / architecture docs の継続改善
- 細かい terminology と helper 境界の仕上げ

## Phase 3: Organization-Aware Core

目的:

- user 単体ではなく `organization の中の user` を扱えるようにする

状態:

- 完了

完了済み:

- `organizations`
- `memberships`
- `sessions.current_org_id`
- personal workspace 作成
- `/api/orgs`
- `/api/auth/switch-org`
- auth context への `orgId` / `orgRole` / `memberships` 追加
- invite lifecycle
- feature-based structure の整理（example は `examples/feature-packs/` に分離、core は横断基盤として `src/routes/` + `src/lib/` に維持）
- auth routes のサブモジュール分割（`src/routes/auth/`）
- crypto ユーティリティの集約（`src/lib/crypto.ts`）

次:

- reference features の拡張
- Record Engine vNext と実案件検証

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
- セキュリティ強化: トークン消費のアトミック化、CSRF 全 mutating リクエスト適用、ログのシークレット秘匿
- 型安全強化: `listView.columns` / `formView.fields` のキー制約、生成コードの `as any` 除去
- `RecordDetailPage` の relation 名前表示対応（`relationLabels`）
- コード生成のライブラリ分離（`scripts/lib/record-engine.mjs`）、重複チェック、53 テスト追加
- `organizationId` の NOT NULL + index 化
- レガシーパスワードハッシュ互換コード削除
- UI/UX 品質改善: アクセシビリティ基盤（label 紐付け、フォーカスリング、aria 属性、キーボード操作）
- DataTable: クライアントサイドソート、空状態アクション誘導、テーブルアクセシビリティ
- フォーム: 必須マーカー `*`、送信スピナー、削除確認ダイアログ
- デザインシステム: セマンティックステータスカラー、Inter + Noto Sans JP、border-radius/shadow 整理、コントラスト改善

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

状態:

- 進行中

直近で追加済み:

- `create-cf-starter` の `core-only` デフォルト
- generated app 専用 README / `doctor` / `seed:demo`
- example feature pack の `examples/feature-packs/` 分離
- `scripts/compat/` への互換 wrapper 集約
- `profile` 中心の scaffold plan / JSON surface
- `template/` を source of truth にした template-first scaffold
- `template:check` / `template:sync` / snapshot fixture
- generated app runtime / publish surface の整理

未着手:

- APP_FACTORY.md
- generation playbook
- install / bootstrap scripts の強化

## Phase 6: Starter Simplification v2

目的:

- `cf-starter` を「高機能な starter」から「迷わず使える starter」に寄せる
- generated app を starter 本体から明確に分離する
- app を切ったあとに不要な資産が残らない状態を作る

基本方針:

- 初期状態は `core-only` を標準にする
- example は core から切り離す
- advanced 機能は opt-in にする
- public な入口は 1 コマンドに絞る

状態:

- 大枠完了

現在地:

- public surface は `create-cf-starter` 中心へ整理済み
- generated app から starter 専用 scripts / tests / docs を除去済み
- `core-only` / `--include ...` / `--starter` の役割分離済み
- example source-of-truth は `examples/feature-packs/` へ分離済み
- `doctor` は generated app 単独で動作する状態まで確認済み
- compat wrapper は `scripts/compat/` に隔離済み
- scaffold は `template-first` へ移行済み
- internal template maintenance script は共通 report / option parsing へ整理済み
- publish surface は template/runtime 前提で検証済み

### Workstream 1: Product Surface の整理

目的:

- `cf-starter` の責務を最小化する

やること:

- `cf-starter` の提供価値を `auth + org + db + api + ui + test` に再定義
- `Record Engine` を core 標準ではなく optional として位置づけ直す
- `KV` `R2` `Queue` `example features` を標準同梱から opt-in へ寄せる
- README 冒頭のメッセージを `app 利用者目線` に書き換える

完了条件:

- README の冒頭だけで「何が最初から入るか」が説明できる
- core の必須 binding が `DB` と必要最小限の auth 周辺に絞られている

### Workstream 2: Generated App と Starter の分離

目的:

- scaffold 後の repo を「普通の app」にする

やること:

- generated app から starter 専用 script を除去
- generated app から starter 専用 test を除去
- generated app から starter 専用 doc 文言を除去
- generated app 用 README / ARCHITECTURE テンプレートを別管理にする
- package metadata を app 用に固定する

完了条件:

- scaffold 直後の app で `create-cf-starter` への参照が残らない
- generated app の `npm test` が starter 専用ケースなしで通る

### Workstream 3: Create Flow の一本化

目的:

- app 作成の入口を 1 つに絞る

やること:

- public CLI を `create-cf-starter <target>` に限定
- `app:plan` / `modules:plan` / `app:scaffold` は内部用へ縮退、または削除
- CLI / plan の出力を `profile` と `selectedFeatures` 中心に寄せる
- `--include` を example opt-in の主導線にする

完了条件:

- 新規ユーザー向けの手順が 3 行以内になる
- app 作成後に追加 cleanup 不要で開発開始できる

### Workstream 4: Example / Feature Packaging の分離

目的:

- example が core を汚さない構造にする

やること:

- `items` `kv` `upload` を `examples/` へ退避
- example ごとの migration / binding / docs を feature pack として分離
- 選択しない example は generated app に一切入れない
- 将来の業務機能追加も `feature pack` 単位で扱えるようにする

完了条件:

- core-only app に example 由来の migration や route が残らない
- example の追加削除がディレクトリ単位で追える

### Workstream 5: Local Bootstrap の標準化

目的:

- 空 DB のまま迷わず検証開始できるようにする

やること:

- `npm run seed:demo` または `npm run bootstrap:local` を追加
- demo user / org / sample records を注入できるようにする
- generated app の README に「起動して何を触れるか」を明記する

完了条件:

- scaffold 後 5 分以内にログインと主要画面確認ができる
- 手動 SQL なしでローカル検証を始められる

### Workstream 6: App Readiness Checks

目的:

- scaffold 結果の健全性を自動で検査する

やること:

- `npm run doctor` を追加
- 未置換 app 名、不要 script、不要 test、不要 binding を検出
- generated app の smoke test を `install -> migrate -> build -> test` に統一

完了条件:

- app 作成後の破綻が `doctor` で検出できる
- CI で generated app の最低品質を担保できる

### Workstream 7: Migration Strategy

目的:

- v1 から v2 へ無理なく移行する

やること:

- v1 の `app:scaffold` 系を deprecated 扱いにする
- v2 cutover 後に消す script / docs / tests を列挙する
- 互換維持期間と削除時期を決める

完了条件:

- 既存ユーザーが壊れずに移行手順を辿れる
- repo 内に新旧方針が長く共存しない

## v2 First Slice

最初の 4 本はこれでよい:

1. generated app から starter 専用 scripts / tests / docs を自動除去する
2. README を `starter 用` と `generated app 用` に分離する
3. `create-cf-starter` のデフォルトを `core-only app` に変える
4. `seed:demo` と `doctor` を追加する

この 4 本が入ると、「作った app がすぐ使えるか」という v2 の中心課題はかなり解消される。
