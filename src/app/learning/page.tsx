import Link from "next/link";
import { redirect } from "next/navigation";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";
import RefreshButton from "@/components/RefreshButton";

export const dynamic = "force-dynamic";

export default async function MyCoursePage() {
  const session = await getStudentSession();
  if (!session) redirect("/login");

  const student = await prisma.student.findUnique({
    where: { id: session.sub },
    include: {
      course: {
        include: {
          modules: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" }, select: { id: true, title: true } }, classes: { orderBy: { createdAt: "asc" }, select: { id: true, title: true } } } },
          classes: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, moduleId: true } },
        },
      },
    },
  });
  if (!student || student.status !== "active") redirect("/login");

  const standaloneClasses = student.course.classes.filter((item) => !item.moduleId);
  return (
    <main style={shell}>
      <header style={header}>
        <Link href="/dashboard" style={brand}>Nak Learning Center</Link>
        <div style={actions}><Link href="/dashboard" style={link}>CBT dashboard</Link><RefreshButton /><LogoutButton /></div>
      </header>
      <section style={content}>
        <p style={eyebrow}>My course</p>
        <h1 style={title}>{student.course.name}</h1>
        <p style={intro}>Welcome, {student.fullName}. This is your learning space for course modules, lessons, and classes.</p>
        <div style={identity}><div><span style={label}>Student ID</span><strong>{student.studentId}</strong></div><div><span style={label}>Registered course</span><strong>{student.course.name}</strong></div></div>
        <h2 style={heading}>Course modules</h2>
        {student.course.modules.length === 0 ? <div style={empty}>Your course structure is being prepared. Modules and lessons will appear here when your administrator adds them.</div> : <div style={moduleList}>{student.course.modules.map((module, index) => <article key={module.id} style={moduleCard}><div style={moduleNumber}>{String(index + 1).padStart(2, "0")}</div><div style={{ flex: 1 }}><h3 style={{ margin: 0, color: "var(--burgundy-900)" }}>{module.title}</h3>{module.description && <p style={muted}>{module.description}</p>}<div style={sectionRow}><span>{module.lessons.length} lesson{module.lessons.length === 1 ? "" : "s"}</span><span>{module.classes.length} class{module.classes.length === 1 ? "" : "es"}</span></div>{module.lessons.length > 0 && <ul style={items}>{module.lessons.map((lesson) => <li key={lesson.id}>{lesson.title}</li>)}</ul>}{module.classes.length > 0 && <p style={classNote}>Classes: {module.classes.map((item) => item.title).join(", ")}</p>}</div></article>)}</div>}
        <h2 style={heading}>Classes</h2>
        {student.course.classes.length === 0 ? <div style={empty}>No classes have been added to this course yet.</div> : <div style={classGrid}>{standaloneClasses.map((item) => <article key={item.id} style={classCard}><p style={eyebrow}>Course class</p><h3 style={{ margin: "0.2rem 0", color: "var(--burgundy-900)" }}>{item.title}</h3><p style={muted}>Class scheduling and joining will be added in the next Learning Center phases.</p></article>)}{student.course.modules.flatMap((module) => module.classes.map((item) => <article key={item.id} style={classCard}><p style={eyebrow}>{module.title}</p><h3 style={{ margin: "0.2rem 0", color: "var(--burgundy-900)" }}>{item.title}</h3><p style={muted}>Class foundation created.</p></article>))}</div>}
      </section>
    </main>
  );
}

const shell = { minHeight: "100dvh", background: "var(--cream-50)" } as const;
const header = { background: "var(--burgundy-900)", color: "var(--cream-50)", padding: "1.1rem 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" } as const;
const brand = { color: "inherit", fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "1.2rem", textDecoration: "none" } as const;
const actions = { display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" } as const;
const link = { color: "inherit", textDecoration: "none", fontSize: "0.9rem" } as const;
const content = { maxWidth: 1000, margin: "0 auto", padding: "5vh 6vw" } as const;
const eyebrow = { color: "var(--gold-600)", fontSize: "0.82rem", fontWeight: 600, margin: 0 } as const;
const title = { fontSize: "clamp(2rem, 5vw, 3rem)", color: "var(--burgundy-900)", margin: "0.35rem 0" } as const;
const intro = { color: "var(--ink-600)", maxWidth: 650, lineHeight: 1.6 } as const;
const identity = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem", background: "#fff", border: "1px solid var(--line)", borderRadius: 8, padding: "1.2rem", margin: "2rem 0" } as const;
const label = { display: "block", color: "var(--ink-600)", fontSize: "0.78rem", marginBottom: "0.25rem" } as const;
const heading = { color: "var(--burgundy-900)", fontSize: "1.35rem", margin: "2rem 0 0.8rem" } as const;
const empty = { background: "#fff", border: "1px dashed var(--gold-400)", borderRadius: 8, padding: "1.25rem", color: "var(--ink-600)" } as const;
const moduleList = { display: "grid", gap: "0.8rem" } as const;
const moduleCard = { background: "#fff", border: "1px solid var(--line)", borderRadius: 8, padding: "1.1rem", display: "flex", gap: "1rem" } as const;
const moduleNumber = { background: "var(--burgundy-900)", color: "var(--gold-200)", width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 600, flex: "0 0 auto" } as const;
const muted = { color: "var(--ink-600)", fontSize: "0.9rem", lineHeight: 1.5 } as const;
const sectionRow = { display: "flex", gap: "1rem", color: "var(--gold-600)", fontSize: "0.82rem", fontWeight: 600 } as const;
const items = { margin: "0.7rem 0 0", paddingLeft: "1.15rem", color: "var(--ink-900)", display: "grid", gap: "0.3rem", fontSize: "0.9rem" } as const;
const classNote = { color: "var(--ink-600)", fontSize: "0.85rem", marginBottom: 0 } as const;
const classGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.8rem" } as const;
const classCard = { background: "#fff", border: "1px solid var(--line)", borderRadius: 8, padding: "1.1rem" } as const;
