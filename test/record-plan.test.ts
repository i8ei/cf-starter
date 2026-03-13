import { describe, expect, it } from "vitest";
import { buildRecordGenerationPlan } from "../scripts/lib/record-plan.mjs";

const sampleDef = {
  key: "tasks",
  label: "Task",
  tableName: "tasks",
  fields: {
    title: { type: "text", label: "Title", required: true, maxLength: 200 },
    dueDate: { type: "date", label: "Due Date" },
  },
  status: {
    field: "status",
    label: "Status",
    options: ["open", "done"],
    defaultValue: "open",
  },
  listView: {
    columns: ["title", "status"],
    defaultSort: { field: "status", direction: "asc" as const },
  },
  formView: {
    sections: [{ label: "Main", fields: ["title", "dueDate"] }],
  },
};

const schemaContent = `import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
});
`;

const indexContent = `import { Hono } from "hono";
import auth from "./routes/auth";

export const app = new Hono()
  .route("/api/auth", auth);
`;

const appContent = `import { Route, Switch } from "wouter";

const recordNavItems: { label: string; href: string }[] = [
  // Example: { label: "Task", href: "/tasks" },
];

export default function App() {
  return (
    <Switch>
      <Route path="/" component={() => null} />
      {/* record-engine:routes */}
    </Switch>
  );
}
`;

describe("buildRecordGenerationPlan", () => {
  it("plans file creation and route registration for a new record", () => {
    const report = buildRecordGenerationPlan({
      def: sampleDef,
      defExportName: "taskDef",
      schemaContent,
      indexContent,
      appContent,
      existingPaths: [],
    });

    expect(report.ok).toBe(true);
    expect(report.summary[0]).toContain('Record "tasks" will create');
    expect(report.changes).toContainEqual({
      kind: "file",
      path: "shared/features/tasks/schema.ts",
      action: "create",
    });
    expect(report.changes).toContainEqual({
      kind: "file",
      path: "src/db/schema.ts",
      action: "update",
    });
    expect(report.changes).toContainEqual({
      kind: "file",
      path: "app/App.tsx",
      action: "update",
    });
  });

  it("skips files that already exist and tolerates missing app routing", () => {
    const report = buildRecordGenerationPlan({
      def: sampleDef,
      defExportName: "taskDef",
      schemaContent: `${schemaContent}\nexport const tasks = sqliteTable("tasks", {});\n`,
      indexContent: `${indexContent}\n  .route("/api/tasks", tasksRoutes)\n`,
      appContent: null,
      existingPaths: [
        "shared/features/tasks/schema.ts",
        "src/features/tasks/routes.ts",
        "app/features/tasks/hooks/useTasks.ts",
        "app/pages/tasks/TasksListPage.tsx",
        "app/pages/tasks/TasksDetailPage.tsx",
        "app/pages/tasks/TasksFormPage.tsx",
      ],
    });

    expect(report.ok).toBe(true);
    expect(report.changes.find((change) => change.path === "src/db/schema.ts")?.action).toBe("skip");
    expect(report.changes.find((change) => change.path === "src/index.ts")?.action).toBe("skip");
    expect(report.warnings).toContain(
      "app/App.tsx not found. Frontend route registration will be skipped."
    );
  });
});
