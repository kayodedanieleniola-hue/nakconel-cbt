import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.student.findUnique({
    where: { id: session.sub },
    include: { course: true },
  });

  if (!student || student.status !== "active") {
    redirect("/login");
  }

  return (
    <main style={{ minHeight: "100dvh", background: "var(--cream-50)" }}>
      <header
        style={{
          background: "var(--burgundy-900)",
          color: "var(--cream-50)",
          padding: "1.1rem 6vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "1.15rem" }}>
          Nakconel Examinations
        </span>
        <LogoutButton />
      </header>

      <section style={{ padding: "5vh 6vw", maxWidth: 720 }}>
        <p style={{ color: "var(--gold-600)", fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.4rem" }}>
          Welcome back
        </p>
        <h1 style={{ fontSize: "2rem", marginBottom: "1.75rem" }}>{student.fullName}</h1>

        <div
          style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 6,
            padding: "1.5rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1.25rem",
            marginBottom: "2rem",
          }}
        >
          <div>
            <p style={fieldLabel}>Student ID</p>
            <p style={fieldValue}>{student.studentId}</p>
          </div>
          <div>
            <p style={fieldLabel}>Enrolled course</p>
            <p style={fieldValue}>{student.course.name}</p>
          </div>
          <div>
            <p style={fieldLabel}>Email</p>
            <p style={fieldValue}>{student.email}</p>
          </div>
        </div>

        <div
          style={{
            border: "1px dashed var(--gold-400)",
            borderRadius: 6,
            padding: "1.5rem",
            color: "var(--ink-600)",
          }}
        >
          Your exam schedule, upcoming tests, and results will appear here once the exam
          engine is live.
        </div>
      </section>
    </main>
  );
}

const fieldLabel = { fontSize: "0.8rem", color: "var(--ink-600)", marginBottom: "0.2rem" };
const fieldValue = { fontFamily: "var(--font-display)", fontSize: "1.15rem", color: "var(--burgundy-900)", margin: 0 };
