import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import pg from "pg";

const { Pool } = pg;

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const CalculateRequestSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12).optional(),
  pool_name: z.string().optional(),
  recalculate: z.boolean().optional().default(false),
});

interface ExpenseLineItem {
  id: string;
  property_id: string;
  amount: number;
  category: string;
  description: string;
  expense_date: string;
  cam_eligible: boolean;
  cam_pool_id: string | null;
}

interface Tenant {
  id: string;
  property_id: string;
  name: string;
  unit_id: string;
  lease_start: string;
  lease_end: string;
  rentable_area: number;
  pro_rata_share: number | null;
}

interface CamPool {
  id: string;
  property_id: string;
  name: string;
  year: number;
  month: number | null;
  total_expenses: number;
  total_rentable_area: number;
  status: string;
}

interface AllocationResult {
  tenant_id: string;
  tenant_name: string;
  rentable_area: number;
  pro_rata_share: number;
  allocated_amount: number;
  cam_pool_id: string;
}

async function computeCamAllocations(
  expenses: ExpenseLineItem[],
  tenants: Tenant[],
  propertyId: string,
  year: number,
  month: number | null,
  poolName: string,
): Promise<{
  totalExpenses: number;
  totalRentableArea: number;
  allocations: AllocationResult[];
  camPool: Partial<CamPool>;
}> {
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const activeTenants = tenants.filter((t) => {
    const leaseStart = new Date(t.lease_start);
    const leaseEnd = new Date(t.lease_end);
    const periodStart = month
      ? new Date(year, month - 1, 1)
      : new Date(year, 0, 1);
    const periodEnd = month ? new Date(year, month, 0) : new Date(year, 11, 31);

    return leaseStart <= periodEnd && leaseEnd >= periodStart;
  });

  const totalRentableArea = activeTenants.reduce(
    (sum, t) => sum + Number(t.rentable_area),
    0,
  );

  const allocations: AllocationResult[] = activeTenants.map((tenant) => {
    const proRataShare =
      totalRentableArea > 0
        ? Number(tenant.rentable_area) / totalRentableArea
        : 0;
    const allocatedAmount = totalExpenses * proRataShare;

    return {
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      rentable_area: Number(tenant.rentable_area),
      pro_rata_share: proRataShare,
      allocated_amount: allocatedAmount,
      cam_pool_id: "",
    };
  });

  const camPool: Partial<CamPool> = {
    property_id: propertyId,
    name: poolName,
    year,
    month: month ?? null,
    total_expenses: totalExpenses,
    total_rentable_area: totalRentableArea,
    status: "calculated",
  };

  return { totalExpenses, totalRentableArea, allocations, camPool };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { propertyId: string } },
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { propertyId } = params;

  if (!propertyId) {
    return NextResponse.json(
      { error: "Property ID is required" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = CalculateRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.flatten() },
      { status: 422 },
    );
  }

  const { year, month, pool_name, recalculate } = parseResult.data;
  const poolName =
    pool_name ||
    (month
      ? `CAM Pool ${year}-${String(month).padStart(2, "0")}`
      : `CAM Pool ${year}`);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const propertyCheck = await client.query(
      "SELECT id FROM properties WHERE id = $1",
      [propertyId],
    );

    if (propertyCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 },
      );
    }

    const existingPoolQuery = month
      ? await client.query(
          "SELECT id, status FROM cam_pools WHERE property_id = $1 AND year = $2 AND month = $3",
          [propertyId, year, month],
        )
      : await client.query(
          "SELECT id, status FROM cam_pools WHERE property_id = $1 AND year = $2 AND month IS NULL",
          [propertyId, year],
        );

    if (existingPoolQuery.rows.length > 0 && !recalculate) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error:
            "CAM pool already exists for this period. Use recalculate=true to override.",
          existing_pool_id: existingPoolQuery.rows[0].id,
        },
        { status: 409 },
      );
    }

    const expensesResult = await client.query<ExpenseLineItem>(
      `SELECT id, property_id, amount, category, description, expense_date, cam_eligible, cam_pool_id
       FROM expense_line_items
       WHERE property_id = $1
         AND cam_eligible = true
         AND EXTRACT(YEAR FROM expense_date) = $2
         ${month ? "AND EXTRACT(MONTH FROM expense_date) = $3" : ""}
       ORDER BY expense_date ASC`,
      month ? [propertyId, year, month] : [propertyId, year],
    );

    const expenses = expensesResult.rows;

    if (expenses.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "No CAM-eligible expenses found for the specified period",
          year,
          month: month ?? null,
        },
        { status: 404 },
      );
    }

    const tenantsResult = await client.query<Tenant>(
      `SELECT t.id, t.property_id, t.name, t.unit_id, t.lease_start, t.lease_end,
              u.rentable_area, t.pro_rata_share
       FROM tenants t
       JOIN units u ON t.unit_id = u.id
       WHERE t.property_id = $1
         AND t.lease_start IS NOT NULL
         AND t.lease_end IS NOT NULL
       ORDER BY t.name ASC`,
      [propertyId],
    );

    const tenants = tenantsResult.rows;

    if (tenants.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "No tenants found for this property" },
        { status: 404 },
      );
    }

    const { totalExpenses, totalRentableArea, allocations, camPool } =
      await computeCamAllocations(
        expenses,
        tenants,
        propertyId,
        year,
        month ?? null,
        poolName,
      );

    let camPoolId: string;

    if (existingPoolQuery.rows.length > 0 && recalculate) {
      const existingId = existingPoolQuery.rows[0].id;

      await client.query(
        `UPDATE cam_pools
         SET name = $1, total_expenses = $2, total_rentable_area = $3,
             status = $4, updated_at = NOW()
         WHERE id = $5`,
        [
          camPool.name,
          camPool.total_expenses,
          camPool.total_rentable_area,
          camPool.status,
          existingId,
        ],
      );

      await client.query("DELETE FROM allocations WHERE cam_pool_id = $1", [
        existingId,
      ]);

      camPoolId = existingId;
    } else {
      const insertPoolResult = await client.query<{ id: string }>(
        `INSERT INTO cam_pools (property_id, name, year, month, total_expenses, total_rentable_area, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING id`,
        [
          propertyId,
          camPool.name,
          camPool.year,
          camPool.month,
          camPool.total_expenses,
          camPool.total_rentable_area,
          camPool.status,
        ],
      );

      camPoolId = insertPoolResult.rows[0].id;
    }

    const insertedAllocations: AllocationResult[] = [];

    for (const allocation of allocations) {
      allocation.cam_pool_id = camPoolId;

      await client.query(
        `INSERT INTO allocations (cam_pool_id, tenant_id, rentable_area, pro_rata_share, allocated_amount, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [
          camPoolId,
          allocation.tenant_id,
          allocation.rentable_area,
          allocation.pro_rata_share,
          allocation.allocated_amount,
        ],
      );

      insertedAllocations.push(allocation);
    }

    await client.query(
      `UPDATE expense_line_items
       SET cam_pool_id = $1, updated_at = NOW()
       WHERE property_id = $2
         AND cam_eligible = true
         AND EXTRACT(YEAR FROM expense_date) = $3
         ${month ? "AND EXTRACT(MONTH FROM expense_date) = $4" : ""}`,
      month
        ? [camPoolId, propertyId, year, month]
        : [camPoolId, propertyId, year],
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        cam_pool: {
          id: camPoolId,
          property_id: propertyId,
          name: poolName,
          year,
          month: month ?? null,
          total_expenses: totalExpenses,
          total_rentable_area: totalRentableArea,
          status: "calculated",
          expense_count: expenses.length,
          tenant_count: allocations.length,
        },
        allocations: insertedAllocations.map((a) => ({
          tenant_id: a.tenant_id,
          tenant_name: a.tenant_name,
          rentable_area: a.rentable_area,
          pro_rata_share: Number((a.pro_rata_share * 100).toFixed(4)),
          allocated_amount: Number(a.allocated_amount.toFixed(2)),
        })),
        summary: {
          total_expenses: Number(totalExpenses.toFixed(2)),
          total_rentable_area: totalRentableArea,
          total_allocated: Number(
            insertedAllocations
              .reduce((sum, a) => sum + a.allocated_amount, 0)
              .toFixed(2),
          ),
          tenant_count: insertedAllocations.length,
          expense_count: expenses.length,
        },
      },
      { status: existingPoolQuery.rows.length > 0 ? 200 : 201 },
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("CAM pool calculation error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Internal server error", message: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
