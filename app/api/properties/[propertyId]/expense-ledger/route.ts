import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parse } from "csv-parse/sync";
import Anthropic from "@anthropic-ai/sdk";
import { Pool } from "pg";
import { z } from "zod";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const ExpenseLedgerRowSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1),
  amount: z.string().min(1),
  vendor: z.string().optional().default(""),
  account_code: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

type ExpenseLedgerRow = z.infer<typeof ExpenseLedgerRowSchema>;

interface CategorizedLineItem {
  category: string;
  cam_eligible: boolean;
  cam_pool: string | null;
  exclusion_reason: string | null;
  confidence: number;
}

async function categorizeLineItem(
  row: ExpenseLedgerRow,
): Promise<CategorizedLineItem> {
  const prompt = `You are a CAM (Common Area Maintenance) expense categorizer for commercial real estate.

Analyze the following expense line item and categorize it:
- Date: ${row.date}
- Description: ${row.description}
- Amount: ${row.amount}
- Vendor: ${row.vendor}
- Account Code: ${row.account_code}
- Notes: ${row.notes}

Respond with a JSON object containing:
{
  "category": "one of: utilities, maintenance, insurance, management_fees, landscaping, security, cleaning, repairs, administrative, capital_improvement, taxes, other",
  "cam_eligible": true or false (whether this expense is typically recoverable as CAM),
  "cam_pool": "one of: base_cam, admin_fee, insurance, taxes, or null if not CAM eligible",
  "exclusion_reason": "reason if not CAM eligible, otherwise null",
  "confidence": a number between 0 and 1 indicating confidence in the categorization
}

Only respond with the JSON object, no other text.`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Anthropic");
  }

  try {
    const parsed = JSON.parse(content.text);
    return {
      category: parsed.category || "other",
      cam_eligible: Boolean(parsed.cam_eligible),
      cam_pool: parsed.cam_pool || null,
      exclusion_reason: parsed.exclusion_reason || null,
      confidence:
        typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };
  } catch {
    return {
      category: "other",
      cam_eligible: false,
      cam_pool: null,
      exclusion_reason: "Failed to parse categorization",
      confidence: 0,
    };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { propertyId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { propertyId } = params;
    if (!propertyId) {
      return NextResponse.json(
        { error: "Property ID is required" },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const periodStart = formData.get("period_start") as string | null;
    const periodEnd = formData.get("period_end") as string | null;
    const ledgerName = formData.get("ledger_name") as string | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "CSV file is required" },
        { status: 400 },
      );
    }

    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      return NextResponse.json(
        { error: "File must be a CSV" },
        { status: 400 },
      );
    }

    const csvContent = await file.text();

    let records: Record<string, string>[];
    try {
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: false,
      });
    } catch (parseError) {
      return NextResponse.json(
        { error: "Failed to parse CSV file", details: String(parseError) },
        { status: 400 },
      );
    }

    if (!records || records.length === 0) {
      return NextResponse.json(
        { error: "CSV file contains no data rows" },
        { status: 400 },
      );
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const ledgerResult = await client.query(
        `INSERT INTO expense_ledgers 
          (property_id, name, period_start, period_end, uploaded_by, file_name, row_count, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING id`,
        [
          propertyId,
          ledgerName ||
            `Expense Ledger - ${new Date().toISOString().split("T")[0]}`,
          periodStart || null,
          periodEnd || null,
          session.user.email || session.user.name || "unknown",
          file.name,
          records.length,
        ],
      );

      const ledgerId = ledgerResult.rows[0].id;

      const processedItems = [];
      const errors = [];

      for (let i = 0; i < records.length; i++) {
        const record = records[i];

        const normalizedRecord = {
          date: record.date || record.Date || record.DATE || "",
          description:
            record.description ||
            record.Description ||
            record.DESCRIPTION ||
            record.desc ||
            record.Desc ||
            "",
          amount:
            record.amount ||
            record.Amount ||
            record.AMOUNT ||
            record.total ||
            record.Total ||
            "",
          vendor:
            record.vendor ||
            record.Vendor ||
            record.VENDOR ||
            record.supplier ||
            record.Supplier ||
            "",
          account_code:
            record.account_code ||
            record.account ||
            record.Account ||
            record.gl_code ||
            record.GL_Code ||
            "",
          notes:
            record.notes ||
            record.Notes ||
            record.NOTES ||
            record.memo ||
            record.Memo ||
            "",
        };

        const validationResult =
          ExpenseLedgerRowSchema.safeParse(normalizedRecord);
        if (!validationResult.success) {
          errors.push({
            row: i + 2,
            error: validationResult.error.message,
            data: record,
          });
          continue;
        }

        const validRow = validationResult.data;

        let categorization: CategorizedLineItem;
        try {
          categorization = await categorizeLineItem(validRow);
        } catch (catError) {
          categorization = {
            category: "other",
            cam_eligible: false,
            cam_pool: null,
            exclusion_reason: "Categorization service error",
            confidence: 0,
          };
        }

        const amountStr = validRow.amount.replace(/[$,\s]/g, "");
        const amount = parseFloat(amountStr);
        if (isNaN(amount)) {
          errors.push({
            row: i + 2,
            error: `Invalid amount value: ${validRow.amount}`,
            data: record,
          });
          continue;
        }

        const lineItemResult = await client.query(
          `INSERT INTO expense_line_items
            (ledger_id, property_id, date, description, amount, vendor, account_code, notes,
             category, cam_eligible, cam_pool, exclusion_reason, categorization_confidence,
             created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
           RETURNING id`,
          [
            ledgerId,
            propertyId,
            validRow.date,
            validRow.description,
            amount,
            validRow.vendor,
            validRow.account_code,
            validRow.notes,
            categorization.category,
            categorization.cam_eligible,
            categorization.cam_pool,
            categorization.exclusion_reason,
            categorization.confidence,
          ],
        );

        processedItems.push({
          id: lineItemResult.rows[0].id,
          row: i + 2,
          description: validRow.description,
          amount,
          category: categorization.category,
          cam_eligible: categorization.cam_eligible,
          cam_pool: categorization.cam_pool,
        });
      }

      const totalAmount = processedItems.reduce(
        (sum, item) => sum + item.amount,
        0,
      );
      const camEligibleAmount = processedItems
        .filter((item) => item.cam_eligible)
        .reduce((sum, item) => sum + item.amount, 0);

      await client.query(
        `UPDATE expense_ledgers 
         SET processed_row_count = $1, total_amount = $2, cam_eligible_amount = $3, updated_at = NOW()
         WHERE id = $4`,
        [processedItems.length, totalAmount, camEligibleAmount, ledgerId],
      );

      await client.query("COMMIT");

      return NextResponse.json(
        {
          success: true,
          ledger_id: ledgerId,
          property_id: propertyId,
          file_name: file.name,
          total_rows: records.length,
          processed_rows: processedItems.length,
          error_rows: errors.length,
          total_amount: totalAmount,
          cam_eligible_amount: camEligibleAmount,
          line_items: processedItems,
          errors: errors.length > 0 ? errors : undefined,
        },
        { status: 201 },
      );
    } catch (dbError) {
      await client.query("ROLLBACK");
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error processing expense ledger:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
