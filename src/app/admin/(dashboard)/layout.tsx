import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";

const NAV = [
  { href: "/admin", label: "Overview", enabled: true },
  { href: "/admin/students", label: "Students", enabled: true },
  { href: "/admin/courses", label: "Courses", enabled: false },
  { href: "/admin/exams", label: "Exams", enabled: false },
  { href: "/admin/questions", label: "Question Bank", enabled: false },
  { href: "/admin/results", label: "Results", enabled: false },
  { href: "/admin/monitoring", label: "Live Monitoring", enabled: false },
  { href: "/admin/suspicious", label: "Suspicious Activity", enabled: false },
  { href: "/admin/settings", label: "Settings", enabled: false },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/admin/login");
  }

  const admin = await prisma.admin.findUnique({ where: { id: session.sub } });
  if (!admin || admin.status !== "active") {
    redirect("/admin/login");
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--cream-50)" }}>
      <header
        style={{
          background: "var(--burgundy-900)",
          color: "var(--cream-50)",
          padding: "1rem 5vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "1.1rem" }}>
            Nakconel Examinations
          </span>
          <span style={{ color: "var(--gold-200)", fontSize: "0.82rem", marginLeft: "0.6rem" }}>Admin</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: "0.88rem", color: "var(--gold-200)" }}>{admin.fullName}</span>
          <LogoutButton redirectTo="/admin/login" />
        </div>
      </header>

      <nav
        style={{
          display: "flex",
          overflowX: "auto",
          gap: "0.4rem",
          padding: "0.75rem 5vw",
          background: "#fff",
          borderBottom: "1px solid var(--line)",
        }}
      >
        {NAV.map((item) =>
          item.enabled ? (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: 4,
                fontSize: "0.88rem",
                fontWeight: 600,
                color: "var(--burgundy-900)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {item.label}
            </Link>
          ) : (
            <span
              key={item.href}
              title="Coming in a later phase"
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: 4,
                fontSize: "0.88rem",
                color: "var(--ink-600)",
                opacity: 0.5,
                whiteSpace: "nowrap",
                cursor: "default",
              }}
            >
              {item.label}
            </span>
          )
        )}
      </nav>

      <main style={{ flex: 1, padding: "4vh 5vw" }}>{children}</main>
    </div>
  );
}
