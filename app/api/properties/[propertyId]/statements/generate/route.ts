import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import React from "react";
import { z } from "zod";

const generateSchema = z.object({
  leaseId: z.string().uuid(),
  periodStart: z.string(),
  periodEnd: z.string(),
  includeCAM: z.boolean().optional().default(false),
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#333333",
  },
  header: {
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#1e3a5f",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#1e3a5f",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  rowAlt: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#f9fafb",
  },
  label: {
    fontSize: 10,
    color: "#374151",
  },
  value: {
    fontSize: 10,
    color: "#374151",
    fontFamily: "Helvetica-Bold",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: "#1e3a5f",
    marginTop: 8,
    borderRadius: 2,
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  totalValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  infoGrid: {
    flexDirection: "row",
    gap: 20,
  },
  infoColumn: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 9,
    color: "#9ca3af",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 10,
    color: "#374151",
    marginBottom: 8,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: "#9ca3af",
  },
  badge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  badgeText: {
    fontSize: 9,
    color: "#166534",
    fontFamily: "Helvetica-Bold",
  },
  dueBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  dueBadgeText: {
    fontSize: 9,
    color: "#92400e",
    fontFamily: "Helvetica-Bold",
  },
});

interface StatementData {
  property: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  tenant: {
    name: string;
    email: string;
  };
  lease: {
    unit_number: string;
    monthly_rent: number;
    lease_start: string;
    lease_end: string;
  };
  charges: Array<{
    description: string;
    amount: number;
    type: string;
  }>;
  camCharges: Array<{
    description: string;
    amount: number;
  }>;
  periodStart: string;
  periodEnd: string;
  statementNumber: string;
  generatedAt: string;
}

function StatementDocument({ data }: { data: StatementData }) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const baseChargesTotal = data.charges.reduce((sum, c) => sum + c.amount, 0);
  const camTotal = data.camCharges.reduce((sum, c) => sum + c.amount, 0);
  const grandTotal = baseChargesTotal + camTotal;

  return React.createElement(
    Document,
    { title: `Statement ${data.statementNumber}` },
    React.createElement(
      Page,
      { size: "LETTER", style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.title }, "Rental Statement"),
        React.createElement(
          Text,
          { style: styles.subtitle },
          `Statement #${data.statementNumber}`,
        ),
      ),

      // Property & Tenant Info
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(
          Text,
          { style: styles.sectionTitle },
          "Statement Information",
        ),
        React.createElement(
          View,
          { style: styles.infoGrid },
          React.createElement(
            View,
            { style: styles.infoColumn },
            React.createElement(Text, { style: styles.infoLabel }, "Property"),
            React.createElement(
              Text,
              { style: styles.infoValue },
              data.property.name,
            ),
            React.createElement(
              Text,
              { style: styles.infoLabel },
              "Property Address",
            ),
            React.createElement(
              Text,
              { style: styles.infoValue },
              `${data.property.address}, ${data.property.city}, ${data.property.state} ${data.property.zip}`,
            ),
            React.createElement(Text, { style: styles.infoLabel }, "Unit"),
            React.createElement(
              Text,
              { style: styles.infoValue },
              data.lease.unit_number,
            ),
          ),
          React.createElement(
            View,
            { style: styles.infoColumn },
            React.createElement(Text, { style: styles.infoLabel }, "Tenant"),
            React.createElement(
              Text,
              { style: styles.infoValue },
              data.tenant.name,
            ),
            React.createElement(
              Text,
              { style: styles.infoLabel },
              "Statement Period",
            ),
            React.createElement(
              Text,
              { style: styles.infoValue },
              `${formatDate(data.periodStart)} – ${formatDate(data.periodEnd)}`,
            ),
            React.createElement(
              Text,
              { style: styles.infoLabel },
              "Generated On",
            ),
            React.createElement(
              Text,
              { style: styles.infoValue },
              formatDate(data.generatedAt),
            ),
          ),
        ),
      ),

      // Lease Details
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(
          Text,
          { style: styles.sectionTitle },
          "Lease Details",
        ),
        React.createElement(
          View,
          { style: styles.rowAlt },
          React.createElement(
            Text,
            { style: styles.label },
            "Lease Start Date",
          ),
          React.createElement(
            Text,
            { style: styles.value },
            formatDate(data.lease.lease_start),
          ),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, "Lease End Date"),
          React.createElement(
            Text,
            { style: styles.value },
            formatDate(data.lease.lease_end),
          ),
        ),
        React.createElement(
          View,
          { style: styles.rowAlt },
          React.createElement(
            Text,
            { style: styles.label },
            "Monthly Base Rent",
          ),
          React.createElement(
            Text,
            { style: styles.value },
            formatCurrency(data.lease.monthly_rent),
          ),
        ),
      ),

      // Charges
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(
          Text,
          { style: styles.sectionTitle },
          "Charges for Period",
        ),
        ...data.charges.map((charge, i) =>
          React.createElement(
            View,
            {
              key: `charge-${i}`,
              style: i % 2 === 0 ? styles.rowAlt : styles.row,
            },
            React.createElement(
              Text,
              { style: styles.label },
              charge.description,
            ),
            React.createElement(
              Text,
              { style: styles.value },
              formatCurrency(charge.amount),
            ),
          ),
        ),
      ),

      // CAM Charges (if any)
      ...(data.camCharges.length > 0
        ? [
            React.createElement(
              View,
              { style: styles.section },
              React.createElement(
                Text,
                { style: styles.sectionTitle },
                "CAM Charges",
              ),
              ...data.camCharges.map((charge, i) =>
                React.createElement(
                  View,
                  {
                    key: `cam-${i}`,
                    style: i % 2 === 0 ? styles.rowAlt : styles.row,
                  },
                  React.createElement(
                    Text,
                    { style: styles.label },
                    charge.description,
                  ),
                  React.createElement(
                    Text,
                    { style: styles.value },
                    formatCurrency(charge.amount),
                  ),
                ),
              ),
            ),
          ]
        : []),

      // Total
      React.createElement(
        View,
        { style: styles.totalRow },
        React.createElement(
          Text,
          { style: styles.totalLabel },
          "Total Amount Due",
        ),
        React.createElement(
          Text,
          { style: styles.totalValue },
          formatCurrency(grandTotal),
        ),
      ),

      // Footer
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(
          Text,
          { style: styles.footerText },
          `${data.property.name} — ${data.property.address}, ${data.property.city}, ${data.property.state} ${data.property.zip}`,
        ),
        React.createElement(
          Text,
          { style: styles.footerText },
          `Statement #${data.statementNumber} | Generated ${formatDate(data.generatedAt)}`,
        ),
      ),
    ),
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: { propertyId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { leaseId, periodStart, periodEnd, includeCAM } = parsed.data;
    const { propertyId } = params;

    // Verify property ownership
    const propertyResult = await db.query(
      `SELECT p.id, p.name, p.address, p.city, p.state, p.zip
       FROM properties p
       WHERE p.id = $1 AND p.manager_id = $2`,
      [propertyId, session.user.id],
    );

    if (propertyResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Property not found or access denied" },
        { status: 404 },
      );
    }

    const property = propertyResult.rows[0];

    // Get lease and tenant info
    const leaseResult = await db.query(
      `SELECT l.id, l.unit_number, l.monthly_rent, l.lease_start, l.lease_end,
              u.id as tenant_id, u.name as tenant_name, u.email as tenant_email
       FROM leases l
       JOIN users u ON l.tenant_id = u.id
       WHERE l.id = $1 AND l.property_id = $2`,
      [leaseId, propertyId],
    );

    if (leaseResult.rows.length === 0) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    const lease = leaseResult.rows[0];

    // Get charges for the period
    const chargesResult = await db.query(
      `SELECT description, amount, charge_type as type
       FROM charges
       WHERE lease_id = $1
         AND charge_date >= $2
         AND charge_date <= $3
       ORDER BY charge_date ASC`,
      [leaseId, periodStart, periodEnd],
    );

    // If no charges found, create a default rent charge
    let charges = chargesResult.rows;
    if (charges.length === 0) {
      charges = [
        {
          description: "Monthly Rent",
          amount: parseFloat(lease.monthly_rent),
          type: "rent",
        },
      ];
    }

    // Get CAM charges if requested
    let camCharges: Array<{ description: string; amount: number }> = [];
    if (includeCAM) {
      const camResult = await db.query(
        `SELECT cc.description, cc.tenant_share as amount
         FROM cam_charges cc
         JOIN cam_pools cp ON cc.cam_pool_id = cp.id
         WHERE cp.property_id = $1
           AND cc.lease_id = $2
           AND cc.period_start >= $3
           AND cc.period_end <= $4
         ORDER BY cc.created_at ASC`,
        [propertyId, leaseId, periodStart, periodEnd],
      );
      camCharges = camResult.rows;
    }

    // Generate statement number
    const statementNumber = `STMT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const generatedAt = new Date().toISOString().split("T")[0];

    const statementData: StatementData = {
      property: {
        name: property.name,
        address: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
      },
      tenant: {
        name: lease.tenant_name,
        email: lease.tenant_email,
      },
      lease: {
        unit_number: lease.unit_number,
        monthly_rent: parseFloat(lease.monthly_rent),
        lease_start: lease.lease_start,
        lease_end: lease.lease_end,
      },
      charges,
      camCharges,
      periodStart,
      periodEnd,
      statementNumber,
      generatedAt,
    };

    // Render PDF using @react-pdf/renderer
    const pdfBuffer = await renderToBuffer(
      React.createElement(StatementDocument, { data: statementData }),
    );

    // Save statement record to database
    await db.query(
      `INSERT INTO statements (
         id, property_id, lease_id, tenant_id, statement_number,
         period_start, period_end, total_amount, generated_at, generated_by
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), $8
       )
       ON CONFLICT (statement_number) DO NOTHING`,
      [
        propertyId,
        leaseId,
        lease.tenant_id,
        statementNumber,
        periodStart,
        periodEnd,
        charges.reduce(
          (sum: number, c: { amount: number }) => sum + c.amount,
          0,
        ) + camCharges.reduce((sum, c) => sum + c.amount, 0),
        session.user.id,
      ],
    );

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="statement-${statementNumber}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error generating statement PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate statement" },
      { status: 500 },
    );
  }
}
