import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        city VARCHAR(100),
        state VARCHAR(50),
        zip VARCHAR(20),
        country VARCHAR(50) DEFAULT 'US',
        total_area_sqft NUMERIC(12, 2),
        owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS leases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        unit_identifier VARCHAR(100),
        leased_area_sqft NUMERIC(12, 2) NOT NULL,
        lease_start_date DATE NOT NULL,
        lease_end_date DATE NOT NULL,
        base_rent NUMERIC(12, 2) NOT NULL,
        cam_cap_percent NUMERIC(5, 2),
        cam_cap_type VARCHAR(50),
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS expense_ledgers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'open',
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(property_id, year, name)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS expense_line_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ledger_id UUID NOT NULL REFERENCES expense_ledgers(id) ON DELETE CASCADE,
        category VARCHAR(100) NOT NULL,
        description TEXT,
        vendor VARCHAR(255),
        amount NUMERIC(12, 2) NOT NULL,
        expense_date DATE NOT NULL,
        is_excluded BOOLEAN NOT NULL DEFAULT FALSE,
        exclusion_reason TEXT,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS cam_pools (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ledger_id UUID NOT NULL REFERENCES expense_ledgers(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        total_pool_area_sqft NUMERIC(12, 2),
        allocation_method VARCHAR(50) NOT NULL DEFAULT 'pro_rata',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cam_pool_id UUID NOT NULL REFERENCES cam_pools(id) ON DELETE CASCADE,
        lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
        expense_line_item_id UUID REFERENCES expense_line_items(id) ON DELETE SET NULL,
        allocation_percent NUMERIC(8, 5) NOT NULL,
        allocated_amount NUMERIC(12, 2) NOT NULL,
        estimated_amount NUMERIC(12, 2),
        reconciled_amount NUMERIC(12, 2),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reconciliation_statements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
        ledger_id UUID NOT NULL REFERENCES expense_ledgers(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        total_cam_charges NUMERIC(12, 2) NOT NULL,
        total_estimated_payments NUMERIC(12, 2) NOT NULL,
        balance_due NUMERIC(12, 2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        issued_at TIMESTAMPTZ,
        due_date DATE,
        notes TEXT,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(lease_id, ledger_id, year)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS disputes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reconciliation_statement_id UUID NOT NULL REFERENCES reconciliation_statements(id) ON DELETE CASCADE,
        raised_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        disputed_amount NUMERIC(12, 2),
        status VARCHAR(50) NOT NULL DEFAULT 'open',
        resolution TEXT,
        resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id UUID,
        old_values JSONB,
        new_values JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties(owner_id);
      CREATE INDEX IF NOT EXISTS idx_leases_property_id ON leases(property_id);
      CREATE INDEX IF NOT EXISTS idx_leases_tenant_id ON leases(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_expense_ledgers_property_id ON expense_ledgers(property_id);
      CREATE INDEX IF NOT EXISTS idx_expense_line_items_ledger_id ON expense_line_items(ledger_id);
      CREATE INDEX IF NOT EXISTS idx_cam_pools_ledger_id ON cam_pools(ledger_id);
      CREATE INDEX IF NOT EXISTS idx_allocations_cam_pool_id ON allocations(cam_pool_id);
      CREATE INDEX IF NOT EXISTS idx_allocations_lease_id ON allocations(lease_id);
      CREATE INDEX IF NOT EXISTS idx_reconciliation_statements_lease_id ON reconciliation_statements(lease_id);
      CREATE INDEX IF NOT EXISTS idx_reconciliation_statements_ledger_id ON reconciliation_statements(ledger_id);
      CREATE INDEX IF NOT EXISTS idx_disputes_reconciliation_statement_id ON disputes(reconciliation_statement_id);
      CREATE INDEX IF NOT EXISTS idx_disputes_raised_by ON disputes(raised_by);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_entity_id ON audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    `);

    await client.query("COMMIT");
    console.log("Migration completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
