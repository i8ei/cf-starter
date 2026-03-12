import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { organizations } from "../../../../src/db/schema";

export const items = sqliteTable(
  "items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "cascade",
      }),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull().default("(datetime('now'))"),
  },
  (table) => [index("items_organization_id_idx").on(table.organizationId)]
);

