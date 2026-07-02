# Record Engine 詳細

> 5ステップの生成フローと必須の footgun は CLAUDE.md 本体にある。ここは生成物の内訳・UI 部品・ソフトデリート・削除手順・詳細な注意事項。

レコード定義を書いてジェネレーターを実行すると、バックエンド（Drizzle + Zod + Hono）とフロントエンド（TanStack Query hooks）のコードが一発生成される。生成後は自由に編集可能。

## 生成物（1レコードあたり）

| ファイル | 内容 |
|---------|------|
| `src/db/schema.ts` に追記 | Drizzle テーブル定義 |
| `shared/features/{key}/schema.ts` | Zod create/update スキーマ |
| `src/features/{key}/routes.ts` | CRUD + PATCH status ルート |
| `app/features/{key}/hooks/use{Key}.ts` | TanStack Query hooks（リスト: `use{Key}List`、単体: `use{Key}`） |
| `src/index.ts` に追記 | ルート登録 |

## UI コンポーネント

汎用レコード画面（`app/pages/records/`）を使って一覧・詳細・フォームを組める:
- `RecordListPage` — SummaryCards + status tabs 付き一覧、クライアントサイドソート、空状態アクション誘導
- `RecordDetailPage` — 詳細表示 + status 変更 + 削除確認ダイアログ
- `RecordFormPage` — フォーム（sections ベース）、必須マーカー `*`、送信スピナー

フィールドコンポーネント（`app/components/fields/`）: TextField, NumberField, DateField, SelectField, RelationField
- 全フィールド: `label`/`input` の `htmlFor`/`id` 紐付け、`focus-visible` リング、`aria-required`、エラー `role="alert"`

## ソフトデリート

レコード定義で `softDelete: true` を指定すると、生成コードが以下の動作に変わる:

- Drizzle スキーマに `deletedAt` カラム追加
- LIST / GET ONE に `isNull(deletedAt)` フィルタ追加
- DELETE が `deletedAt = now()` のソフトデリートに変更

## 注意事項（詳細）

- **ハイフン入りキー**: `defineRecord()` の `key` にハイフンを含めることができる（例: `"my-record"`）。生成コードはキャメルケースに変換して使う。
- **数値フィールド**: フォームからの入力は文字列になるため、`z.coerce.number()` を使う。`z.number()` ではバリデーションエラーになる。
- **日付フィールド**: `YYYY-MM-DD` 形式に加えて実在日付（うるう年含む）を検証する。
- **監査ログ除外**: `sensitive: true` または `audit: false` を付けたフィールドは生成ルートの audit metadata から除外される。
- **FileField**: 型定義（`shared/lib/record-def.ts`）とバリデーション（Zod `z.string()`）は存在するが、UIのファイルアップロードは未実装。フォームでは「ファイルアップロードは未実装です」のプレースホルダーが表示される。R2連携の実装は将来課題。
- **RelationField 自動解決**: 生成される Form/Detail ページは、relation 型フィールドの関連レコードを自動的にフェッチし、`relationOptions`/`relationLabels` として渡す。`relatedLabel` で指定したフィールドが表示ラベルになる。

## Record Engine を使わない場合

coreからRecord Engineへの直接importはゼロ。以下を削除すればcoreは壊れない。

### ファイル削除
- `app/pages/records/` — RecordList/Detail/FormPage
- `app/components/fields/` — TextField, NumberField, DateField, SelectField, RelationField
- `app/components/DataTable.tsx, SummaryCards.tsx, StatusFilterTabs.tsx, StatusBadge.tsx`
- `shared/lib/record-def.ts, shared/records/`（task.ts含む）
- `scripts/generate-record.mjs, scripts/lib/record-engine.mjs`
- `test/record-engine.test.ts`
- **注意**: `scripts/seed-demo.mjs` は Record Engine に依存していないので削除しない（org作成に必要）
- `app/features/`, `src/features/`, `shared/features/`（生成済みコードがあれば）
- `src/db/schema.ts` 内のscaffold markersとその間の生成コード（もしあれば）

### package.json
- scripts: `record:generate` を削除（`seed:demo` は残す — core infrastructure）

### 検証
`npx tsc --noEmit && npm run build` で壊れないことを確認。
