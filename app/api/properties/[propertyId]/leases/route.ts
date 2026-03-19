import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createLeaseSchema = z.object({
  tenant_name: z.string().min(1, "Tenant name is required"),
  tenant_email: z.string().email("Valid email is required").optional(),
  tenant_phone: z.string().optional(),
  unit_number: z.string().optional(),
  tenant_sqft: z.number().positive("Tenant square footage must be positive"),
  lease_start_date: z.string().min(1, "Lease start date is required"),
  lease_end_date: z.string().min(1, "Lease end date is required"),
  monthly_rent: z.number().positive("Monthly rent must be positive"),
  security_deposit: z.number().min(0).optional(),
  status: z
    .enum(["active", "pending", "expired", "terminated"])
    .default("active"),
  notes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { propertyId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { propertyId } = params;

    const client = await pool.connect();
    try {
      const propertyResult = await client.query(
        "SELECT id, total_sqft FROM properties WHERE id = $1 AND user_id = $2",
        [propertyId, session.user.id],
      );

      if (propertyResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Property not found" },
          { status: 404 },
        );
      }

      const property = propertyResult.rows[0];

      const leasesResult = await client.query(
        `SELECT 
          l.*,
          CASE 
            WHEN $1::numeric > 0 THEN ROUND((l.tenant_sqft / $1::numeric) * 100, 2)
            ELSE 0
          END as pro_rata_share_percentage,
          CASE 
            WHEN $1::numeric > 0 THEN ROUND((l.tenant_sqft / $1::numeric) * l.monthly_rent, 2)
            ELSE l.monthly_rent
          END as pro_rata_monthly_amount
        FROM leases l
        WHERE l.property_id = $2
        ORDER BY l.created_at DESC`,
        [property.total_sqft || 0, propertyId],
      );

      return NextResponse.json({
        leases: leasesResult.rows,
        property: {
          id: property.id,
          total_sqft: property.total_sqft,
        },
        total: leasesResult.rows.length,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching leases:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { propertyId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { propertyId } = params;

    const body = await request.json();
    const validationResult = createLeaseSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const data = validationResult.data;

    const client = await pool.connect();
    try {
      const propertyResult = await client.query(
        "SELECT id, total_sqft FROM properties WHERE id = $1 AND user_id = $2",
        [propertyId, session.user.id],
      );

      if (propertyResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Property not found" },
          { status: 404 },
        );
      }

      const property = propertyResult.rows[0];
      const totalSqft = property.total_sqft || 0;

      const proRataSharePercentage =
        totalSqft > 0
          ? Math.round((data.tenant_sqft / totalSqft) * 10000) / 100
          : 0;

      const proRataMonthlyAmount =
        totalSqft > 0
          ? Math.round(
              (data.tenant_sqft / totalSqft) * data.monthly_rent * 100,
            ) / 100
          : data.monthly_rent;

      if (data.lease_start_date >= data.lease_end_date) {
        return NextResponse.json(
          { error: "Lease end date must be after start date" },
          { status: 400 },
        );
      }

      const insertResult = await client.query(
        `INSERT INTO leases (
          property_id,
          tenant_name,
          tenant_email,
          tenant_phone,
          unit_number,
          tenant_sqft,
          lease_start_date,
          lease_end_date,
          monthly_rent,
          security_deposit,
          status,
          notes,
          pro_rata_share_percentage,
          pro_rata_monthly_amount,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
        RETURNING *`,
        [
          propertyId,
          data.tenant_name,
          data.tenant_email || null,
          data.tenant_phone || null,
          data.unit_number || null,
          data.tenant_sqft,
          data.lease_start_date,
          data.lease_end_date,
          data.monthly_rent,
          data.security_deposit || 0,
          data.status,
          data.notes || null,
          proRataSharePercentage,
          proRataMonthlyAmount,
        ],
      );

      const newLease = insertResult.rows[0];

      return NextResponse.json(
        {
          lease: newLease,
          pro_rata_calculation: {
            tenant_sqft: data.tenant_sqft,
            total_sqft: totalSqft,
            pro_rata_share_percentage: proRataSharePercentage,
            pro_rata_monthly_amount: proRataMonthlyAmount,
          },
        },
        { status: 201 },
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error creating lease:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
