import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const ExpenseLineItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  amount: z.number(),
  gl_code: z.string(),
  vendor: z.string().optional(),
  category: z.string().optional(),
});

const CategorizedExpenseSchema = ExpenseLineItemSchema.extend({
  cam_eligible: z.boolean(),
  cam_reason: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

export type ExpenseLineItem = z.infer<typeof ExpenseLineItemSchema>;
export type CategorizedExpense = z.infer<typeof CategorizedExpenseSchema>;

const CAM_ELIGIBLE_GL_RANGES: Array<{
  min: number;
  max: number;
  description: string;
}> = [
  { min: 5000, max: 5099, description: "Common area maintenance" },
  { min: 5100, max: 5199, description: "Landscaping and grounds" },
  { min: 5200, max: 5299, description: "Janitorial and cleaning" },
  { min: 5300, max: 5399, description: "Security services" },
  { min: 5400, max: 5499, description: "Utilities - common areas" },
  { min: 5500, max: 5599, description: "Repairs and maintenance" },
  { min: 5600, max: 5699, description: "Insurance - property" },
  { min: 5700, max: 5799, description: "Management fees" },
  { min: 6000, max: 6099, description: "Administrative - shared" },
];

const CAM_EXCLUDED_GL_RANGES: Array<{
  min: number;
  max: number;
  description: string;
}> = [
  { min: 7000, max: 7999, description: "Capital expenditures" },
  { min: 8000, max: 8999, description: "Depreciation and amortization" },
  { min: 9000, max: 9999, description: "Financing costs" },
  { min: 4000, max: 4999, description: "Revenue accounts" },
  { min: 1000, max: 1999, description: "Asset accounts" },
  { min: 2000, max: 2999, description: "Liability accounts" },
];

const CAM_ELIGIBLE_KEYWORDS = [
  "landscaping",
  "lawn",
  "snow removal",
  "parking lot",
  "common area",
  "lobby",
  "elevator",
  "hvac",
  "janitorial",
  "cleaning",
  "security",
  "lighting",
  "utilities",
  "water",
  "electricity",
  "gas",
  "trash",
  "waste removal",
  "pest control",
  "fire protection",
  "sprinkler",
  "maintenance",
  "repair",
  "management fee",
  "property management",
  "insurance",
  "signage",
  "parking",
  "exterior",
  "roof",
  "plumbing",
  "electrical",
];

const CAM_EXCLUDED_KEYWORDS = [
  "tenant improvement",
  "leasehold improvement",
  "capital improvement",
  "depreciation",
  "amortization",
  "mortgage",
  "loan",
  "interest",
  "principal",
  "refinancing",
  "ground lease",
  "executive",
  "corporate",
  "legal fees",
  "litigation",
  "marketing",
  "advertising",
  "leasing commission",
  "broker fee",
];

function parseGlCode(glCode: string): number | null {
  const cleaned = glCode.replace(/[^0-9]/g, "");
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? null : parsed;
}

function checkGlCodeRanges(glCode: string): {
  eligible: boolean | null;
  reason: string;
} {
  const glNum = parseGlCode(glCode);

  if (glNum === null) {
    return { eligible: null, reason: "GL code could not be parsed" };
  }

  for (const range of CAM_EXCLUDED_GL_RANGES) {
    if (glNum >= range.min && glNum <= range.max) {
      return {
        eligible: false,
        reason: `GL code ${glCode} falls in excluded range ${range.min}-${range.max} (${range.description})`,
      };
    }
  }

  for (const range of CAM_ELIGIBLE_GL_RANGES) {
    if (glNum >= range.min && glNum <= range.max) {
      return {
        eligible: true,
        reason: `GL code ${glCode} falls in CAM-eligible range ${range.min}-${range.max} (${range.description})`,
      };
    }
  }

  return {
    eligible: null,
    reason: `GL code ${glCode} not in any defined range`,
  };
}

function checkKeywords(text: string): {
  eligible: boolean | null;
  matchedKeywords: string[];
  reason: string;
} {
  const lowerText = text.toLowerCase();

  const excludedMatches = CAM_EXCLUDED_KEYWORDS.filter((kw) =>
    lowerText.includes(kw.toLowerCase()),
  );

  if (excludedMatches.length > 0) {
    return {
      eligible: false,
      matchedKeywords: excludedMatches,
      reason: `Contains excluded keywords: ${excludedMatches.join(", ")}`,
    };
  }

  const eligibleMatches = CAM_ELIGIBLE_KEYWORDS.filter((kw) =>
    lowerText.includes(kw.toLowerCase()),
  );

  if (eligibleMatches.length > 0) {
    return {
      eligible: true,
      matchedKeywords: eligibleMatches,
      reason: `Contains CAM-eligible keywords: ${eligibleMatches.join(", ")}`,
    };
  }

  return {
    eligible: null,
    matchedKeywords: [],
    reason: "No matching keywords found",
  };
}

function applyRuleBasedCategorization(expense: ExpenseLineItem): {
  cam_eligible: boolean | null;
  cam_reason: string;
  confidence: "high" | "medium" | "low";
} {
  const glResult = checkGlCodeRanges(expense.gl_code);
  const searchText = `${expense.description} ${expense.vendor || ""} ${expense.category || ""}`;
  const keywordResult = checkKeywords(searchText);

  if (glResult.eligible === false) {
    return {
      cam_eligible: false,
      cam_reason: glResult.reason,
      confidence: "high",
    };
  }

  if (keywordResult.eligible === false) {
    return {
      cam_eligible: false,
      cam_reason: keywordResult.reason,
      confidence: "high",
    };
  }

  if (glResult.eligible === true && keywordResult.eligible === true) {
    return {
      cam_eligible: true,
      cam_reason: `${glResult.reason}; ${keywordResult.reason}`,
      confidence: "high",
    };
  }

  if (glResult.eligible === true) {
    return {
      cam_eligible: true,
      cam_reason: glResult.reason,
      confidence: "medium",
    };
  }

  if (keywordResult.eligible === true) {
    return {
      cam_eligible: true,
      cam_reason: keywordResult.reason,
      confidence: "medium",
    };
  }

  return {
    cam_eligible: null,
    cam_reason: "Could not determine CAM eligibility from rules alone",
    confidence: "low",
  };
}

async function categorizeWithAI(
  expense: ExpenseLineItem,
  client: Anthropic,
): Promise<{
  cam_eligible: boolean;
  cam_reason: string;
  confidence: "high" | "medium" | "low";
}> {
  const prompt = `You are a commercial real estate CAM (Common Area Maintenance) expense categorization expert.

Analyze the following expense line item and determine if it is CAM-eligible:

Expense Details:
- ID: ${expense.id}
- Description: ${expense.description}
- Amount: $${expense.amount.toFixed(2)}
- GL Code: ${expense.gl_code}
- Vendor: ${expense.vendor || "N/A"}
- Category: ${expense.category || "N/A"}

CAM-eligible expenses typically include:
- Common area maintenance and repairs
- Landscaping and grounds maintenance
- Janitorial and cleaning services
- Security services
- Common area utilities (electricity, water, gas)
- Property insurance
- Property management fees
- Parking lot maintenance
- Elevator maintenance
- HVAC for common areas
- Trash removal
- Pest control
- Fire protection systems

CAM-excluded expenses typically include:
- Capital improvements and tenant improvements
- Depreciation and amortization
- Mortgage interest and financing costs
- Executive salaries and corporate overhead
- Marketing and advertising
- Leasing commissions
- Legal fees for tenant disputes
- Ground lease payments

Respond with a JSON object in this exact format:
{
  "cam_eligible": true or false,
  "cam_reason": "Brief explanation of why this expense is or is not CAM-eligible",
  "confidence": "high", "medium", or "low"
}`;

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const responseText = message.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("");

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not extract JSON from AI response");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    cam_eligible: Boolean(parsed.cam_eligible),
    cam_reason: String(parsed.cam_reason),
    confidence: ["high", "medium", "low"].includes(parsed.confidence)
      ? parsed.confidence
      : "low",
  };
}

export async function categorizeExpense(
  expense: ExpenseLineItem,
  options: {
    useAI?: boolean;
    anthropicApiKey?: string;
  } = {},
): Promise<CategorizedExpense> {
  const validated = ExpenseLineItemSchema.parse(expense);

  const ruleResult = applyRuleBasedCategorization(validated);

  if (ruleResult.cam_eligible !== null && ruleResult.confidence === "high") {
    return CategorizedExpenseSchema.parse({
      ...validated,
      cam_eligible: ruleResult.cam_eligible,
      cam_reason: ruleResult.cam_reason,
      confidence: ruleResult.confidence,
    });
  }

  if (options.useAI !== false) {
    try {
      const apiKey = options.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY not configured");
      }

      const client = new Anthropic({ apiKey });
      const aiResult = await categorizeWithAI(validated, client);

      return CategorizedExpenseSchema.parse({
        ...validated,
        cam_eligible: aiResult.cam_eligible,
        cam_reason: aiResult.cam_reason,
        confidence: aiResult.confidence,
      });
    } catch (error) {
      if (ruleResult.cam_eligible !== null) {
        return CategorizedExpenseSchema.parse({
          ...validated,
          cam_eligible: ruleResult.cam_eligible,
          cam_reason: `${ruleResult.cam_reason} (AI categorization failed: ${error instanceof Error ? error.message : "unknown error"})`,
          confidence: "low",
        });
      }

      return CategorizedExpenseSchema.parse({
        ...validated,
        cam_eligible: false,
        cam_reason: `Could not determine CAM eligibility (AI categorization failed: ${error instanceof Error ? error.message : "unknown error"})`,
        confidence: "low",
      });
    }
  }

  if (ruleResult.cam_eligible !== null) {
    return CategorizedExpenseSchema.parse({
      ...validated,
      cam_eligible: ruleResult.cam_eligible,
      cam_reason: ruleResult.cam_reason,
      confidence: ruleResult.confidence,
    });
  }

  return CategorizedExpenseSchema.parse({
    ...validated,
    cam_eligible: false,
    cam_reason: "Could not determine CAM eligibility from available rules",
    confidence: "low",
  });
}

export async function categorizeExpenses(
  expenses: ExpenseLineItem[],
  options: {
    useAI?: boolean;
    anthropicApiKey?: string;
    concurrency?: number;
  } = {},
): Promise<CategorizedExpense[]> {
  const concurrency = options.concurrency || 5;
  const results: CategorizedExpense[] = [];

  for (let i = 0; i < expenses.length; i += concurrency) {
    const batch = expenses.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((expense) => categorizeExpense(expense, options)),
    );
    results.push(...batchResults);
  }

  return results;
}

export function getCamEligibleExpenses(
  expenses: CategorizedExpense[],
): CategorizedExpense[] {
  return expenses.filter((e) => e.cam_eligible === true);
}

export function getCamExcludedExpenses(
  expenses: CategorizedExpense[],
): CategorizedExpense[] {
  return expenses.filter((e) => e.cam_eligible === false);
}

export function calculateCamTotal(expenses: CategorizedExpense[]): number {
  return getCamEligibleExpenses(expenses).reduce((sum, e) => sum + e.amount, 0);
}

export function generateCamReport(expenses: CategorizedExpense[]): {
  total_expenses: number;
  cam_eligible_count: number;
  cam_excluded_count: number;
  cam_total_amount: number;
  excluded_total_amount: number;
  cam_percentage: number;
  high_confidence_count: number;
  medium_confidence_count: number;
  low_confidence_count: number;
  expenses: CategorizedExpense[];
} {
  const eligible = getCamEligibleExpenses(expenses);
  const excluded = getCamExcludedExpenses(expenses);
  const camTotal = calculateCamTotal(expenses);
  const excludedTotal = excluded.reduce((sum, e) => sum + e.amount, 0);
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  return {
    total_expenses: expenses.length,
    cam_eligible_count: eligible.length,
    cam_excluded_count: excluded.length,
    cam_total_amount: camTotal,
    excluded_total_amount: excludedTotal,
    cam_percentage: totalAmount > 0 ? (camTotal / totalAmount) * 100 : 0,
    high_confidence_count: expenses.filter((e) => e.confidence === "high")
      .length,
    medium_confidence_count: expenses.filter((e) => e.confidence === "medium")
      .length,
    low_confidence_count: expenses.filter((e) => e.confidence === "low").length,
    expenses,
  };
}
