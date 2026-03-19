import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import TenantStatementsClient from "./TenantStatementsClient";

export const metadata = {
  title: "Statements | Tenant Portal",
  description: "View your rental statements and payment history",
};

export default async function TenantStatementsPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Statements</h1>
          <p className="mt-2 text-sm text-gray-600">
            View and download your rental statements and payment history
          </p>
        </div>
        <TenantStatementsClient userId={session.user.id as string} />
      </div>
    </main>
  );
}
