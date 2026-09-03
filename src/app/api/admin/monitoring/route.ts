import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const now = new Date();
  const attempts = await prisma.examAttempt.findMany({
    where: { status: "IN_PROGRESS" },
    include: {
      student: { select: { studentId: true, fullName: true, email: true } },
      exam: { select: { name: true, course: { select: { name: true } } } },
    },
    orderBy: { startedAt: "asc" },
  });

  const active = attempts.filter((attempt) => attempt.expiresAt > now);
  const expiredIds = attempts.filter((attempt) => attempt.expiresAt <= now).map((attempt) => attempt.id);
  if (expiredIds.length) {
    await prisma.examAttempt.updateMany({
      where: { id: { in: expiredIds }, status: "IN_PROGRESS" },
      data: { status: "TIMED_OUT", submittedAt: now, score: 0, passed: false },
    });
  }

  return NextResponse.json({ attempts: active.map((attempt) => ({
    id: attempt.id,
    student: attempt.student,
    exam: attempt.exam.name,
    course: attempt.exam.course.name,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
  })) });
}
