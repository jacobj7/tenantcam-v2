import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { z } from "zod";

const calculateSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  totalExpenses: z.number().positive(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { propertyId: string } },
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { propertyId } = params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = calculateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { year, totalExpenses } = parsed.data;

  try {
    // Verify the property belongs to the authenticated user (manager)
    const propertyResult = await query(
      `SELECT id, name FROM properties WHERE id = $1 AND manager_id = $2`,
      [propertyId, session.user.id],
    );

    if (propertyResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Property not found or access denied" },
        { status: 404 },
      );
    }

    // Fetch all active leases for this property with their CAM pool data
    const leasesResult = await query(
      `SELECT
        l.id,
        l.tenant_id,
        l.unit_id,
        l.rentable_sqft,
        l.cam_share_pct,
        l.cam_cap_pct,
        l.cam_base_year,
        u.unit_number,
        t.name AS tenant_name
      FROM leases l
      JOIN units u ON u.id = l.unit_id
      JOIN tenants t ON t.id = l.tenant_id
      WHERE u.property_id = $1
        AND l.status = 'active'
        AND l.start_date <= make_date($2, 12, 31)
        AND (l.end_date IS NULL OR l.end_date >= make_date($2, 1, 1))`,
      [propertyId, year],
    );

    const leases = leasesResult.rows;

    if (leases.length === 0) {
      return NextResponse.json(
        { error: "No active leases found for this property in the given year" },
        { status: 404 },
      );
    }

    // Calculate total rentable sqft across all active leases
    const totalRentableSqft = leases.reduce(
      (sum: number, lease: { rentable_sqft: number }) =>
        sum + Number(lease.rentable_sqft),
      0,
    );

    // Calculate each tenant's CAM contribution
    const camAllocations = leases.map(
      (lease: {
        id: string;
        tenant_id: string;
        unit_id: string;
        rentable_sqft: number;
        cam_share_pct: number | null;
        cam_cap_pct: number | null;
        cam_base_year: number | null;
        unit_number: string;
        tenant_name: string;
      }) => {
        const sharePercent =
          lease.cam_share_pct !== null
            ? Number(lease.cam_share_pct)
            : totalRentableSqft > 0
              ? (Number(lease.rentable_sqft) / totalRentableSqft) * 100
              : 0;

        let allocatedAmount = (sharePercent / 100) * totalExpenses;

        // Apply CAM cap if defined
        if (lease.cam_cap_pct !== null && lease.cam_base_year !== null) {
          const yearsElapsed = year - Number(lease.cam_base_year);
          if (yearsElapsed > 0) {
            const capMultiplier = Math.pow(
              1 + Number(lease.cam_cap_pct) / 100,
              yearsElapsed,
            );
            const baseAmount = (sharePercent / 100) * totalExpenses;
            const cappedAmount = baseAmount * capMultiplier;
            allocatedAmount = Math.min(allocatedAmount, cappedAmount);
          }
        }

        return {
          leaseId: lease.id,
          tenantId: lease.tenant_id,
          tenantName: lease.tenant_name,
          unitId: lease.unit_id,
          unitNumber: lease.unit_number,
          rentableSqft: Number(lease.rentable_sqft),
          sharePercent: parseFloat(sharePercent.toFixed(4)),
          allocatedAmount: parseFloat(allocatedAmount.toFixed(2)),
          camCapPct:
            lease.cam_cap_pct !== null ? Number(lease.cam_cap_pct) : null,
          camBaseYear:
            lease.cam_base_year !== null ? Number(lease.cam_base_year) : null,
        };
      },
    );

    const totalAllocated = camAllocations.reduce(
      (sum: number, a: { allocatedAmount: number }) => sum + a.allocatedAmount,
      0,
    );

    return NextResponse.json({
      propertyId,
      propertyName: propertyResult.rows[0].name,
      year,
      totalExpenses,
      totalRentableSqft,
      totalAllocated: parseFloat(totalAllocated.toFixed(2)),
      allocations: camAllocations,
    });
  } catch (error) {
    console.error("CAM pool calculation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
