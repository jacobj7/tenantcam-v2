import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ManagerDashboardClient from "./ManagerDashboardClient";

export const metadata: Metadata = {
  title: "Manager Dashboard",
  description: "Manage your team and operations",
};

export default async function ManagerDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user?.role !== "manager" && session.user?.role !== "admin") {
    redirect("/unauthorized");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <ManagerDashboardClient session={session} />
    </main>
  );
}
