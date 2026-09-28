import { redirect } from "next/navigation";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getExamStatus, STATUS_LABEL, type ExamStatus } from "@/lib/examStatus";
import StudentShell from "@/components/StudentShell";
import StudentCurriculumView from "@/components/StudentCurriculumView";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getStudentSession();
  if (!session || session.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.student.findUnique({
    where: { id: session.sub },
    include: {
      course: {
        include: {
          exams: { orderBy: { order: "asc" } },
          curriculum: {
            orderBy: [{ weekNumber: "asc" }, { position: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!student || student.status !== "active") {
    redirect("/login");
  }

  const now = new Date();
  const exams = student.course.exams.map((exam) => ({
    ...exam,
    status: getExamStatus(exam, now),
  }));

  const studentFirstName = student.fullName.split(" ")[0];

  return (
    <StudentShell studentName={student.fullName}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Welcome Section */}
        <div style={{ marginBottom: "1.5rem" }}>
          <p
            style={{
              color: "var(--gold-600)",
              fontWeight: 700,
              fontSize: "0.85rem",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              margin: "0 0 0.35rem 0",
            }}
          >
            Welcome back
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
            {student.fullName}
          </h1>
        </div>

        {/* Student Information Card */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "1.4rem 1.6rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1.4rem",
            marginBottom: "1.75rem",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div>
            <p style={infoLabel}>Student ID</p>
            <p style={infoValue}>{student.studentId}</p>
          </div>
          <div>
            <p style={infoLabel}>Enrolled course</p>
            <p style={infoValue}>{student.course.name}</p>
          </div>
          <div>
            <p style={infoLabel}>Email</p>
            <p style={infoValueEmail}>{student.email}</p>
          </div>
        </div>

        {/* ── COURSE COMPLETION & CURRICULUM SECTION ───────────── */}
        <StudentCurriculumView
          courseName={student.course.name}
          items={student.course.curriculum || []}
        />

        {/* ── TESTS SECTION (Test 1, Test 2, Test 3...) ──────── */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <p style={eyebrowStyle}>Assessments</p>
            <h2
              style={{
                fontSize: "1.4rem",
                fontWeight: 800,
                color: "var(--burgundy-900)",
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              Course Tests & Exams
            </h2>
            <p style={{ color: "var(--ink-600)", fontSize: "0.9rem", margin: "0.35rem 0 0 0" }}>
              Take your official computer-based tests and view schedule details.
            </p>
          </div>

          {exams.length === 0 ? (
            <div
              style={{
                background: "#ffffff",
                border: "1px dashed var(--gold-400)",
                borderRadius: 10,
                padding: "2rem",
                textAlign: "center",
                color: "var(--ink-600)",
                fontSize: "0.95rem",
              }}
            >
              No tests or assessments have been configured for <strong>{student.course.name}</strong> yet.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "1rem" }}>
              {exams.map((exam, idx) => (
                <div key={exam.id} style={examCardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={testBadgeStyle}>
                      T{idx + 1}
                    </div>
                    <div>
                      <h3
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "1.15rem",
                          fontWeight: 800,
                          margin: "0 0 0.3rem 0",
                          color: "var(--burgundy-900)",
                        }}
                      >
                        {exam.name}
                      </h3>
                      <p
                        style={{
                          color: "var(--ink-600)",
                          fontSize: "0.88rem",
                          margin: 0,
                          fontWeight: 500,
                        }}
                      >
                        {exam.numQuestions} Questions &middot; Duration: {exam.durationMinutes} Minutes &middot; Pass score: {exam.passingScore}%
                      </p>
                    </div>
                  </div>

                  {exam.status === "ONGOING" ? (
                    <a href={`/exam/${exam.id}`} style={startButtonProps}>
                      Start exam &rarr;
                    </a>
                  ) : (
                    <StatusBadge status={exam.status} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </StudentShell>
  );
}

function StatusBadge({ status }: { status: ExamStatus }) {
  const colors: Record<ExamStatus, { bg: string; fg: string }> = {
    NOT_CONFIGURED: { bg: "#efe9e0", fg: "var(--ink-600)" },
    UPCOMING: { bg: "#f1e2c2", fg: "#98661B" },
    ONGOING: { bg: "#e4f0e6", fg: "var(--success)" },
    CLOSED: { bg: "#f2e3e0", fg: "var(--danger)" },
  };
  const c = colors[status] || colors.NOT_CONFIGURED;
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        padding: "0.45rem 0.9rem",
        borderRadius: 6,
        fontSize: "0.82rem",
        fontWeight: 700,
        whiteSpace: "nowrap",
        alignSelf: "center",
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const eyebrowStyle = {
  color: "var(--gold-600)",
  fontSize: "0.82rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  margin: "0 0 0.3rem 0",
} as const;

const infoLabel = {
  fontSize: "0.78rem",
  color: "var(--ink-600)",
  margin: "0 0 0.35rem 0",
  fontWeight: 500,
} as const;

const infoValue = {
  fontFamily: "var(--font-display)",
  fontSize: "1.1rem",
  fontWeight: 700,
  color: "var(--burgundy-900)",
  margin: 0,
} as const;

const infoValueEmail = {
  fontFamily: "var(--font-display)",
  fontSize: "1rem",
  fontWeight: 700,
  color: "var(--burgundy-900)",
  margin: 0,
  wordBreak: "break-all",
} as const;

const examCardStyle = {
  background: "#ffffff",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "1.25rem 1.5rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  flexWrap: "wrap",
  boxShadow: "var(--shadow-sm)",
} as const;

const testBadgeStyle = {
  background: "#faf6f0",
  border: "1px solid var(--gold-400)",
  color: "var(--burgundy-900)",
  width: 44,
  height: 44,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontWeight: 800,
  fontSize: "0.9rem",
  flexShrink: 0,
} as const;

const startButtonProps = {
  background: "var(--burgundy-900)",
  color: "#ffffff",
  padding: "0.6rem 1.25rem",
  borderRadius: 6,
  fontSize: "0.88rem",
  fontWeight: 700,
  textDecoration: "none",
  whiteSpace: "nowrap",
  boxShadow: "0 2px 6px rgba(117, 16, 11, 0.2)",
} as const;
