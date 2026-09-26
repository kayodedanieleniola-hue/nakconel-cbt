import { redirect } from "next/navigation";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import StudentShell from "@/components/StudentShell";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const session = await getStudentSession();
  if (!session || session.role !== "student") redirect("/login");

  const student = await prisma.student.findUnique({ where: { id: session.sub } });
  if (!student || student.status !== "active") redirect("/login");

  const attempts = await prisma.examAttempt.findMany({
    where: { studentId: student.id, status: { in: ["SUBMITTED", "TIMED_OUT"] } },
    include: { exam: { select: { name: true, passingScore: true } } },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <StudentShell studentName={student.fullName} backTitle="Results and history" backHref="/dashboard">
      <div style={{ maxWidth: 850, margin: "0 auto" }}>
        {/* Eyebrow and Heading */}
        <div style={{ marginBottom: "1.75rem" }}>
          <p
            style={{
              color: "var(--gold-600)",
              fontWeight: 700,
              fontSize: "0.88rem",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              margin: "0 0 0.35rem 0",
            }}
          >
            Student record
          </p>
          <h1
            style={{
              fontSize: "clamp(1.75rem, 4vw, 2.4rem)",
              fontWeight: 800,
              color: "var(--burgundy-900)",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Results and history
          </h1>
        </div>

        {/* Results List */}
        {attempts.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              border: "1px dashed var(--gold-400)",
              borderRadius: 8,
              padding: "2rem",
              textAlign: "center",
              color: "var(--ink-600)",
              fontSize: "0.95rem",
            }}
          >
            You have not completed an exam yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {attempts.map((attempt) => {
              const formattedDate = attempt.submittedAt
                ? new Date(attempt.submittedAt).toLocaleString("en-US", {
                    month: "numeric",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true,
                  })
                : "No submission time";

              const statusText =
                attempt.status === "TIMED_OUT"
                  ? "Timed out"
                  : attempt.passed
                  ? "Passed"
                  : "Completed";

              const isSuccess = attempt.passed;

              return (
                <article key={attempt.id} style={resultCardStyle}>
                  <div style={{ minWidth: 0 }}>
                    <h2
                      style={{
                        margin: "0 0 0.35rem 0",
                        fontSize: "1.2rem",
                        fontWeight: 700,
                        color: "var(--burgundy-900)",
                      }}
                    >
                      {attempt.exam.name}
                    </h2>
                    <p
                      style={{
                        margin: 0,
                        color: "var(--ink-600)",
                        fontSize: "0.88rem",
                        fontWeight: 500,
                      }}
                    >
                      {formattedDate}
                    </p>
                  </div>

                  <div className="result-card-right" style={{ textAlign: "right" }}>
                    <strong
                      style={{
                        display: "block",
                        color: isSuccess ? "var(--success)" : "var(--danger)",
                        fontSize: "1.4rem",
                        fontWeight: 800,
                        lineHeight: 1.2,
                      }}
                    >
                      {attempt.score ?? 0}%
                    </strong>
                    <p
                      style={{
                        margin: "0.25rem 0 0 0",
                        color: "var(--ink-600)",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      {statusText}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </StudentShell>
  );
}

const resultCardStyle = {
  background: "#ffffff",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "1.35rem 1.6rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1.25rem",
  flexWrap: "wrap",
  boxShadow: "var(--shadow-sm)",
} as const;
