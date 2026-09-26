import { redirect } from "next/navigation";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getExamStatus, STATUS_LABEL, type ExamStatus } from "@/lib/examStatus";
import StudentShell from "@/components/StudentShell";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams?: Promise<{ tab?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await getStudentSession();
  if (!session || session.role !== "student") {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeTab = resolvedSearchParams.tab || "overview";

  const student = await prisma.student.findUnique({
    where: { id: session.sub },
    include: {
      course: {
        include: {
          exams: { orderBy: { order: "asc" } },
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

  return (
    <StudentShell studentName={student.fullName}>
      <div style={{ maxWidth: 850, margin: "0 auto" }}>
        {/* Welcome Section */}
        <div style={{ marginBottom: "1.5rem" }}>
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

        {/* Student Navigation Tabs */}
        <div
          style={{
            display: "flex",
            gap: "0.6rem",
            marginBottom: "1.75rem",
            overflowX: "auto",
            paddingBottom: "0.25rem",
            scrollbarWidth: "none",
          }}
        >
          <a
            href="/dashboard"
            style={{
              ...tabBaseStyle,
              ...(activeTab === "overview" ? tabActiveStyle : tabInactiveStyle),
            }}
          >
            Overview
          </a>
          <a
            href="/dashboard?tab=my-course"
            style={{
              ...tabBaseStyle,
              ...(activeTab === "my-course" ? tabActiveStyle : tabInactiveStyle),
            }}
          >
            My Course
          </a>
          <a
            href="/results"
            style={{
              ...tabBaseStyle,
              ...(activeTab === "results" ? tabActiveStyle : tabInactiveStyle),
            }}
          >
            Results
          </a>
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
            marginBottom: "2.5rem",
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

        {/* Registered Course & Exams */}
        <div style={{ marginBottom: "1rem" }}>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 800,
              color: "var(--burgundy-900)",
              letterSpacing: "0.02em",
              marginBottom: "1.25rem",
            }}
          >
            {student.course.name.toUpperCase()}
          </h2>

          {exams.length === 0 ? (
            <div
              style={{
                background: "#ffffff",
                border: "1px dashed var(--gold-400)",
                borderRadius: 8,
                padding: "1.75rem",
                textAlign: "center",
                color: "var(--ink-600)",
                fontSize: "0.95rem",
              }}
            >
              No assessments have been configured for this course yet.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "1rem" }}>
              {exams.map((exam) => (
                <div key={exam.id} style={examCardStyle}>
                  <div>
                    <h3
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "1.15rem",
                        fontWeight: 700,
                        margin: "0 0 0.4rem 0",
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
                      {exam.numQuestions} Questions &middot; Duration: {exam.durationMinutes} Minutes
                    </p>
                  </div>

                  {exam.status === "ONGOING" ? (
                    <a href={`/exam/${exam.id}`} style={startButtonProps}>
                      Start exam
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
        padding: "0.4rem 0.85rem",
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

const tabBaseStyle = {
  minHeight: 40,
  display: "inline-flex",
  alignItems: "center",
  padding: "0.45rem 1.1rem",
  borderRadius: 6,
  fontSize: "0.88rem",
  fontWeight: 700,
  textDecoration: "none",
  transition: "all 0.15s ease",
} as const;

const tabActiveStyle = {
  background: "var(--burgundy-900)",
  borderColor: "var(--burgundy-900)",
  color: "#ffffff",
} as const;

const tabInactiveStyle = {
  background: "#ffffff",
  border: "1px solid var(--line)",
  color: "var(--burgundy-900)",
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
  borderRadius: 8,
  padding: "1.25rem 1.5rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  flexWrap: "wrap",
  boxShadow: "var(--shadow-sm)",
} as const;

const startButtonProps = {
  background: "var(--burgundy-900)",
  color: "#ffffff",
  padding: "0.55rem 1.1rem",
  borderRadius: 6,
  fontSize: "0.85rem",
  fontWeight: 700,
  textDecoration: "none",
  whiteSpace: "nowrap",
  boxShadow: "0 2px 6px rgba(117, 16, 11, 0.2)",
} as const;
