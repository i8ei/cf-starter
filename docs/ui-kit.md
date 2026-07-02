# ダッシュボード UI キット（Recharts + 汎用コンポーネント）

> デザインシステムのトークン規則（セマンティックトークン必須・`text-base` 入力・日本語UI）は CLAUDE.md 本体にある。ここはチャート・フォーマッター・部品の詳細。

Recharts ベースのチャートラッパーとダッシュボード用UI部品が組み込み済み。

## チャートカラーパレット

`index.css` の `--chart-1`〜`--chart-10` CSS変数でチャート色を一元管理。`getChartColors()` (`app/components/charts/colors.ts`) が解決済みhex値を返す。

- `HorizontalBar` / `PieDonut`: デフォルトで `getChartColors()` を使用（`colors` propで上書き可）
- `TrendLine` / `StackedBar`: `lines[]` / `bars[]` の `color` で明示指定。`var(--chart-1)` 等は使えない（Recharts制約）ので、hex値を直接指定する
- `ChangeBar`: 正負色は `--success` / `--danger` と同値のデフォルト（`positiveColor` / `negativeColor` で上書き可）

プロジェクト固有の色に変更するには、`index.css` の `:root` で `--chart-1` 等を上書きするだけでよい。

## 数値フォーマッター（`app/lib/format.ts`）

ロケールは `ja-JP` 固定（対象ユーザーが日本の自治体のため）。変更する場合は `format.ts` 冒頭のロケール指定を書き換える。

| 関数 | 出力例 | 用途 |
|---|---|---|
| `fmtNumber(n)` | `1,234` | 汎用（チャートのデフォルト `valueFormatter`） |
| `fmtCurrency(yen)` | `¥1,234` | 金額表示 |
| `fmtDiff(val)` | `+1,234` / `-567` | 増減表示（ChangeBarのデフォルト） |
| `fmtPercent(ratio)` | `12.3%` | 割合表示 |

チャートの `valueFormatter` prop に渡して使う。プロジェクト固有のフォーマッターもこのファイルに追加する。

## チャートコンポーネント（`app/components/charts/`）

| コンポーネント | 用途 | 主なprops |
|---|---|---|
| `HorizontalBar` | 横棒ランキング | `data`, `colors`, `valueFormatter`, `tooltipLabel`, `categoryWidth` |
| `ChangeBar` | 増減棒（±色分け） | `data`, `positiveColor`, `negativeColor`, `tooltipLabel`, `categoryWidth` |
| `TrendLine` | 折れ線グラフ（複数系列） | `data`, `lines`, `xKey`, `margin` |
| `StackedBar` | 積み上げ棒（縦/横） | `data`, `bars`, `layout`, `margin` |
| `PieDonut` | 円/ドーナツグラフ | `data`, `innerRadius`（>0でドーナツ）, `tooltipLabel` |

すべて `ResponsiveContainer` でラップ済み、モバイル対応。`valueFormatter` で数値表示をカスタマイズ可能（デフォルトは `fmtNumber`、ChangeBar は `fmtDiff`）。

- `tooltipLabel`: ツールチップに表示するラベル名（デフォルト: `"値"` / ChangeBarは `"増減"`）
- `categoryWidth`: 横棒チャートのカテゴリ軸幅（デフォルト: 120px。長いラベルがある場合に調整）
- `margin`: チャート余白（TrendLine / StackedBar のみ）

## ダッシュボード用コンポーネント

| コンポーネント | 用途 |
|---|---|
| `KpiCard` | 数値カード（ラベル + 値 + サブテキスト）。`variant`: `"success"` / `"danger"` / `"warning"` / `"primary"` |
| `Section` | セクション見出し（h2 + children） |
| `ChartTableToggle` | グラフ/テーブル切替タブ |
| `DataTableSimple` | 読み取り専用の軽量テーブル（DataTableのソート不要版） |

## レイアウト選択

| レイアウト | 用途 | 選択基準 |
|---|---|---|
| `AppShell` | 認証あり・モバイル対応（2段ヘッダー） | Record Engine アプリ、管理画面 |
| `PublicShell` | 認証なし・モバイルファースト | ダッシュボード、公開サイト |

`AUTH_MODE=none` の場合、`AuthGuard` が自動で `PublicShell` を選択する。

## デザインシステム詳細

melta UI inspired セマンティックトークン。

- フォント: Inter + Noto Sans JP（`tabular-nums` 対応）
- StatusBadge: セマンティックカラー（ステータスの意味に基づく色割り当て）
- border-radius: input `rounded-lg`、button/panel `rounded-xl`
- **セマンティックカラー**（`:root` CSS変数 → `@theme` で Tailwind 登録）:
  - 背景: `bg-surface`（白）、`bg-surface-alt`（薄灰）、`bg-surface-hover`（ホバー）
  - テキスト: `text-heading`（見出し）、`text-body`（本文）、`text-muted`（補助）
  - ボーダー: `border-border`（標準）、`border-border-strong`（強調）
  - 入力: `bg-input-bg`、`border-input-border`
  - アクセント: `bg-accent`（プライマリアクション色 #2563eb）
  - フォーカス: `ring-ring`（アクセント色のリング）
- **色のカスタマイズ**: `index.css` の `:root` 変数を上書きするだけでテーマ変更可能
