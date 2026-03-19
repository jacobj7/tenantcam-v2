import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Pool } from "pg";
import { z } from "zod";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const QuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["pending", "reconciled", "disputed", "all"]).default("all"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = (session.user as { tenantId?: string }).tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = {
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
    };

    const parsed = QuerySchema.safeParse(queryParams);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { page, limit, status, startDate, endDate } = parsed.data;
    const offset = (page - 1) * limit;

    const conditions: string[] = ["s.tenant_id = $1"];
    const values: (string | number)[] = [tenantId];
    let paramIndex = 2;

    if (status !== "all") {
      conditions.push(`s.status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`s.statement_date >= $${paramIndex}`);
      values.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`s.statement_date <= $${paramIndex}`);
      values.push(endDate);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countQuery = `
      SELECT COUNT(*) as total
      FROM reconciliation_statements s
      ${whereClause}
    `;

    const dataQuery = `
      SELECT
        s.id,
        s.tenant_id,
        s.statement_date,
        s.status,
        s.total_amount,
        s.reconciled_amount,
        s.discrepancy_amount,
        s.currency,
        s.reference_number,
        s.notes,
        s.created_at,
        s.updated_at,
        COUNT(si.id) as item_count
      FROM reconciliation_statements s
      LEFT JOIN reconciliation_statement_items si ON si.statement_id = s.id
      ${whereClause}
      GROUP BY s.id
      ORDER BY s.statement_date DESC, s.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const paginationValues = [...values, limit, offset];

    const client = await pool.connect();

    try {
      const [countResult, dataResult] = await Promise.all([
        client.query(countQuery, values),
        client.query(dataQuery, paginationValues),
      ]);

      const total = parseInt(countResult.rows[0]?.total ?? "0", 10);
      const totalPages = Math.ceil(total / limit);

      return NextResponse.json({
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching reconciliation statements:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
