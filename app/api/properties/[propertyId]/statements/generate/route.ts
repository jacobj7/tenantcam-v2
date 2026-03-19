import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { put } from "@vercel/blob";
import { z } from "zod";

export const dynamic = "force-dynamic";

const generateStatementsSchema = z.object({
  period_start: z.string().min(1, "Period start is required"),
  period_end: z.string().min(1, "Period end is required"),
  statement_type: z
    .enum(["monthly", "quarterly", "annual", "custom"])
    .optional()
    .default("monthly"),
  include_charges: z.boolean().optional().default(true),
  include_payments: z.boolean().optional().default(true),
  include_balance: z.boolean().optional().default(true),
});

interface Tenant {
  tenant_id: string;
  tenant_name: string;
  tenant_email: string;
  unit_number: string;
  lease_id: string;
  monthly_rent: number;
}

interface Charge {
  charge_id: string;
  tenant_id: string;
  charge_date: string;
  charge_type: string;
  amount: number;
  description: string;
  status: string;
}

interface Payment {
  payment_id: string;
  tenant_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string;
}

interface Property {
  property_id: string;
  property_name: string;
  address: string;
  owner_name: string;
}

function generatePDFContent(
  tenant: Tenant,
  property: Property,
  charges: Charge[],
  payments: Payment[],
  periodStart: string,
  periodEnd: string,
  statementType: string,
  includeCharges: boolean,
  includePayments: boolean,
  includeBalance: boolean,
): Buffer {
  const totalCharges = charges.reduce((sum, c) => sum + Number(c.amount), 0);
  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = totalCharges - totalPayments;

  const lines: string[] = [];
  lines.push(`%PDF-1.4`);
  lines.push(`1 0 obj`);
  lines.push(`<< /Type /Catalog /Pages 2 0 R >>`);
  lines.push(`endobj`);
  lines.push(`2 0 obj`);
  lines.push(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);
  lines.push(`endobj`);

  const contentLines: string[] = [];
  contentLines.push(`BT`);
  contentLines.push(`/F1 18 Tf`);
  contentLines.push(`50 780 Td`);
  contentLines.push(`(TENANT STATEMENT) Tj`);
  contentLines.push(`/F1 12 Tf`);
  contentLines.push(`0 -30 Td`);
  contentLines.push(`(Property: ${property.property_name}) Tj`);
  contentLines.push(`0 -20 Td`);
  contentLines.push(`(Address: ${property.address}) Tj`);
  contentLines.push(`0 -20 Td`);
  contentLines.push(`(Tenant: ${tenant.tenant_name}) Tj`);
  contentLines.push(`0 -20 Td`);
  contentLines.push(`(Unit: ${tenant.unit_number}) Tj`);
  contentLines.push(`0 -20 Td`);
  contentLines.push(`(Email: ${tenant.tenant_email}) Tj`);
  contentLines.push(`0 -20 Td`);
  contentLines.push(`(Statement Period: ${periodStart} to ${periodEnd}) Tj`);
  contentLines.push(`0 -20 Td`);
  contentLines.push(`(Statement Type: ${statementType}) Tj`);
  contentLines.push(`0 -20 Td`);
  contentLines.push(
    `(Monthly Rent: $${Number(tenant.monthly_rent).toFixed(2)}) Tj`,
  );

  if (includeCharges && charges.length > 0) {
    contentLines.push(`0 -30 Td`);
    contentLines.push(`/F1 14 Tf`);
    contentLines.push(`(CHARGES) Tj`);
    contentLines.push(`/F1 11 Tf`);
    charges.forEach((charge) => {
      contentLines.push(`0 -20 Td`);
      contentLines.push(
        `(${charge.charge_date} - ${charge.charge_type}: $${Number(charge.amount).toFixed(2)} - ${charge.description} [${charge.status}]) Tj`,
      );
    });
    contentLines.push(`0 -20 Td`);
    contentLines.push(`(Total Charges: $${totalCharges.toFixed(2)}) Tj`);
  }

  if (includePayments && payments.length > 0) {
    contentLines.push(`0 -30 Td`);
    contentLines.push(`/F1 14 Tf`);
    contentLines.push(`(PAYMENTS) Tj`);
    contentLines.push(`/F1 11 Tf`);
    payments.forEach((payment) => {
      contentLines.push(`0 -20 Td`);
      contentLines.push(
        `(${payment.payment_date} - ${payment.payment_method}: $${Number(payment.amount).toFixed(2)} Ref: ${payment.reference_number}) Tj`,
      );
    });
    contentLines.push(`0 -20 Td`);
    contentLines.push(`(Total Payments: $${totalPayments.toFixed(2)}) Tj`);
  }

  if (includeBalance) {
    contentLines.push(`0 -30 Td`);
    contentLines.push(`/F1 14 Tf`);
    contentLines.push(`(BALANCE SUMMARY) Tj`);
    contentLines.push(`/F1 12 Tf`);
    contentLines.push(`0 -20 Td`);
    contentLines.push(`(Total Charges: $${totalCharges.toFixed(2)}) Tj`);
    contentLines.push(`0 -20 Td`);
    contentLines.push(`(Total Payments: $${totalPayments.toFixed(2)}) Tj`);
    contentLines.push(`0 -20 Td`);
    contentLines.push(`(Balance Due: $${balance.toFixed(2)}) Tj`);
  }

  contentLines.push(`ET`);

  const streamContent = contentLines.join("\n");

  lines.push(`3 0 obj`);
  lines.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]`);
  lines.push(`/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`);
  lines.push(`endobj`);
  lines.push(`4 0 obj`);
  lines.push(`<< /Length ${streamContent.length} >>`);
  lines.push(`stream`);
  lines.push(streamContent);
  lines.push(`endstream`);
  lines.push(`endobj`);
  lines.push(`5 0 obj`);
  lines.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);
  lines.push(`endobj`);
  lines.push(`xref`);
  lines.push(`0 6`);
  lines.push(`0000000000 65535 f`);
  lines.push(`trailer`);
  lines.push(`<< /Size 6 /Root 1 0 R >>`);
  lines.push(`startxref`);
  lines.push(`0`);
  lines.push(`%%EOF`);

  return Buffer.from(lines.join("\n"), "utf-8");
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

    if (!propertyId) {
      return NextResponse.json(
        { error: "Property ID is required" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validationResult = generateStatementsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const {
      period_start,
      period_end,
      statement_type,
      include_charges,
      include_payments,
      include_balance,
    } = validationResult.data;

    // Verify property exists and user has access
    const propertyResult = await db.query(
      `SELECT p.property_id, p.property_name, p.address, 
              COALESCE(u.name, u.email) as owner_name
       FROM properties p
       LEFT JOIN users u ON p.owner_id = u.id
       WHERE p.property_id = $1 AND p.owner_id = $2`,
      [propertyId, session.user.id],
    );

    if (propertyResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Property not found or access denied" },
        { status: 404 },
      );
    }

    const property: Property = propertyResult.rows[0];

    // Get all active tenants for this property
    const tenantsResult = await db.query(
      `SELECT t.tenant_id, t.name as tenant_name, t.email as tenant_email,
              u.unit_number, l.lease_id, l.monthly_rent
       FROM tenants t
       JOIN leases l ON t.tenant_id = l.tenant_id
       JOIN units u ON l.unit_id = u.unit_id
       WHERE u.property_id = $1 
         AND l.status = 'active'
         AND l.start_date <= $2
         AND (l.end_date IS NULL OR l.end_date >= $3)`,
      [propertyId, period_end, period_start],
    );

    if (tenantsResult.rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No active tenants found for this property in the specified period",
        },
        { status: 404 },
      );
    }

    const tenants: Tenant[] = tenantsResult.rows;
    const generatedStatements: Array<{
      tenant_id: string;
      tenant_name: string;
      statement_id: string;
      blob_url: string;
      total_charges: number;
      total_payments: number;
      balance: number;
    }> = [];

    const anthropic = new Anthropic();

    for (const tenant of tenants) {
      // Get charges for this tenant in the period
      const chargesResult = await db.query(
        `SELECT charge_id, tenant_id, charge_date::text, charge_type, 
                amount, description, status
         FROM charges
         WHERE tenant_id = $1
           AND charge_date >= $2
           AND charge_date <= $3
         ORDER BY charge_date ASC`,
        [tenant.tenant_id, period_start, period_end],
      );

      // Get payments for this tenant in the period
      const paymentsResult = await db.query(
        `SELECT payment_id, tenant_id, payment_date::text, amount, 
                payment_method, COALESCE(reference_number, '') as reference_number
         FROM payments
         WHERE tenant_id = $1
           AND payment_date >= $2
           AND payment_date <= $3
         ORDER BY payment_date ASC`,
        [tenant.tenant_id, period_start, period_end],
      );

      const charges: Charge[] = chargesResult.rows;
      const payments: Payment[] = paymentsResult.rows;

      const totalCharges = charges.reduce(
        (sum, c) => sum + Number(c.amount),
        0,
      );
      const totalPayments = payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );
      const balance = totalCharges - totalPayments;

      // Use Anthropic to generate a summary/notes for the statement
      let statementNotes = "";
      try {
        const aiResponse = await anthropic.messages.create({
          model: "claude-opus-4-5",
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: `Generate a brief, professional statement summary note for a tenant statement with the following details:
              - Tenant: ${tenant.tenant_name}
              - Period: ${period_start} to ${period_end}
              - Total Charges: $${totalCharges.toFixed(2)}
              - Total Payments: $${totalPayments.toFixed(2)}
              - Balance Due: $${balance.toFixed(2)}
              - Number of charges: ${charges.length}
              - Number of payments: ${payments.length}
              
              Keep it to 2-3 sentences, professional and informative.`,
            },
          ],
        });

        const textContent = aiResponse.content.find((c) => c.type === "text");
        if (textContent && textContent.type === "text") {
          statementNotes = textContent.text;
        }
      } catch (aiError) {
        console.error("AI summary generation failed:", aiError);
        statementNotes = `Statement for ${tenant.tenant_name} covering ${period_start} to ${period_end}.`;
      }

      // Generate PDF
      const pdfBuffer = generatePDFContent(
        tenant,
        property,
        charges,
        payments,
        period_start,
        period_end,
        statement_type,
        include_charges,
        include_payments,
        include_balance,
      );

      // Upload to Vercel Blob
      const fileName = `statements/${propertyId}/${tenant.tenant_id}/${statement_type}_${period_start}_${period_end}_${Date.now()}.pdf`;

      const blob = await put(fileName, pdfBuffer, {
        access: "public",
        contentType: "application/pdf",
      });

      // Insert record into reconciliation_statements table
      const statementResult = await db.query(
        `INSERT INTO reconciliation_statements (
          property_id,
          tenant_id,
          lease_id,
          period_start,
          period_end,
          statement_type,
          total_charges,
          total_payments,
          balance,
          blob_url,
          notes,
          generated_by,
          generated_at,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13)
        RETURNING statement_id`,
        [
          propertyId,
          tenant.tenant_id,
          tenant.lease_id,
          period_start,
          period_end,
          statement_type,
          totalCharges,
          totalPayments,
          balance,
          blob.url,
          statementNotes,
          session.user.id,
          "generated",
        ],
      );

      const statementId = statementResult.rows[0].statement_id;

      generatedStatements.push({
        tenant_id: tenant.tenant_id,
        tenant_name: tenant.tenant_name,
        statement_id: statementId,
        blob_url: blob.url,
        total_charges: totalCharges,
        total_payments: totalPayments,
        balance: balance,
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: `Successfully generated ${generatedStatements.length} statement(s)`,
        property: {
          property_id: property.property_id,
          property_name: property.property_name,
        },
        period: {
          start: period_start,
          end: period_end,
          type: statement_type,
        },
        statements: generatedStatements,
        total_generated: generatedStatements.length,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error generating statements:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to generate statements",
      },
      { status: 500 },
    );
  }
}
