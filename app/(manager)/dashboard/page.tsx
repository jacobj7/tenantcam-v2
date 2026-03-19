import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import ManagerDashboardClient from "./ManagerDashboardClient";

export interface Property {
  id: string;
  name: string;
  address: string;
  total_units: number;
  occupied_units: number;
  created_at: string;
}

export default async function ManagerDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Please sign in to access the dashboard.</p>
      </div>
    );
  }

  let properties: Property[] = [];

  try {
    const result = await pool.query<Property>(
      `SELECT id, name, address, total_units, occupied_units, created_at
       FROM properties
       WHERE manager_id = $1
       ORDER BY created_at DESC`,
      [session.user.id],
    );
    properties = result.rows;
  } catch (error) {
    console.error("Failed to fetch properties:", error);
    properties = [];
  }

  return <ManagerDashboardClient properties={properties} />;
}
