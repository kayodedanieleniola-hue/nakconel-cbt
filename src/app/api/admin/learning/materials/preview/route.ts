/**
 * GET /api/admin/learning/materials/preview?id=<materialId>&page=<n>
 *
 * Serves a learning material file for the instructor's presentation stage.
 * Only accessible to authenticated admins (verified server-side).
 *
 * For PDFs, if a `page` param is supplied we append `#page=N` via a redirect
 * to the inline viewer so the browser's PDF plugin jumps to the right page.
 * For images and SVGs the binary is served directly inline.
 * For all other formats the file is served as an attachment (download).
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url  = new URL(request.url);
  const id   = url.searchParams.get("id") ?? "";
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const material = await prisma.learningMaterial.findUnique({
    where: { id },
    select: { fileName: true, mimeType: true, data: true },
  });

  if (!material) return NextResponse.json({ error: "Material not found" }, { status: 404 });

  const body = material.data.buffer.slice(
    material.data.byteOffset,
    material.data.byteOffset + material.data.byteLength
  ) as ArrayBuffer;

  const safeName = material.fileName.replace(/[\\"\r\n]/g, "_");
  const mime     = material.mimeType.toLowerCase();

  const isImage = mime.startsWith("image/");
  const isPdf   = mime === "application/pdf";
  const inline  = isImage || isPdf;

  // For PDFs with a page param, serve inline so the iframe receives the full
  // document and the browser scrolls to the requested page via the URL hash
  // which is appended client-side by the iframe src.
  return new NextResponse(body, {
    headers: {
      "Content-Type": material.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      // Expose the page number as a header so the client can read it if needed
      "X-Presentation-Page": String(isNaN(page) ? 1 : page),
    },
  });
}
