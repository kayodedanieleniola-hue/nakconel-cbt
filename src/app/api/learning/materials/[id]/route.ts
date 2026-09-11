import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await params;
  const material = await prisma.learningMaterial.findFirst({ where: { id, course: { students: { some: { id: session.sub, status: "active" } } } }, select: { fileName: true, mimeType: true, data: true } });
  if (!material) return NextResponse.json({ error: "Material not found" }, { status: 404 });
  const body = material.data.buffer.slice(material.data.byteOffset, material.data.byteOffset + material.data.byteLength) as ArrayBuffer;
  const inline = new URL(request.url).searchParams.get("view") === "inline";
  return new NextResponse(body, {
    headers: {
      "Content-Type": material.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${material.fileName.replace(/[\\\"]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      // Allow same-origin iframes (student presentation stage). The global
      // next.config.js sets X-Frame-Options: DENY; override it here so PDFs
      // and images can render inside the classroom iframe.
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
