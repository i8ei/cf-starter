# cf-starter

Cloudflare フルスタック スターターテンプレート。

## スタック

- **Frontend**: Vite + React + TypeScript + Tailwind CSS v4
- **Backend**: Cloudflare Pages Functions (file-based routing)
- **Storage**: D1 (SQLite) / R2 (オブジェクト) / KV (キーバリュー)
- **Deploy**: Cloudflare Pages

## ディレクトリ構成

```
cf-starter/
├── frontend/
│   ├── functions/api/   ← Pages Functions (API)
│   │   ├── _middleware.ts   CORS
│   │   ├── env.d.ts         Env 型定義
│   │   ├── health.ts        GET /api/health
│   │   ├── items.ts         GET/POST /api/items (D1)
│   │   ├── upload.ts        GET/POST /api/upload (R2)
│   │   └── kv/[[key]].ts   GET/PUT /api/kv/:key (KV)
│   ├── src/                 ← React アプリ
│   └── vite.config.ts
├── migrations/              ← D1 マイグレーション
├── wrangler.toml
└── package.json
```

## コマンド

```bash
npm run dev            # ローカル開発（Vite + Wrangler）
npm run build          # フロントビルド
npm run deploy         # Cloudflare Pages にデプロイ
npm run db:migrate     # D1 ローカルマイグレーション
npm run db:migrate:remote  # D1 リモートマイグレーション
```

## 開発の流れ

1. `wrangler.toml` の database_id / kv id を実際の値に置換
2. `npm run db:migrate` でローカルDB作成
3. `npm run dev` で開発開始
4. API追加は `frontend/functions/api/` にファイル追加

## 規約

- API は `/api/` 以下、ファイルベースルーティング
- Env バインディングの型は `env.d.ts` に集約
- マイグレーションは `migrations/` に連番で管理
