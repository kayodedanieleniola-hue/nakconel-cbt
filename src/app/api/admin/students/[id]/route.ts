import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminGuard";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const student = await prisma.student.findUnique({
    where: { id },
    include: { course: { select: { id: true, name: true } } },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const { passwordHash, ...safe } = student;
  void passwordHash; // never send this to the client, under any circumstance
  return NextResponse.json({ student: safe });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const status = (body as { status?: string }).status;
  if (status !== "active" && status !== "disabled") {
    return NextResponse.json({ error: "status must be 'active' or 'disabled'" }, { status: 400 });
  }

  const student = await prisma.student.update({ where: { id }, data: { status } });

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: guard.session.sub,
      action: status === "disabled" ? "admin.disable_student" : "admin.enable_student",
      detail: `${student.studentId} (${student.fullName})`,
    },
  });

  return NextResponse.json({ ok: true, status: student.status });
}
