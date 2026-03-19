import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createPropertySchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip_code: z.string().min(1, "Zip code is required"),
  country: z.string().default("US"),
  property_type: z.enum(["residential", "commercial", "industrial", "mixed"]),
  total_units: z.number().int().positive().optional(),
  description: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  year_built: z.number().int().optional(),
  square_footage: z.number().positive().optional(),
  purchase_price: z.number().positive().optional(),
  current_value: z.number().positive().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "MANAGER") {
      return NextResponse.json(
        { error: "Forbidden: MANAGER role required" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;
    const search = searchParams.get("search") || "";
    const property_type = searchParams.get("property_type") || "";

    let whereClause = "WHERE 1=1";
    const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR address ILIKE $${paramIndex} OR city ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (property_type) {
      whereClause += ` AND property_type = $${paramIndex}`;
      params.push(property_type);
      paramIndex++;
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM properties ${whereClause}`,
      params,
    );

    const total = parseInt(countResult.rows[0].total, 10);

    const propertiesResult = await query(
      `SELECT 
        id,
        name,
        address,
        city,
        state,
        zip_code,
        country,
        property_type,
        total_units,
        description,
        amenities,
        year_built,
        square_footage,
        purchase_price,
        current_value,
        created_at,
        updated_at
      FROM properties 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    return NextResponse.json({
      properties: propertiesResult.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/properties error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "MANAGER") {
      return NextResponse.json(
        { error: "Forbidden: MANAGER role required" },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validationResult = createPropertySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const data = validationResult.data;

    const result = await query(
      `INSERT INTO properties (
        name,
        address,
        city,
        state,
        zip_code,
        country,
        property_type,
        total_units,
        description,
        amenities,
        year_built,
        square_footage,
        purchase_price,
        current_value,
        created_by,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW()
      ) RETURNING *`,
      [
        data.name,
        data.address,
        data.city,
        data.state,
        data.zip_code,
        data.country,
        data.property_type,
        data.total_units ?? null,
        data.description ?? null,
        data.amenities ? JSON.stringify(data.amenities) : null,
        data.year_built ?? null,
        data.square_footage ?? null,
        data.purchase_price ?? null,
        data.current_value ?? null,
        session.user.id,
      ],
    );

    return NextResponse.json({ property: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("POST /api/properties error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
