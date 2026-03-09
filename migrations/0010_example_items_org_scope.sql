ALTER TABLE items ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_items_organization_id ON items (organization_id);
