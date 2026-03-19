"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Property {
  id: string;
  name: string;
  address: string;
  reconciliationStatus:
    | "pending"
    | "in_progress"
    | "completed"
    | "overdue"
    | "none";
  lastReconciled: string | null;
  unitCount: number;
  occupancyRate: number;
}

interface ManagerDashboardClientProps {
  properties: Property[];
}

const statusConfig = {
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-blue-100 text-blue-800 border border-blue-200",
  },
  completed: {
    label: "Completed",
    className: "bg-green-100 text-green-800 border border-green-200",
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-100 text-red-800 border border-red-200",
  },
  none: {
    label: "Not Started",
    className: "bg-gray-100 text-gray-600 border border-gray-200",
  },
};

function ReconciliationBadge({
  status,
}: {
  status: Property["reconciliationStatus"];
}) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function PropertyCard({ property }: { property: Property }) {
  return (
    <Link
      href={`/properties/${property.id}`}
      className="block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-200 p-6 group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
            {property.name}
          </h3>
          <p className="mt-1 text-sm text-gray-500 truncate">
            {property.address}
          </p>
        </div>
        <ReconciliationBadge status={property.reconciliationStatus} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
            Units
          </p>
          <p className="mt-1 text-xl font-bold text-gray-900">
            {property.unitCount}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
            Occupancy
          </p>
          <p className="mt-1 text-xl font-bold text-gray-900">
            {property.occupancyRate.toFixed(0)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
            Last Reconciled
          </p>
          <p className="mt-1 text-sm font-medium text-gray-700">
            {property.lastReconciled
              ? new Date(property.lastReconciled).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "—"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end">
        <span className="text-sm text-indigo-600 font-medium group-hover:underline">
          View details →
        </span>
      </div>
    </Link>
  );
}

export default function ManagerDashboardClient({
  properties,
}: ManagerDashboardClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    Property["reconciliationStatus"] | "all"
  >("all");
  const [isCreating, setIsCreating] = useState(false);

  const filteredProperties = properties.filter((property) => {
    const matchesSearch =
      property.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || property.reconciliationStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateProperty = () => {
    setIsCreating(true);
    router.push("/properties/new");
  };

  const statusCounts = properties.reduce(
    (acc, p) => {
      acc[p.reconciliationStatus] = (acc[p.reconciliationStatus] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Property Dashboard
            </h1>
            <p className="mt-1 text-gray-500">
              Manage your properties and track reconciliation status
            </p>
          </div>
          <button
            onClick={handleCreateProperty}
            disabled={isCreating}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Creating…
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                New Property
              </>
            )}
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {properties.length}
            </p>
            <p className="text-sm text-gray-500 mt-1">Total Properties</p>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-4 text-center">
            <p className="text-2xl font-bold text-red-600">
              {statusCounts["overdue"] || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">Overdue</p>
          </div>
          <div className="bg-white rounded-xl border border-yellow-200 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {statusCounts["pending"] || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">Pending</p>
          </div>
          <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {statusCounts["completed"] || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">Completed</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search properties…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as Property["reconciliationStatus"] | "all",
              )
            }
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-700"
          >
            <option value="all">All Statuses</option>
            <option value="overdue">Overdue</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="none">Not Started</option>
          </select>
        </div>

        {/* Property List */}
        {filteredProperties.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            {properties.length === 0 ? (
              <>
                <svg
                  className="mx-auto h-12 w-12 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  No properties yet
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Get started by creating your first property.
                </p>
                <button
                  onClick={handleCreateProperty}
                  className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  New Property
                </button>
              </>
            ) : (
              <>
                <svg
                  className="mx-auto h-12 w-12 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  No results found
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Try adjusting your search or filter criteria.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                  className="mt-4 text-sm text-indigo-600 hover:underline font-medium"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}

        {/* Footer count */}
        {filteredProperties.length > 0 && (
          <p className="mt-6 text-sm text-gray-400 text-center">
            Showing {filteredProperties.length} of {properties.length} propert
            {properties.length === 1 ? "y" : "ies"}
          </p>
        )}
      </div>
    </div>
  );
}
