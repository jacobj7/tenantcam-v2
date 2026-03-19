import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import TenantStatementsClient from "./TenantStatementsClient";

export default async function TenantStatementsPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login");
  }

  const userId = session.user.id as string;

  return <TenantStatementsClient userId={userId} />;
}
