import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AdminShell from "@/components/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    redirect("/admin/login");
  }

  const admin = await prisma.admin.findUnique({ where: { id: session.sub } });
  if (!admin || admin.status !== "active") {
    redirect("/admin/login");
  }

  return <AdminShell adminName={admin.fullName}>{children}</AdminShell>;
}
