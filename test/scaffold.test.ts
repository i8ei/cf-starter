import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyCoreOnlyTransforms,
  applyFeatureSelection,
  resolveSelectedFeatures,
  rewriteScaffoldMetadata,
  rewriteIndexForCoreOnly,
  scaffoldStarter,
  writeCoreOnlyApp,
} from "../scripts/lib/scaffold.mjs";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("scaffold", () => {
  it("rewrites index for core-only mode", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-index-"));
    tempDirs.push(dir);
    const indexPath = join(dir, "index.ts");

    await writeFile(
      indexPath,
      [
        'import items from "./features/example/items/routes";',
        'import kv from "./features/example/kv/routes";',
        'import upload from "./features/example/upload/routes";',
        'app.route("/api/items", items)',
        'app.route("/api/kv", kv)',
        'app.route("/api/upload", upload)',
        'app.route("/api/auth", auth)',
      ].join("\n")
    );

    await rewriteIndexForCoreOnly(indexPath);
    const updated = await readFile(indexPath, "utf8");

    expect(updated).not.toContain("/api/items");
    expect(updated).not.toContain("/api/kv");
    expect(updated).not.toContain("/api/upload");
    expect(updated).toContain("/api/auth");
  });

  it("applies core-only transforms to a copied app", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-core-only-"));
    tempDirs.push(dir);

    await mkdir(join(dir, "src/features/example/items"), { recursive: true });
    await mkdir(join(dir, "app/features/example/items"), { recursive: true });
    await mkdir(join(dir, "shared/features/example/items"), { recursive: true });
    await mkdir(join(dir, "src"), { recursive: true });
    await mkdir(join(dir, "app"), { recursive: true });
    await writeFile(join(dir, "src/index.ts"), 'import items from "./features/example/items/routes";\napp.route("/api/items", items)\napp.route("/api/auth", auth)');
    await writeFile(join(dir, "app/App.tsx"), "old app");

    await applyCoreOnlyTransforms(dir);
    await writeCoreOnlyApp(dir, "starter-core");

    const appSource = await readFile(join(dir, "app/App.tsx"), "utf8");
    const indexSource = await readFile(join(dir, "src/index.ts"), "utf8");

    expect(appSource).toContain("Core-only starter");
    expect(indexSource).not.toContain("/api/items");
  });

  it("scaffolds a starter copy without node_modules", async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), "cf-starter-source-"));
    const targetDir = await mkdtemp(join(tmpdir(), "cf-starter-target-parent-"));
    const target = join(targetDir, "generated");
    tempDirs.push(sourceDir, targetDir);

    await mkdir(join(sourceDir, "src"), { recursive: true });
    await mkdir(join(sourceDir, "node_modules/pkg"), { recursive: true });
    await writeFile(join(sourceDir, "src/index.ts"), "export const ok = true;");
    await writeFile(join(sourceDir, "node_modules/pkg/index.js"), "ignored");

    await scaffoldStarter({ sourceDir, targetDir: target });

    const copied = await readFile(join(target, "src/index.ts"), "utf8");
    expect(copied).toContain("ok = true");
    await expect(readFile(join(target, "node_modules/pkg/index.js"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rewrites package, wrangler, readme, and app metadata for the target app name", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-meta-"));
    tempDirs.push(dir);

    await mkdir(join(dir, "app"), { recursive: true });
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({ name: "cf-starter" }, null, 2)
    );
    await writeFile(
      join(dir, "wrangler.jsonc"),
      [
        '{',
        '  "name": "cf-starter",',
        '  "d1_databases": [{ "database_name": "cf-starter-db" }],',
        '  "r2_buckets": [{ "bucket_name": "cf-starter-bucket" }],',
        '  "queues": { "producers": [{ "queue": "cf-starter-jobs" }], "consumers": [{ "queue": "cf-starter-jobs" }] },',
        '  "vars": { "EMAIL_FROM": "cf-starter <noreply@example.com>" }',
        '}',
      ].join("\n")
    );
    await writeFile(join(dir, "README.md"), "# cf-starter\n\n`cf-starter`\ncf-starter/\n");
    await writeFile(join(dir, "app/App.tsx"), "cf-starter\nStarter Core\n");

    await rewriteScaffoldMetadata(dir, "regional-ops");

    expect(await readFile(join(dir, "package.json"), "utf8")).toContain('"name": "regional-ops"');
    expect(await readFile(join(dir, "wrangler.jsonc"), "utf8")).toContain('"name": "regional-ops"');
    expect(await readFile(join(dir, "wrangler.jsonc"), "utf8")).toContain('"database_name": "regional-ops-db"');
    expect(await readFile(join(dir, "README.md"), "utf8")).toContain("# regional-ops");
    expect(await readFile(join(dir, "app/App.tsx"), "utf8")).toContain("regional-ops");
  });

  it("resolves selected features from include and exclude lists", () => {
    expect(resolveSelectedFeatures()).toEqual(["items", "kv", "upload"]);
    expect(resolveSelectedFeatures({ include: ["items", "upload"] })).toEqual([
      "items",
      "upload",
    ]);
    expect(resolveSelectedFeatures({ exclude: ["kv"] })).toEqual([
      "items",
      "upload",
    ]);
    expect(resolveSelectedFeatures({ coreOnly: true, include: ["items"] })).toEqual([]);
  });

  it("removes excluded feature routes and items UI", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-feature-select-"));
    tempDirs.push(dir);

    await mkdir(join(dir, "src"), { recursive: true });
    await mkdir(join(dir, "app"), { recursive: true });
    await mkdir(join(dir, "src/features/example/items"), { recursive: true });
    await mkdir(join(dir, "src/features/example/kv"), { recursive: true });
    await mkdir(join(dir, "src/features/example/upload"), { recursive: true });
    await mkdir(join(dir, "app/features/example/items"), { recursive: true });
    await mkdir(join(dir, "shared/features/example/items"), { recursive: true });
    await writeFile(
      join(dir, "src/index.ts"),
      [
        'import items from "./features/example/items/routes";',
        'import kv from "./features/example/kv/routes";',
        'import upload from "./features/example/upload/routes";',
        'app.route("/api/items", items)',
        'app.route("/api/kv", kv)',
        'app.route("/api/upload", upload)',
      ].join("\n")
    );
    await writeFile(
      join(dir, "app/App.tsx"),
      [
        'import {',
        '  useItems,',
        '  useCreateItem,',
        '} from "./features/example/items/hooks/useItems";',
        '  const [name, setName] = useState("");',
        '  const { data: items = [], isLoading } = useItems(!!session);',
        '  const createItem = useCreateItem();',
        '  const handleAdd = () => {',
        '    if (!name.trim()) return;',
        '    createItem.mutate(name.trim());',
        '    setName("");',
        '  };',
        '            <Panel',
        '              title="D1 Items"',
        '              subtitle="Example feature は残して、core 追加後も RPC client と mutation が崩れていないことを見ます。"',
        '            >',
        '              body',
        '            </Panel>',
      ].join("\n")
    );

    await applyFeatureSelection(dir, ["kv", "upload"]);

    const indexSource = await readFile(join(dir, "src/index.ts"), "utf8");
    const appSource = await readFile(join(dir, "app/App.tsx"), "utf8");

    expect(indexSource).not.toContain("/api/items");
    expect(indexSource).toContain("/api/kv");
    expect(appSource).not.toContain("D1 Items");
    expect(appSource).not.toContain("useItems");
  });
});
