function renderDeployBlock(requiredBindings) {
  const lines = [
    "```bash",
    "# 1. リソース作成",
    "wrangler d1 create my-app-db",
  ];

  if (requiredBindings.includes("KV")) {
    lines.push("wrangler kv namespace create KV");
  }
  if (requiredBindings.includes("BUCKET")) {
    lines.push("wrangler r2 bucket create my-app-bucket");
  }
  if (requiredBindings.includes("JOBS")) {
    lines.push("wrangler queues create my-app-jobs");
  }

  lines.push("");
  lines.push("# 2. wrangler.jsonc の bindings / ids を更新");
  lines.push("# 3. リモート DB へ migration 適用");
  lines.push("npm run db:migrate:remote");
  lines.push("");
  lines.push("# 4. デプロイ");
  lines.push("npm run deploy");
  lines.push("```");
  return lines;
}

function renderStackTable(requiredBindings) {
  const rows = [
    "| レイヤー | 技術 |",
    "|---|---|",
    "| Frontend | React + TypeScript + Tailwind CSS + TanStack Query |",
    "| Backend | Hono on Cloudflare Workers |",
    "| Database | D1 (SQLite) + Drizzle ORM |",
  ];

  if (requiredBindings.includes("BUCKET")) {
    rows.push("| Storage | R2 |");
  }
  if (requiredBindings.includes("KV")) {
    rows.push("| Cache | KV |");
  }

  rows.push("| Validation | Zod |");
  rows.push("| Build | Vite + `@cloudflare/vite-plugin` |");
  rows.push("| Testing | Vitest |");
  return rows;
}

function renderProductionChecklist(requiredBindings) {
  const lines = ['- [ ] `wrangler.jsonc` の `database_id` を実値にする'];

  if (requiredBindings.includes("KV")) {
    lines.push('- [ ] `wrangler.jsonc` の KV binding を実値にする');
  }
  if (requiredBindings.includes("BUCKET")) {
    lines.push('- [ ] `wrangler.jsonc` の R2 binding を実値にする');
  }
  if (requiredBindings.includes("JOBS")) {
    lines.push('- [ ] `wrangler.jsonc` の Queue binding を実値にする');
  }

  lines.push('- [ ] `CORS_ORIGIN` を本番 origin にする');
  lines.push('- [ ] `COOKIE_SAME_SITE` / `COOKIE_SECURE` を運用に合わせる');
  return lines;
}

export function renderGeneratedAppReadme({ appName, coreOnly, selectedFeatures, requiredBindings }) {
  const lines = [
    `# ${appName}`,
    "",
    "## セットアップ",
    "",
    "```bash",
    "npm install",
    "npm run db:migrate",
    "npm run dev",
    "```",
    "",
    "## コマンド",
    "",
    "| コマンド | 内容 |",
    "|---|---|",
    "| `npm run dev` | ローカル開発 |",
    "| `npm run build` | ビルド |",
    "| `npm run deploy` | Cloudflare にデプロイ |",
    "| `npm test` | テスト |",
    "| `npm run db:generate` | Drizzle から migration 生成 |",
    "| `npm run db:migrate` | ローカル D1 に migration 適用 |",
    "| `npm run db:migrate:remote` | リモート D1 に migration 適用 |",
    "| `npm run seed:demo` | demo user を投入 |",
    "| `npm run record:generate -- --record shared/records/xxx.ts` | Record Engine でコード生成 |",
    "",
    "## スタック",
    "",
    ...renderStackTable(requiredBindings),
    "",
    "## デプロイ",
    "",
    ...renderDeployBlock(requiredBindings),
    "",
    "## 本番チェックリスト",
    "",
    ...renderProductionChecklist(requiredBindings),
  ];

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}
