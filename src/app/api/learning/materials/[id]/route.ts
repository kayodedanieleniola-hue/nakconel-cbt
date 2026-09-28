import { NextResponse } from "next/server";
import { getStudentSession, getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const studentSession = await getStudentSession();
  const adminSession = await getAdminSession();

  if (!studentSession && !adminSession) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;

  let material;
  if (adminSession) {
    material = await prisma.learningMaterial.findUnique({
      where: { id },
      select: { fileName: true, mimeType: true, data: true },
    });
  } else if (studentSession) {
    material = await prisma.learningMaterial.findFirst({
      where: { id, course: { students: { some: { id: studentSession.sub, status: "active" } } } },
      select: { fileName: true, mimeType: true, data: true },
    });
  }

  if (!material) return NextResponse.json({ error: "Material not found" }, { status: 404 });

  const body = material.data.buffer.slice(
    material.data.byteOffset,
    material.data.byteOffset + material.data.byteLength
  ) as ArrayBuffer;

  // Always serve inline for viewing inside the application without forcing download attachments
  return new NextResponse(body, {
    headers: {
      "Content-Type": material.mimeType || "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
