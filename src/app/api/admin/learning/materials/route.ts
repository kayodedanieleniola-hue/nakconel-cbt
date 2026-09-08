import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminGuard";

export const dynamic = "force-dynamic";
const MAX_FILE_SIZE = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  const courseId = String(form.get("courseId") ?? "");
  const moduleId = String(form.get("moduleId") ?? "") || null;
  const classId = String(form.get("classId") ?? "") || null;
  const title = String(form.get("title") ?? "").trim();
  const file = form.get("file");
  if (!courseId || title.length < 2 || !(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Course, title, and a file are required" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Files must be 4 MB or smaller" }, { status: 400 });
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  if (moduleId && !(await prisma.learningModule.findFirst({ where: { id: moduleId, courseId } }))) return NextResponse.json({ error: "Module does not belong to this course" }, { status: 400 });
  if (classId && !(await prisma.learningClass.findFirst({ where: { id: classId, courseId } }))) return NextResponse.json({ error: "Class does not belong to this course" }, { status: 400 });
  const material = await prisma.learningMaterial.create({ data: { courseId, moduleId, classId, title, fileName: file.name || "material", mimeType: file.type || "application/octet-stream", sizeBytes: file.size, data: Buffer.from(await file.arrayBuffer()) }, select: { id: true, title: true, fileName: true } });
  await prisma.auditLog.create({ data: { actorType: "admin", actorId: guard.session.sub, action: "admin.upload_learning_material", detail: `${course.name}: ${material.title}` } });
  return NextResponse.json({ material }, { status: 201 });
}

export async function DELETE(request: Request) {
  const guard = await requireAdmin(); if (!guard.ok) return guard.response;
  const id = new URL(request.url).searchParams.get("id"); if (!id) return NextResponse.json({ error: "Material ID is required" }, { status: 400 });
  await prisma.learningMaterial.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
