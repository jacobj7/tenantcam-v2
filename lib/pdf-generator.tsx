import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

Font.register({
  family: "Helvetica",
  fonts: [],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 50,
    backgroundColor: "#ffffff",
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#1e3a5f",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#4b5563",
    marginBottom: 2,
  },
  headerMeta: {
    fontSize: 9,
    color: "#6b7280",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1e3a5f",
    backgroundColor: "#eff6ff",
    padding: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#2563eb",
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  labelCell: {
    width: "40%",
    color: "#4b5563",
  },
  valueCell: {
    width: "60%",
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  table: {
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1e3a5f",
    padding: 6,
    marginBottom: 2,
  },
  tableHeaderCell: {
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    padding: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableRowAlt: {
    flexDirection: "row",
    padding: 5,
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableCell: {
    fontSize: 9,
    color: "#374151",
  },
  tableCellRight: {
    fontSize: 9,
    color: "#374151",
    textAlign: "right",
  },
  col10: { width: "10%" },
  col15: { width: "15%" },
  col20: { width: "20%" },
  col25: { width: "25%" },
  col30: { width: "30%" },
  col35: { width: "35%" },
  col40: { width: "40%" },
  col50: { width: "50%" },
  col60: { width: "60%" },
  summaryBox: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 4,
    padding: 12,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 10,
    color: "#4b5563",
  },
  summaryValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  summaryDivider: {
    borderTopWidth: 1,
    borderTopColor: "#93c5fd",
    marginVertical: 6,
  },
  summaryTotalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1e3a5f",
  },
  summaryTotalValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#2563eb",
  },
  balanceDue: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: 4,
    padding: 12,
    marginTop: 8,
  },
  balanceCredit: {
    backgroundColor: "#d1fae5",
    borderWidth: 1,
    borderColor: "#6ee7b7",
    borderRadius: 4,
    padding: 12,
    marginTop: 8,
  },
  balanceLabel: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#92400e",
  },
  balanceLabelCredit: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#065f46",
  },
  balanceValue: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#b45309",
    textAlign: "right",
  },
  balanceValueCredit: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#047857",
    textAlign: "right",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
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
  notesBox: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 10,
    marginTop: 8,
  },
  notesText: {
    fontSize: 9,
    color: "#4b5563",
    lineHeight: 1.5,
  },
  twoColumn: {
    flexDirection: "row",
    gap: 16,
  },
  halfColumn: {
    width: "50%",
  },
  badge: {
    backgroundColor: "#dbeafe",
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 8,
    color: "#1d4ed8",
    fontFamily: "Helvetica-Bold",
  },
});

export interface CAMExpenseLineItem {
  category: string;
  description: string;
  totalAmount: number;
  tenantShare: number;
  tenantAmount: number;
}

export interface CAMReconciliationData {
  statementId: string;
  generatedAt: string;
  reconciliationYear: number;
  property: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    totalLeasableArea: number;
    managementCompany?: string;
    contactEmail?: string;
    contactPhone?: string;
  };
  tenant: {
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
  };
  lease: {
    leaseId: string;
    suiteNumber: string;
    leasedArea: number;
    leaseStartDate: string;
    leaseEndDate: string;
    proRataShare: number;
    camEstimateMonthly: number;
    camEstimateAnnual: number;
  };
  expenses: CAMExpenseLineItem[];
  summary: {
    totalActualCAMExpenses: number;
    tenantProRataShare: number;
    tenantActualCAMObligation: number;
    totalEstimatedPayments: number;
    balanceDue: number;
    isCredit: boolean;
  };
  notes?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(4)}%`;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

interface CAMStatementDocumentProps {
  data: CAMReconciliationData;
}

export const CAMStatementDocument: React.FC<CAMStatementDocumentProps> = ({
  data,
}) => {
  const { property, tenant, lease, expenses, summary, notes } = data;

  return (
    <Document
      title={`CAM Reconciliation Statement - ${tenant.name} - ${data.reconciliationYear}`}
      author={property.managementCompany || property.name}
      subject="CAM Reconciliation Statement"
      creator="CAM Reconciliation System"
    >
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>CAM Reconciliation Statement</Text>
          <Text style={styles.headerSubtitle}>
            Reconciliation Year: {data.reconciliationYear}
          </Text>
          <Text style={styles.headerMeta}>
            Statement ID: {data.statementId} | Generated:{" "}
            {formatDate(data.generatedAt)}
          </Text>
        </View>

        {/* Property & Tenant Info */}
        <View style={styles.twoColumn}>
          {/* Property Info */}
          <View style={[styles.section, styles.halfColumn]}>
            <Text style={styles.sectionTitle}>Property Information</Text>
            <View style={styles.row}>
              <Text style={styles.labelCell}>Property Name:</Text>
              <Text style={styles.valueCell}>{property.name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.labelCell}>Address:</Text>
              <Text style={styles.valueCell}>{property.address}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.labelCell}>City/State/Zip:</Text>
              <Text style={styles.valueCell}>
                {property.city}, {property.state} {property.zip}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.labelCell}>Total Leasable Area:</Text>
              <Text style={styles.valueCell}>
                {formatNumber(property.totalLeasableArea)} sq ft
              </Text>
            </View>
            {property.managementCompany && (
              <View style={styles.row}>
                <Text style={styles.labelCell}>Management:</Text>
                <Text style={styles.valueCell}>
                  {property.managementCompany}
                </Text>
              </View>
            )}
            {property.contactEmail && (
              <View style={styles.row}>
                <Text style={styles.labelCell}>Contact Email:</Text>
                <Text style={styles.valueCell}>{property.contactEmail}</Text>
              </View>
            )}
            {property.contactPhone && (
              <View style={styles.row}>
                <Text style={styles.labelCell}>Contact Phone:</Text>
                <Text style={styles.valueCell}>{property.contactPhone}</Text>
              </View>
            )}
          </View>

          {/* Tenant Info */}
          <View style={[styles.section, styles.halfColumn]}>
            <Text style={styles.sectionTitle}>Tenant Information</Text>
            <View style={styles.row}>
              <Text style={styles.labelCell}>Tenant Name:</Text>
              <Text style={styles.valueCell}>{tenant.name}</Text>
            </View>
            {tenant.contactName && (
              <View style={styles.row}>
                <Text style={styles.labelCell}>Contact:</Text>
                <Text style={styles.valueCell}>{tenant.contactName}</Text>
              </View>
            )}
            {tenant.email && (
              <View style={styles.row}>
                <Text style={styles.labelCell}>Email:</Text>
                <Text style={styles.valueCell}>{tenant.email}</Text>
              </View>
            )}
            {tenant.phone && (
              <View style={styles.row}>
                <Text style={styles.labelCell}>Phone:</Text>
                <Text style={styles.valueCell}>{tenant.phone}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Lease Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lease Details</Text>
          <View style={styles.twoColumn}>
            <View style={styles.halfColumn}>
              <View style={styles.row}>
                <Text style={styles.labelCell}>Lease ID:</Text>
                <Text style={styles.valueCell}>{lease.leaseId}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.labelCell}>Suite Number:</Text>
                <Text style={styles.valueCell}>{lease.suiteNumber}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.labelCell}>Leased Area:</Text>
                <Text style={styles.valueCell}>
                  {formatNumber(lease.leasedArea)} sq ft
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.labelCell}>Pro-Rata Share:</Text>
                <Text style={styles.valueCell}>
                  {formatPercent(lease.proRataShare)}
                </Text>
              </View>
            </View>
            <View style={styles.halfColumn}>
              <View style={styles.row}>
                <Text style={styles.labelCell}>Lease Start:</Text>
                <Text style={styles.valueCell}>
                  {formatDate(lease.leaseStartDate)}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.labelCell}>Lease End:</Text>
                <Text style={styles.valueCell}>
                  {formatDate(lease.leaseEndDate)}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.labelCell}>Monthly CAM Est.:</Text>
                <Text style={styles.valueCell}>
                  {formatCurrency(lease.camEstimateMonthly)}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.labelCell}>Annual CAM Est.:</Text>
                <Text style={styles.valueCell}>
                  {formatCurrency(lease.camEstimateAnnual)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* CAM Expense Detail */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CAM Expense Detail</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.col25]}>
                Category
              </Text>
              <Text style={[styles.tableHeaderCell, styles.col35]}>
                Description
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  styles.col15,
                  { textAlign: "right" },
                ]}
              >
                Total Amount
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  styles.col10,
                  { textAlign: "right" },
                ]}
              >
                Share %
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  styles.col15,
                  { textAlign: "right" },
                ]}
              >
                Tenant Amount
              </Text>
            </View>
            {expenses.map((expense, index) => (
              <View
                key={index}
                style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
              >
                <Text style={[styles.tableCell, styles.col25]}>
                  {expense.category}
                </Text>
                <Text style={[styles.tableCell, styles.col35]}>
                  {expense.description}
                </Text>
                <Text style={[styles.tableCellRight, styles.col15]}>
                  {formatCurrency(expense.totalAmount)}
                </Text>
                <Text style={[styles.tableCellRight, styles.col10]}>
                  {(expense.tenantShare * 100).toFixed(2)}%
                </Text>
                <Text style={[styles.tableCellRight, styles.col15]}>
                  {formatCurrency(expense.tenantAmount)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Reconciliation Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reconciliation Summary</Text>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Total Actual CAM Expenses:
              </Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(summary.totalActualCAMExpenses)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Tenant Pro-Rata Share (
                {formatPercent(summary.tenantProRataShare)}):
              </Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(summary.tenantActualCAMObligation)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Total Estimated Payments Made:
              </Text>
              <Text style={styles.summaryValue}>
                ({formatCurrency(summary.totalEstimatedPayments)})
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>
                {summary.isCredit ? "Credit to Tenant:" : "Balance Due:"}
              </Text>
              <Text style={styles.summaryTotalValue}>
                {formatCurrency(Math.abs(summary.balanceDue))}
              </Text>
            </View>
          </View>

          {/* Balance Due / Credit Box */}
          {summary.isCredit ? (
            <View style={styles.balanceCredit}>
              <View style={styles.summaryRow}>
                <Text style={styles.balanceLabelCredit}>CREDIT TO TENANT</Text>
                <Text style={styles.balanceValueCredit}>
                  {formatCurrency(Math.abs(summary.balanceDue))}
                </Text>
              </View>
              <Text style={[styles.notesText, { marginTop: 4 }]}>
                A credit of {formatCurrency(Math.abs(summary.balanceDue))} will
                be applied to your next monthly CAM payment or refunded per your
                lease agreement.
              </Text>
            </View>
          ) : (
            <View style={styles.balanceDue}>
              <View style={styles.summaryRow}>
                <Text style={styles.balanceLabel}>BALANCE DUE</Text>
                <Text style={styles.balanceValue}>
                  {formatCurrency(summary.balanceDue)}
                </Text>
              </View>
              <Text
                style={[styles.notesText, { marginTop: 4, color: "#92400e" }]}
              >
                Please remit payment of {formatCurrency(summary.balanceDue)}{" "}
                within 30 days of receipt of this statement per your lease
                agreement.
              </Text>
            </View>
          )}
        </View>

        {/* Notes */}
        {notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Notes & Additional Information
            </Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{notes}</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {property.name} | CAM Reconciliation {data.reconciliationYear} |{" "}
            {tenant.name}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
};

export async function generateCAMStatementPDF(
  data: CAMReconciliationData,
): Promise<Buffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const element = React.createElement(CAMStatementDocument, { data });
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}

export async function generateCAMStatementStream(
  data: CAMReconciliationData,
): Promise<NodeJS.ReadableStream> {
  const { renderToStream } = await import("@react-pdf/renderer");
  const element = React.createElement(CAMStatementDocument, { data });
  return renderToStream(element);
}

export function buildCAMReconciliationData(params: {
  statementId: string;
  reconciliationYear: number;
  property: CAMReconciliationData["property"];
  tenant: CAMReconciliationData["tenant"];
  lease: CAMReconciliationData["lease"];
  expenses: CAMExpenseLineItem[];
  notes?: string;
}): CAMReconciliationData {
  const totalActualCAMExpenses = params.expenses.reduce(
    (sum, e) => sum + e.totalAmount,
    0,
  );
  const tenantActualCAMObligation = params.expenses.reduce(
    (sum, e) => sum + e.tenantAmount,
    0,
  );
  const totalEstimatedPayments = params.lease.camEstimateAnnual;
  const balanceDue = tenantActualCAMObligation - totalEstimatedPayments;
  const isCredit = balanceDue < 0;

  return {
    statementId: params.statementId,
    generatedAt: new Date().toISOString(),
    reconciliationYear: params.reconciliationYear,
    property: params.property,
    tenant: params.tenant,
    lease: params.lease,
    expenses: params.expenses,
    summary: {
      totalActualCAMExpenses,
      tenantProRataShare: params.lease.proRataShare,
      tenantActualCAMObligation,
      totalEstimatedPayments,
      balanceDue: Math.abs(balanceDue),
      isCredit,
    },
    notes: params.notes,
  };
}
