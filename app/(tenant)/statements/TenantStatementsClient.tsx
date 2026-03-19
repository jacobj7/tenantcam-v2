"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";

interface Statement {
  id: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  total_charges: number;
  total_credits: number;
  net_amount: number;
  status: "draft" | "finalized" | "disputed";
  pdf_url: string | null;
  property_address: string;
  unit_number: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const STATUS_LABELS: Record<Statement["status"], string> = {
  draft: "Draft",
  finalized: "Finalized",
  disputed: "Disputed",
};

const STATUS_COLORS: Record<Statement["status"], string> = {
  draft: "bg-yellow-100 text-yellow-800",
  finalized: "bg-green-100 text-green-800",
  disputed: "bg-red-100 text-red-800",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function StatementSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-4 mb-3">
          <div className="flex justify-between items-start">
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-200 rounded w-1/4" />
            </div>
            <div className="h-6 bg-gray-200 rounded w-20" />
          </div>
          <div className="mt-3 flex gap-4">
            <div className="h-3 bg-gray-200 rounded w-24" />
            <div className="h-3 bg-gray-200 rounded w-24" />
            <div className="h-3 bg-gray-200 rounded w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TenantStatementsClient() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const fetchStatements = useCallback(
    async (page: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pagination.pageSize),
          sortOrder,
          ...(statusFilter !== "all" && { status: statusFilter }),
        });

        const res = await fetch(`/api/tenant/statements?${params.toString()}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load statements");
        }
        const data = await res.json();
        setStatements(data.statements);
        setPagination(data.pagination);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred",
        );
      } finally {
        setLoading(false);
      }
    },
    [pagination.pageSize, statusFilter, sortOrder],
  );

  useEffect(() => {
    fetchStatements(1);
  }, [fetchStatements]);

  const handleDownload = async (statement: Statement) => {
    if (!statement.pdf_url) return;
    setDownloadingId(statement.id);
    try {
      const res = await fetch(
        `/api/tenant/statements/${statement.id}/download`,
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `statement-${statement.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download PDF. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchStatements(newPage);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Reconciliation Statements
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          View and download your rental reconciliation statements
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label
            htmlFor="status-filter"
            className="text-sm font-medium text-gray-700"
          >
            Status:
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="finalized">Finalized</option>
            <option value="disputed">Disputed</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="sort-order"
            className="text-sm font-medium text-gray-700"
          >
            Sort:
          </label>
          <select
            id="sort-order"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
            className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <svg
            className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-800">{error}</p>
            <button
              onClick={() => fetchStatements(pagination.page)}
              className="mt-1 text-sm text-red-600 underline hover:text-red-800"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && <StatementSkeleton />}

      {/* Empty State */}
      {!loading && !error && statements.length === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-300 rounded-lg">
          <svg
            className="mx-auto w-12 h-12 text-gray-400 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-gray-500 font-medium">No statements found</p>
          <p className="text-gray-400 text-sm mt-1">
            {statusFilter !== "all"
              ? "Try changing the status filter"
              : "Your statements will appear here once generated"}
          </p>
        </div>
      )}

      {/* Statements List */}
      {!loading && !error && statements.length > 0 && (
        <div className="space-y-3">
          {statements.map((statement) => (
            <div
              key={statement.id}
              className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-wrap justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold text-gray-900">
                      {format(new Date(statement.period_start), "MMM d, yyyy")}{" "}
                      – {format(new Date(statement.period_end), "MMM d, yyyy")}
                    </h2>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[statement.status]}`}
                    >
                      {STATUS_LABELS[statement.status]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {statement.property_address}
                    {statement.unit_number
                      ? `, Unit ${statement.unit_number}`
                      : ""}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Generated{" "}
                    {format(
                      new Date(statement.generated_at),
                      "MMM d, yyyy h:mm a",
                    )}
                  </p>
                </div>

                {statement.pdf_url && (
                  <button
                    onClick={() => handleDownload(statement)}
                    disabled={downloadingId === statement.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label={`Download PDF for statement ${statement.id}`}
                  >
                    {downloadingId === statement.id ? (
                      <>
                        <svg
                          className="animate-spin w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8H4z"
                          />
                        </svg>
                        Downloading…
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        Download PDF
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Financial Summary */}
              <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Charges
                  </p>
                  <p className="font-medium text-gray-800">
                    {formatCurrency(statement.total_charges)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Credits
                  </p>
                  <p className="font-medium text-green-700">
                    {formatCurrency(statement.total_credits)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Net Amount
                  </p>
                  <p
                    className={`font-semibold ${
                      statement.net_amount < 0
                        ? "text-green-700"
                        : "text-gray-900"
                    }`}
                  >
                    {formatCurrency(statement.net_amount)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(pagination.page - 1) * pagination.pageSize + 1}–
            {Math.min(pagination.page * pagination.pageSize, pagination.total)}{" "}
            of {pagination.total} statements
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === pagination.totalPages ||
                  Math.abs(p - pagination.page) <= 1,
              )
              .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                  acc.push("ellipsis");
                }
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === "ellipsis" ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 py-1.5 text-sm text-gray-400"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => handlePageChange(item as number)}
                    className={`px-3 py-1.5 text-sm border rounded-md transition-colors ${
                      pagination.page === item
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
