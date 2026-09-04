import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const events = await prisma.auditLog.findMany({
    where: {
      action: {
        in: [
          "student.login_failed",
          "admin.login_failed",
          "student.exam_timeout",
          "student.identity_mismatch",
          "student.presence_no_face",
          "student.presence_multiple_faces",
          "student.camera_blocked",
          "student.camera_disconnected",
          "student.duplicate_session",
          "student.fullscreen_exited",
          "student.tab_hidden",
          "admin.warn_student",
          "admin.terminate_exam",
          "admin.force_submit_exam",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ events });
}
