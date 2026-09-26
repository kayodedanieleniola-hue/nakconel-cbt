import Link from "next/link";
import { redirect } from "next/navigation";
import { getStudentSession, getLcSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import LcLogoutButton from "@/components/LcLogoutButton";
import RefreshButton from "@/components/RefreshButton";
import StudentLearningDashboard from "@/components/StudentLearningDashboard";
import StudentShell from "@/components/StudentShell";
import { getExamStatus } from "@/lib/examStatus";
import { syncLearningClassStatuses } from "@/lib/learningSchedule";

export const dynamic = "force-dynamic";

export default async function MyCoursePage() {
  const cbtSession = await getStudentSession();
  const lcSession = await getLcSession();

  if (!cbtSession && !lcSession) redirect("/learning/login");
  await syncLearningClassStatuses();

  // ── EXTERNAL LC STUDENT ────────────────────────────────
  if (lcSession && !cbtSession) {
    const profile = await prisma.learningProfile.findUnique({
      where: { id: lcSession.profileId },
    });
    if (!profile) redirect("/learning/login");

    const generalMeetings = await prisma.learningClass.findMany({
      where: { isGeneral: true, status: { in: ["LIVE", "SCHEDULED"] } },
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true, instructor: true, status: true, startsAt: true, endsAt: true },
    });

    return (
      <StudentShell studentName={profile.fullName} backTitle="Learning Center" backHref="/dashboard">
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={eyebrowStyle}>Learning Center</p>
          <h1 style={titleStyle}>Welcome back, {profile.fullName.split(" ")[0]}</h1>
          <p style={introStyle}>
            Your registered course, learning content, upcoming classes, and assessment information in one place.
          </p>

          <div style={infoCardStyle}>
            <div>
              <p style={infoLabel}>Email</p>
              <p style={infoValue}>{profile.email}</p>
            </div>
            <div>
              <p style={infoLabel}>Registered course</p>
              <p style={infoValue}>{profile.program}</p>
            </div>
          </div>

          <h2 style={headingStyle}>General Meetings</h2>
          {generalMeetings.length === 0 ? (
            <div style={emptyCardStyle}>No general meetings are currently live or scheduled.</div>
          ) : (
            <div style={{ display: "grid", gap: "0.8rem" }}>
              {generalMeetings.map((item) => (
                <article key={item.id} style={classCardStyle}>
                  <div>
                    <h3 style={{ margin: "0 0 0.3rem 0", color: "var(--burgundy-900)", fontSize: "1.1rem" }}>
                      {item.title}
                    </h3>
                    {item.instructor && <p style={mutedStyle}>Host: {item.instructor}</p>}
                    {item.startsAt && <p style={mutedStyle}>{formatDate(item.startsAt)}</p>}
                  </div>
                  {item.status === "LIVE" && (
                    <Link href={`/learning/general/${item.id}`} style={joinBtnStyle}>
                      Join meeting &rarr;
                    </Link>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </StudentShell>
    );
  }

  // ── CBT STUDENT ──────────────────────────────────────
  const session = cbtSession!;
  const generalMeetings = await prisma.learningClass.findMany({
    where: { isGeneral: true, status: { in: ["LIVE", "SCHEDULED"] } },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, instructor: true, status: true, startsAt: true, endsAt: true },
  });

  const student = await prisma.student.findUnique({
    where: { id: session.sub },
    include: {
      course: {
        include: {
          modules: {
            orderBy: { position: "asc" },
            include: {
              lessons: { orderBy: { position: "asc" }, select: { id: true, title: true } },
              classes: {
                orderBy: { startsAt: "asc" },
                select: { id: true, title: true, startsAt: true, endsAt: true, status: true, recordingUrl: true },
              },
            },
          },
          classes: {
            orderBy: { startsAt: "asc" },
            select: { id: true, title: true, moduleId: true, startsAt: true, endsAt: true, status: true, recordingUrl: true },
          },
          materials: { orderBy: { createdAt: "desc" }, select: { id: true, title: true, fileName: true, sizeBytes: true } },
          exams: { orderBy: { order: "asc" }, select: { id: true, name: true, published: true, startAt: true, endAt: true } },
        },
      },
    },
  });

  if (!student || student.status !== "active") redirect("/login");

  const attendances = await prisma.classAttendance.findMany({
    where: { studentId: student.studentId },
  });

  const attempts = await prisma.examAttempt.findMany({
    where: { studentId: student.id, passed: true },
  });

  const assignments = await prisma.assignment.findMany({
    where: { courseId: student.course.id },
    include: { submissions: { where: { studentId: student.id } } },
    orderBy: { createdAt: "desc" },
  });

  const standaloneClasses = student.course.classes.filter((item) => !item.moduleId);
  const now = new Date();
  const allClasses = [...student.course.classes, ...student.course.modules.flatMap((module) => module.classes)];
  const classCount = allClasses.length;

  const totalClassesCount = classCount || 1;
  const totalExamsCount = student.course.exams.length || 1;
  const attendedCount = attendances.length;
  const passedExamsCount = attempts.length;

  const progressPercent = Math.min(
    100,
    Math.round(((attendedCount / totalClassesCount) * 0.5 + (passedExamsCount / totalExamsCount) * 0.5) * 100) || 100
  );

  const studentFirstName = student.fullName.split(" ")[0];

  return (
    <StudentShell studentName={student.fullName} backTitle="Learning Center" backHref="/dashboard">
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Eyebrow & Title */}
        <p style={eyebrowStyle}>Learning Center</p>
        <h1 style={titleStyle}>Welcome back, {studentFirstName}</h1>
        <p style={introStyle}>
          Your registered course, learning content, upcoming classes, and assessment information in one place.
        </p>

        {/* Student Information Card */}
        <div style={infoCardStyle}>
          <div>
            <p style={infoLabel}>Student ID</p>
            <p style={infoValue}>{student.studentId}</p>
          </div>
          <div>
            <p style={infoLabel}>Registered course</p>
            <p style={infoValue}>{student.course.name}</p>
          </div>
        </div>

        {/* Verified Course Progress & Recorded Replays */}
        <StudentLearningDashboard
          studentName={student.fullName}
          studentId={student.studentId}
          courseName={student.course.name}
          progressPercent={progressPercent}
          attendedCount={attendedCount}
          totalClasses={totalClassesCount}
          passedExamsCount={passedExamsCount}
          totalExams={totalExamsCount}
          allClasses={allClasses.map((c) => ({
            id: c.id,
            title: c.title,
            startsAt: c.startsAt ? c.startsAt.toISOString() : null,
            endsAt: c.endsAt ? c.endsAt.toISOString() : null,
            status: c.status,
            recordingUrl: c.recordingUrl,
          }))}
          materials={student.course.materials}
        />

        {/* Course Modules */}
        {student.course.modules.length > 0 && (
          <div style={{ marginTop: "2rem" }}>
            <h2 style={headingStyle}>Course Modules</h2>
            <div style={{ display: "grid", gap: "0.85rem" }}>
              {student.course.modules.map((module, index) => (
                <article key={module.id} style={moduleCardStyle}>
                  <div style={moduleNumStyle}>{String(index + 1).padStart(2, "0")}</div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 0.3rem 0", color: "var(--burgundy-900)", fontSize: "1.1rem" }}>
                      {module.title}
                    </h3>
                    {module.description && <p style={mutedStyle}>{module.description}</p>}
                    {module.lessons.length > 0 && (
                      <ul style={lessonListStyle}>
                        {module.lessons.map((lesson) => (
                          <li key={lesson.id}>{lesson.title}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* General Meetings */}
        {generalMeetings.length > 0 && (
          <div style={{ marginTop: "2rem" }}>
            <h2 style={headingStyle}>General Meetings</h2>
            <p style={mutedStyle}>General meetings are open to all students.</p>
            <div style={{ display: "grid", gap: "0.85rem", marginTop: "0.75rem" }}>
              {generalMeetings.map((item) => (
                <article key={item.id} style={classCardStyle}>
                  <div>
                    <h3 style={{ margin: "0 0 0.2rem 0", color: "var(--burgundy-900)", fontSize: "1.05rem" }}>
                      {item.title}
                    </h3>
                    {item.instructor && <p style={mutedStyle}>Host: {item.instructor}</p>}
                    {item.startsAt && <p style={mutedStyle}>{formatDate(item.startsAt)}</p>}
                  </div>
                  {item.status === "LIVE" && (
                    <Link href={`/learning/general/${item.id}`} style={joinBtnStyle}>
                      Join meeting &rarr;
                    </Link>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}

        {/* Course Materials */}
        {student.course.materials.length > 0 && (
          <div style={{ marginTop: "2rem" }}>
            <h2 style={headingStyle}>Course Materials</h2>
            <div style={{ display: "grid", gap: "0.85rem", marginTop: "0.75rem" }}>
              {student.course.materials.map((material) => (
                <article key={material.id} style={classCardStyle}>
                  <div>
                    <h3 style={{ margin: "0 0 0.2rem 0", color: "var(--burgundy-900)", fontSize: "1.05rem" }}>
                      {material.title}
                    </h3>
                    <p style={mutedStyle}>
                      {material.fileName} &middot; {Math.ceil(material.sizeBytes / 1024)} KB
                    </p>
                  </div>
                  <a href={`/api/learning/materials/${material.id}`} style={downloadBtnStyle}>
                    Download
                  </a>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </StudentShell>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const eyebrowStyle = {
  color: "var(--gold-600)",
  fontSize: "0.85rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  margin: "0 0 0.35rem 0",
} as const;

const titleStyle = {
  fontSize: "clamp(1.75rem, 4vw, 2.4rem)",
  fontWeight: 800,
  color: "var(--burgundy-900)",
  margin: "0 0 0.5rem 0",
  letterSpacing: "-0.02em",
} as const;

const introStyle = {
  color: "var(--ink-600)",
  maxWidth: 620,
  lineHeight: 1.55,
  fontSize: "0.95rem",
  margin: "0 0 1.5rem 0",
} as const;

const infoCardStyle = {
  background: "#ffffff",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "1.4rem 1.6rem",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "1.4rem",
  marginBottom: "1.5rem",
  boxShadow: "var(--shadow-sm)",
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

const headingStyle = {
  color: "var(--burgundy-900)",
  fontSize: "1.35rem",
  fontWeight: 800,
  margin: "1.75rem 0 0.85rem 0",
} as const;

const emptyCardStyle = {
  background: "#ffffff",
  border: "1px dashed var(--gold-400)",
  borderRadius: 8,
  padding: "1.5rem",
  color: "var(--ink-600)",
  fontSize: "0.9rem",
  textAlign: "center",
} as const;

const moduleCardStyle = {
  background: "#ffffff",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "1.25rem 1.4rem",
  display: "flex",
  gap: "1.1rem",
  alignItems: "flex-start",
  boxShadow: "var(--shadow-sm)",
} as const;

const moduleNumStyle = {
  background: "var(--burgundy-900)",
  color: "var(--gold-200)",
  width: 38,
  height: 38,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontWeight: 700,
  fontSize: "0.9rem",
  flex: "0 0 auto",
} as const;

const mutedStyle = {
  color: "var(--ink-600)",
  fontSize: "0.88rem",
  lineHeight: 1.5,
  margin: "0.2rem 0 0 0",
} as const;

const lessonListStyle = {
  margin: "0.75rem 0 0 0",
  paddingLeft: "1.2rem",
  color: "var(--ink-900)",
  display: "grid",
  gap: "0.3rem",
  fontSize: "0.88rem",
} as const;

const classCardStyle = {
  background: "#ffffff",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "1.1rem 1.4rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  flexWrap: "wrap",
  boxShadow: "var(--shadow-sm)",
} as const;

const downloadBtnStyle = {
  display: "inline-block",
  background: "var(--burgundy-900)",
  color: "#ffffff",
  borderRadius: 6,
  padding: "0.45rem 1rem",
  fontSize: "0.82rem",
  fontWeight: 700,
  textDecoration: "none",
  whiteSpace: "nowrap",
} as const;

const joinBtnStyle = {
  ...downloadBtnStyle,
  background: "#98661B",
} as const;
