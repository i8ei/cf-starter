# パターン集

テンプレには含めないが、派生アプリで繰り返し使う実装パターン。

## 外部SQLiteからD1へのデータ移行

既存のSQLite DBからD1にデータを投入するパターン:

1. Pythonスクリプト（`scripts/export-xxx-sql.py`）で既存DBをSELECT → INSERT文を生成
2. `seed-app.sql` に出力（先頭にDELETE文でべき等化）
3. ローカル: `npx wrangler d1 execute <db-name> --local --file seed-app.sql`
4. リモート: `npx wrangler d1 execute <db-name> --remote --file seed-app.sql`（または `npm run setup:remote`）

注意点:
- NULL値はNOT NULLカラムに入れない（`COALESCE` や Python側で0に変換）
- テキストのシングルクォートはエスケープ（`''`）
- D1の1文あたりパラメータ上限に注意（大量INSERTは文を分割）

## アコーディオン式ドリルダウン（階層データ表示）

款→項→目のような階層データを展開表示するパターン:

- フラットな配列をツリー構造に変換（Map + ネスト）
- 各ノードを `useState(false)` で開閉
- depth に応じてインデント（`ml-3 border-l`）
- 実例: tara-yosan の `app/components/DrillDown.tsx`

## 数値フォーマットユーティリティ

`app/lib/format.ts` にドメイン固有のフォーマット関数を置く:

- 通貨: `fmtCurrency(yen)` → `¥1,234`
- 増減: `fmtDiff(val)` → `+1,234` / `-567`
- パーセント: `fmtPercent(ratio)` → `12.3%`
- 1人あたり: `perCapita(total, population)` → `123,456円`

チャートの `valueFormatter` に渡すことで統一的な表示になる。
