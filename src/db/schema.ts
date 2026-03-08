import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const organizations = sqliteTable("organizations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  currentOrgId: integer("current_org_id").references(() => organizations.id),
  expiresAt: text("expires_at").notNull(),
});

export const memberships = sqliteTable(
  "memberships",
  {
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    joinedAt: text("joined_at").notNull().default("(datetime('now'))"),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.userId] })]
);

export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const userRoles = sqliteTable(
  "user_roles",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    assignedAt: text("assigned_at").notNull().default("(datetime('now'))"),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })]
);

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorUserId: integer("actor_user_id").references(() => users.id),
  organizationId: integer("organization_id").references(() => organizations.id),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  requestId: text("request_id").notNull(),
  method: text("method").notNull(),
  path: text("path").notNull(),
  ip: text("ip"),
  status: integer("status").notNull(),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});
