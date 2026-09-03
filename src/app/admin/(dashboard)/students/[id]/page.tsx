import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getExamStatus, STATUS_LABEL } from "@/lib/examStatus";
import StatusToggleButton from "./StatusToggleButton";

export const dynamic = "force-dynamic";

export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      course: {
        include: { exams: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!student) notFound();

  const now = new Date();

  return (
    <div>
      <Link href="/admin/students" style={{ color: "var(--ink-600)", fontSize: "0.9rem", textDecoration: "none" }}>
        ← All students
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", margin: "1rem 0 2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", marginBottom: "0.3rem" }}>{student.fullName}</h1>
          <p style={{ color: "var(--ink-600)" }}>{student.studentId} &middot; {student.course.name}</p>
        </div>
        <StatusToggleButton studentDbId={student.id} status={student.status} />
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 6,
          padding: "1.5rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1.25rem",
          marginBottom: "2rem",
        }}
      >
        <Field label="Email" value={student.email} />
        <Field label="Phone" value={student.phone} />
        <Field label="Age" value={String(student.age)} />
        <Field label="Gender" value={student.gender} />
        <Field label="Address" value={student.address} />
        <Field label="Social media" value={student.socialMedia || "—"} />
        <Field label="Registered" value={student.createdAt.toLocaleDateString()} />
        <Field label="Status" value={student.status === "active" ? "Active" : "Disabled"} />
      </div>

      <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Exam activity</h2>
      {student.course.exams.length === 0 ? (
        <div style={{ border: "1px dashed var(--gold-400)", borderRadius: 6, padding: "1.5rem", color: "var(--ink-600)" }}>
          No exams configured for this course yet.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
          {student.course.exams.map((exam, i) => (
            <div
              key={exam.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "0.85rem 1.25rem",
                borderTop: i === 0 ? "none" : "1px solid var(--line)",
              }}
            >
              <span>{exam.name}</span>
              <span style={{ color: "var(--ink-600)", fontSize: "0.88rem" }}>
                {STATUS_LABEL[getExamStatus(exam, now)]}
              </span>
            </div>
          ))}
        </div>
      )}
      <p style={{ color: "var(--ink-600)", fontSize: "0.85rem", marginTop: "0.75rem" }}>
        Attempts and scores will appear here once the exam engine is live.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: "0.8rem", color: "var(--ink-600)", marginBottom: "0.2rem" }}>{label}</p>
      <p style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", color: "var(--burgundy-900)", margin: 0 }}>{value}</p>
    </div>
  );
}
