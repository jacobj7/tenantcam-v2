import { z } from "zod";

export const LeaseSchema = z.object({
  tenantId: z.string().min(1),
  tenantName: z.string().min(1),
  leasableArea: z.number().positive(),
  camFloor: z.number().nonnegative().optional(),
  camCap: z.number().positive().optional(),
  exclusions: z.array(z.string()).optional().default([]),
});

export const CAMPoolSchema = z.object({
  totalCAMExpenses: z.number().nonnegative(),
  expenseCategories: z
    .record(z.string(), z.number().nonnegative())
    .optional()
    .default({}),
  adminFeePercent: z.number().min(0).max(100).optional().default(0),
});

export const CAMEngineInputSchema = z.object({
  pool: CAMPoolSchema,
  leases: z.array(LeaseSchema).min(1),
  reconciliationYear: z.number().int().positive().optional(),
});

export type Lease = z.infer<typeof LeaseSchema>;
export type CAMPool = z.infer<typeof CAMPoolSchema>;
export type CAMEngineInput = z.infer<typeof CAMEngineInputSchema>;

export interface TenantAllocation {
  tenantId: string;
  tenantName: string;
  leasableArea: number;
  proRataShare: number;
  grossAllocation: number;
  floorApplied: boolean;
  capApplied: boolean;
  finalAllocation: number;
  effectiveRate: number;
  excludedCategories: string[];
  adjustedPoolAmount: number;
}

export interface CAMAllocationResult {
  reconciliationYear?: number;
  totalCAMExpenses: number;
  adminFeeAmount: number;
  grossPoolAmount: number;
  totalLeasableArea: number;
  allocations: TenantAllocation[];
  totalAllocated: number;
  unallocatedAmount: number;
  capAdjustmentTotal: number;
  floorAdjustmentTotal: number;
  allocationDate: string;
}

function computeExcludedAmount(
  expenseCategories: Record<string, number>,
  exclusions: string[],
): number {
  if (!exclusions || exclusions.length === 0) return 0;
  return exclusions.reduce((sum, category) => {
    const amount = expenseCategories[category] ?? 0;
    return sum + amount;
  }, 0);
}

function applyCapAndFloor(
  grossAllocation: number,
  floor: number | undefined,
  cap: number | undefined,
): { amount: number; floorApplied: boolean; capApplied: boolean } {
  let amount = grossAllocation;
  let floorApplied = false;
  let capApplied = false;

  if (floor !== undefined && amount < floor) {
    amount = floor;
    floorApplied = true;
  }

  if (cap !== undefined && amount > cap) {
    amount = cap;
    capApplied = true;
    floorApplied = false;
  }

  return { amount, floorApplied, capApplied };
}

export function computeCAMAllocations(
  input: CAMEngineInput,
): CAMAllocationResult {
  const validated = CAMEngineInputSchema.parse(input);
  const { pool, leases, reconciliationYear } = validated;

  const adminFeeAmount = pool.totalCAMExpenses * (pool.adminFeePercent / 100);
  const grossPoolAmount = pool.totalCAMExpenses + adminFeeAmount;

  const totalLeasableArea = leases.reduce(
    (sum, lease) => sum + lease.leasableArea,
    0,
  );

  if (totalLeasableArea <= 0) {
    throw new Error("Total leasable area must be greater than zero");
  }

  const allocations: TenantAllocation[] = leases.map((lease) => {
    const excludedAmount = computeExcludedAmount(
      pool.expenseCategories,
      lease.exclusions,
    );

    const adjustedPoolAmount = Math.max(0, grossPoolAmount - excludedAmount);

    const proRataShare = lease.leasableArea / totalLeasableArea;

    const grossAllocation = adjustedPoolAmount * proRataShare;

    const {
      amount: finalAllocation,
      floorApplied,
      capApplied,
    } = applyCapAndFloor(grossAllocation, lease.camFloor, lease.camCap);

    const effectiveRate =
      lease.leasableArea > 0 ? finalAllocation / lease.leasableArea : 0;

    return {
      tenantId: lease.tenantId,
      tenantName: lease.tenantName,
      leasableArea: lease.leasableArea,
      proRataShare,
      grossAllocation,
      floorApplied,
      capApplied,
      finalAllocation,
      effectiveRate,
      excludedCategories: lease.exclusions,
      adjustedPoolAmount,
    };
  });

  const totalAllocated = allocations.reduce(
    (sum, a) => sum + a.finalAllocation,
    0,
  );

  const capAdjustmentTotal = allocations.reduce((sum, a) => {
    if (a.capApplied) {
      return sum + (a.grossAllocation - a.finalAllocation);
    }
    return sum;
  }, 0);

  const floorAdjustmentTotal = allocations.reduce((sum, a) => {
    if (a.floorApplied) {
      return sum + (a.finalAllocation - a.grossAllocation);
    }
    return sum;
  }, 0);

  const unallocatedAmount = grossPoolAmount - totalAllocated;

  return {
    reconciliationYear,
    totalCAMExpenses: pool.totalCAMExpenses,
    adminFeeAmount,
    grossPoolAmount,
    totalLeasableArea,
    allocations,
    totalAllocated,
    unallocatedAmount,
    capAdjustmentTotal,
    floorAdjustmentTotal,
    allocationDate: new Date().toISOString(),
  };
}

export function redistributeCapSavings(
  result: CAMAllocationResult,
): CAMAllocationResult {
  if (result.capAdjustmentTotal <= 0) {
    return result;
  }

  const uncappedAllocations = result.allocations.filter((a) => !a.capApplied);

  if (uncappedAllocations.length === 0) {
    return result;
  }

  const uncappedArea = uncappedAllocations.reduce(
    (sum, a) => sum + a.leasableArea,
    0,
  );

  const updatedAllocations = result.allocations.map((allocation) => {
    if (allocation.capApplied) {
      return allocation;
    }

    const redistributionShare = allocation.leasableArea / uncappedArea;
    const additionalAmount = result.capAdjustmentTotal * redistributionShare;
    const newFinalAllocation = allocation.finalAllocation + additionalAmount;

    const cappedCheck = applyCapAndFloor(
      newFinalAllocation,
      allocation.floorApplied ? allocation.finalAllocation : undefined,
      allocation.capApplied ? allocation.finalAllocation : undefined,
    );

    return {
      ...allocation,
      finalAllocation: newFinalAllocation,
      effectiveRate:
        allocation.leasableArea > 0
          ? newFinalAllocation / allocation.leasableArea
          : 0,
    };
  });

  const newTotalAllocated = updatedAllocations.reduce(
    (sum, a) => sum + a.finalAllocation,
    0,
  );

  return {
    ...result,
    allocations: updatedAllocations,
    totalAllocated: newTotalAllocated,
    unallocatedAmount: result.grossPoolAmount - newTotalAllocated,
    capAdjustmentTotal: 0,
  };
}

export function formatAllocationSummary(result: CAMAllocationResult): string {
  const lines: string[] = [
    `CAM Allocation Summary${result.reconciliationYear ? ` - Year ${result.reconciliationYear}` : ""}`,
    `Generated: ${result.allocationDate}`,
    `${"─".repeat(60)}`,
    `Total CAM Expenses:    $${result.totalCAMExpenses.toFixed(2)}`,
    `Admin Fee:             $${result.adminFeeAmount.toFixed(2)}`,
    `Gross Pool Amount:     $${result.grossPoolAmount.toFixed(2)}`,
    `Total Leasable Area:   ${result.totalLeasableArea.toFixed(2)} sq ft`,
    `${"─".repeat(60)}`,
    `Tenant Allocations:`,
  ];

  for (const allocation of result.allocations) {
    lines.push(
      `  ${allocation.tenantName} (${allocation.tenantId})`,
      `    Area: ${allocation.leasableArea.toFixed(2)} sq ft | Share: ${(allocation.proRataShare * 100).toFixed(2)}%`,
      `    Gross: $${allocation.grossAllocation.toFixed(2)} | Final: $${allocation.finalAllocation.toFixed(2)}`,
      `    Rate: $${allocation.effectiveRate.toFixed(4)}/sq ft${allocation.capApplied ? " [CAP APPLIED]" : ""}${allocation.floorApplied ? " [FLOOR APPLIED]" : ""}`,
      allocation.excludedCategories.length > 0
        ? `    Exclusions: ${allocation.excludedCategories.join(", ")}`
        : "",
    );
  }

  lines.push(
    `${"─".repeat(60)}`,
    `Total Allocated:       $${result.totalAllocated.toFixed(2)}`,
    `Unallocated:           $${result.unallocatedAmount.toFixed(2)}`,
    `Cap Adjustments:       $${result.capAdjustmentTotal.toFixed(2)}`,
    `Floor Adjustments:     $${result.floorAdjustmentTotal.toFixed(2)}`,
  );

  return lines.filter((line) => line !== "").join("\n");
}
