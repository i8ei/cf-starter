# CLI Design

`cf-starter` を AI / 人間の両方に扱いやすい運用 CLI へ寄せるための設計メモ。

前提:

- 既存の `npm` scripts と `scripts/*.mjs` を土台にする
- いきなり別プロダクトの CLI を作らない
- 出力を「人間向けログ」から「人間が読めて機械も扱える契約」へ寄せる

## Goal

目標は、`cf-starter` を次の3用途で安定して使えるようにすること。

1. 初回セットアップ
2. 継続開発と検証
3. AI エージェントによる安全な自動操作

そのために必要なのは「何でも自動化する巨大 CLI」ではなく、既存の作業を以下の性質で再編すること。

- plan-first
- JSON-first
- 非破壊デフォルト
- 段階導入
- Cloudflare 固有エラーの事前検出

## Current State

この設計メモで意図した第一段階は実装済みです。

- `scripts/cf-starter.mjs` に unified CLI 入口がある
- `bin/cf-starter` から同じ CLI を叩ける
- `doctor` / `doctor --remote`（CORS_ORIGIN localhost警告、secrets確認ヒント含む）
- `env plan`
- `db migrate --plan --json`
- `db seed-demo --plan --json`
- `setup remote`（リモートDB一括準備）
- `record generate --plan --json`
- `deploy --plan --json`

補足:

- テンプレ repo 本体の `wrangler.jsonc` は意図的に `database_id: "TODO"` と localhost の `APP_BASE_URL` を持つ
- これらは `npm run init` がコピー先で自動的に実値を埋める（D1作成 + URL設定）

## Design Principles

### 1. Keep existing scripts alive

既存の `npm` scripts は互換レイヤとして残す。

- 短期: `npm run db:migrate` などはそのまま使える
- 中期: 実体は `node scripts/cf-starter.mjs <subcommand>` に寄せる
- 長期: npm 公開時に `create-cf-starter` / `cf-starter` の bin を持てる形にする

### 2. Plan and apply are separate modes

破壊的または外部状態を変える処理は必ず `plan` と `apply` を分ける。

- `doctor` は確認専用
- `plan` は「何を変えるか」を返す
- `apply` は実変更を行う
- `--yes` がない限り危険操作は自動確定しない

### 3. JSON is a contract, not an afterthought

`--json` はおまけではなく正式インターフェースとする。

- 人間向け summary は標準出力に短く出す
- 詳細は JSON で返す
- CI / AI は JSON のみ見れば処理できる

### 4. Prefer composition over magic

1コマンドで全部やるのではなく、段階を明示する。

- `doctor`
- `env plan`
- `db migrate`
- `seed demo`
- `record generate`
- `deploy`

この粒度なら実装もテストも壊れにくい。

## Proposed CLI Surface

メイン入口は1つに寄せる。

```bash
node scripts/cf-starter.mjs <command> <subcommand> [flags]
```

公開時は次の形を想定する。

```bash
cf-starter <command> <subcommand> [flags]
create-cf-starter <app-name> [flags]
```

### Core commands

```bash
cf-starter doctor
cf-starter env plan
cf-starter db migrate
cf-starter db seed-demo
cf-starter setup remote
cf-starter record generate --record shared/records/task.ts
cf-starter deploy
```

### Command roles

- `doctor`: ローカル環境と config の診断（`--remote` でデプロイ前チェック追加）
- `env plan`: Cloudflare 資源と binding の不足を整理
- `db migrate`: D1 migration の plan / apply
- `db seed-demo`: demo user / org の投入
- `setup remote`: リモートDB一括準備（migrate + seed:demo + seed-app.sql + secrets確認）
- `record generate`: Record Engine 生成処理
- `deploy`: build + deploy 前の preflight と実行

## Shared Flags

全サブコマンドでできるだけ同じフラグを使う。

```text
--json         JSON を stdout に出す
--json-out     JSON をファイル保存する
--plan         実行せず変更計画だけ返す
--dry-run      外部コマンドを実行しない
--local        ローカル対象
--remote       リモート対象
--config       wrangler config path
--cwd          project root
--verbose      追加ログ
--no-color     色を消す
```

ルール:

- 状態変更系は `--plan` を持つ
- `--json` と `--json-out` はすべての運用系コマンドでサポートする
- `--remote` と `--local` は対象があるコマンドだけに出す

## Output Contract

すべてのコマンドは同じ envelope を返す。

```json
{
  "ok": true,
  "command": "db migrate",
  "mode": "plan",
  "target": "local",
  "summary": [
    "2 migrations will be applied"
  ],
  "checks": [],
  "changes": [],
  "warnings": [],
  "nextSteps": []
}
```

### Required top-level fields

- `ok`: 成功可否
- `command`: 論理コマンド名
- `mode`: `doctor | plan | apply`
- `target`: `local | remote | config | source`
- `summary`: 人間向け短文配列
- `warnings`: 注意点
- `nextSteps`: 次の手順

### Optional fields

- `checks`: 診断結果
- `changes`: 実変更または変更予定
- `artifacts`: 生成 / 更新されたファイル
- `metrics`: 件数や所要時間
- `error`: 失敗時の構造化エラー

### Error contract

```json
{
  "ok": false,
  "command": "doctor",
  "mode": "doctor",
  "target": "config",
  "summary": [
    "Wrangler configuration is incomplete"
  ],
  "warnings": [],
  "nextSteps": [
    "Set d1_databases[0].database_id in wrangler.jsonc"
  ],
  "error": {
    "code": "missing_binding_id",
    "message": "database_id is TODO",
    "details": {
      "path": "d1_databases[0].database_id"
    }
  }
}
```

## Command Design

### `doctor`

役割は「この repo が今どこで詰まるか」を先に潰すこと。

#### Checks

- Node.js version
- `npm` availability
- `node_modules` presence
- `wrangler` availability
- `wrangler.jsonc` exists and parses
- `d1_databases[0]` exists
- `database_id` が `TODO` でない
- optional bindings の整合性
- `.wrangler/state` の有無
- migrations directory の存在
- 生成系 script に必要な shared utility の存在

#### Output shape

`checks` は次を持つ。

```json
{
  "id": "wrangler-config",
  "status": "fail",
  "severity": "error",
  "message": "d1_databases[0].database_id is TODO",
  "fix": "Update wrangler.jsonc with the real database id"
}
```

#### Notes

- `wrangler whoami` のようなネットワーク依存チェックは `--remote` 指定時のみ行う
- デフォルトはローカル完結の診断にする

### `env plan`

Cloudflare 側リソース作成を自動で実行する前に、必要資源と不足を整理する。

#### Responsibilities

- `wrangler.jsonc` から必要 binding を読む
- D1 / KV / R2 / Queue / DO の必要一覧を返す
- `TODO` や未設定値を列挙する
- README に書かれている手動作業を構造化された plan に変換する

#### Output example

```json
{
  "ok": true,
  "command": "env plan",
  "mode": "plan",
  "target": "config",
  "summary": [
    "4 Cloudflare resources are required",
    "2 bindings need manual ids"
  ],
  "changes": [
    {
      "kind": "resource",
      "resourceType": "d1",
      "binding": "DB",
      "name": "cf-starter-db",
      "status": "configured"
    },
    {
      "kind": "binding",
      "resourceType": "d1",
      "binding": "DB",
      "field": "database_id",
      "status": "missing"
    }
  ],
  "nextSteps": [
    "Create the D1 database with wrangler d1 create",
    "Write the returned database_id into wrangler.jsonc"
  ]
}
```

### `db migrate`

既存の `scripts/d1-migrate.mjs` を置き換える本命コマンド。

#### Modes

- `--plan`: 適用対象 migration 一覧だけ返す
- default apply: 実際に `wrangler d1 migrations apply` を実行
- `--local` / `--remote`: 対象切替

#### Desired behavior

- 適用前に `doctor` 相当の最低限チェックを内包
- temp dir を使う理由を JSON に出す
- 実行した `wrangler` 引数を `artifacts.executedCommand` に残す

#### `changes` example

```json
{
  "kind": "migration",
  "name": "0009_auth_maintenance_indexes.sql",
  "status": "pending"
}
```

### `db seed-demo`

既存の `scripts/seed-demo.mjs` を共通契約に乗せる。

#### Modes

- `--plan`: SQL を直接実行せず、投入予定の user / org を返す
- default apply: D1 execute
- `--remote`: remote D1 を対象にする

#### Constraints

- password の平文は summary に出さない
- `--json` 時は `credentials` を明示 opt-in にする
- 既存 user の upsert / org の再利用有無を `changes` に出す

### `record generate`

Record Engine は `cf-starter` 独自価値なので、最も agent-ready にする価値がある。

#### Modes

- `--plan`: 生成されるファイル一覧と差分種別だけ返す
- default apply: 実ファイル生成

#### Required output

- `artifacts.created`
- `artifacts.updated`
- `artifacts.skipped`
- `warnings`
- `nextSteps`: `db:generate`, `db:migrate`, route/nav 追加など

#### Design note

`--plan` を実現するため、現在 `writeFileSync` している箇所は「diff plan を組み立てる層」と「実際に書く層」に分離する。

### `deploy`

`deploy` は build と Cloudflare deploy の合成コマンドにする。

#### Phases

1. local doctor
2. build
3. remote preflight
4. deploy

#### `--plan`

`--plan` では次だけ返す。

- build が必要か
- `wrangler.jsonc` に未設定があるか
- remote migration 未適用の可能性
- deploy 対象名

## Internal Architecture

CLI は「コマンドごとの script 群」ではなく、小さい共通基盤を持つ。

### Current file layout

```text
scripts/
  cf-starter.mjs
  init-copy.mjs
  doctor.mjs
  env-plan.mjs
  d1-migrate.mjs
  seed-demo.mjs
  setup-remote.mjs
  generate-record.mjs
  deploy.mjs
  lib/
    cli-report.mjs
    cli-router.mjs
    wrangler-config.mjs
    doctor.mjs
    env-plan.mjs
    d1-migrate.mjs
    seed-demo.mjs
    record-plan.mjs
    deploy.mjs
```

### Shared modules

- `cli-router.mjs`: unified CLI のサブコマンド解決
- `cli-report.mjs`: summary / JSON / exit code 制御
- `wrangler-config.mjs`: `wrangler.jsonc` 読み込み、binding 抽出
- `doctor.mjs`: local / remote 診断の pure layer
- `env-plan.mjs`: Cloudflare resource / binding 計画の pure layer
- `d1-migrate.mjs`, `seed-demo.mjs`, `record-plan.mjs`, `deploy.mjs`: plan/report 用 pure layer

## Migration Strategy

### Phase 0: Baseline repair — 完了

- `scripts/lib/wrangler-config.mjs` を復元または新設
- `d1-migrate` と `seed-demo` の import 崩れを直す
- `wrangler` 実行 wrapper を1箇所へ集約

### Phase 1: Common contract — 完了

- `cli-report.mjs` を導入
- `doctor` を先に作る
- 既存 scripts に `--json` を追加

### Phase 2: Plan-first operations — 完了

- `db migrate --plan`
- `seed-demo --plan`
- `record generate --plan`
- `deploy --plan`
- `env plan`

### Phase 3: Unified entrypoint — 完了

- `scripts/cf-starter.mjs` を追加
- `package.json` scripts を新入口に寄せる

例:

```json
{
  "scripts": {
    "doctor": "node scripts/cf-starter.mjs doctor",
    "db:migrate": "node scripts/cf-starter.mjs db migrate --local",
    "db:migrate:remote": "node scripts/cf-starter.mjs db migrate --remote",
    "seed:demo": "node scripts/cf-starter.mjs db seed-demo",
    "record:generate": "node scripts/cf-starter.mjs record generate"
  }
}
```

### Phase 4: Publishable CLI — 完了

- `bin` を追加
- `cf-starter` を npm 公開前提の入口にする
- `create-cf-starter` は将来テンプレ複製フローを戻すなら別途検討する

## Testing Strategy

CLI はユニットテストより契約テストを重視する。

### Required tests

- `doctor --json` の snapshot
- `doctor --remote --json` の contract
- `env plan --json` の contract
- `db migrate --plan --json` の contract
- `seed-demo --plan --json` の contract
- `record generate --plan --json` の contract
- `deploy --plan --json` の contract
- `record generate` の apply 後 artifact 検証

### Test rules

- stdout の JSON shape を固定する
- 失敗系も `ok: false` で返す
- 文字列ログに依存しない

## Non-Goals

今回の設計では以下は対象外。

- GUI 風 REPL
- すべての Cloudflare リソース作成の完全自動化
- プロジェクト外の汎用 agent harness 化
- 既存の `wrangler` 自体を置き換えること

## Current Recommendation

テンプレ運用では次の順で使う。

初回セットアップ:

1. `cp -r cf-starter my-app && cd my-app && npm install`
2. `npm run init` — D1作成・URL設定・DB構築まで全自動

開発中:

3. `cf-starter doctor --json`
4. `cf-starter env plan --json`
5. `cf-starter db migrate --plan --json`
6. 必要に応じて `cf-starter record generate --plan --json`

デプロイ:

7. `cf-starter doctor --remote --json` — CORS/URL/secrets の事前確認
8. `npm run setup:remote` — リモートDB一括準備
9. `cf-starter deploy --plan --json`
