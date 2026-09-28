import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");

  try {
    const where = courseId ? { courseId } : {};
    const items = await prisma.curriculumItem.findMany({
      where,
      orderBy: [{ weekNumber: "asc" }, { position: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Failed to fetch curriculum items:", error);
    return NextResponse.json({ error: "Failed to fetch curriculum items" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Support bulk insertion if body has `items` array
    if (Array.isArray(body.items) && body.courseId) {
      const created = await prisma.$transaction(
        body.items.map((item: { weekNumber?: number; weekTitle?: string; title: string; description?: string; status?: string }, idx: number) =>
          prisma.curriculumItem.create({
            data: {
              courseId: body.courseId,
              weekNumber: Number(item.weekNumber) || 1,
              weekTitle: item.weekTitle || `Week ${item.weekNumber || 1}`,
              title: item.title,
              description: item.description || null,
              status: item.status || "NOT_DONE",
              position: idx,
            },
          })
        )
      );
      return NextResponse.json({ success: true, count: created.length });
    }

    const { courseId, weekNumber, weekTitle, title, description, status } = body;

    if (!courseId || !title?.trim()) {
      return NextResponse.json({ error: "Course ID and Title are required" }, { status: 400 });
    }

    const item = await prisma.curriculumItem.create({
      data: {
        courseId,
        weekNumber: Number(weekNumber) || 1,
        weekTitle: weekTitle?.trim() || `Week ${Number(weekNumber) || 1}`,
        title: title.trim(),
        description: description?.trim() || null,
        status: status || "NOT_DONE",
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("Failed to create curriculum item:", error);
    return NextResponse.json({ error: "Failed to create curriculum item" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, weekNumber, weekTitle, title, description, status } = body;

    if (!id) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    const data: Record<string, any> = {};
    if (weekNumber !== undefined) data.weekNumber = Number(weekNumber);
    if (weekTitle !== undefined) data.weekTitle = weekTitle?.trim() || null;
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (status !== undefined) data.status = status;

    const item = await prisma.curriculumItem.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("Failed to update curriculum item:", error);
    return NextResponse.json({ error: "Failed to update curriculum item" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
  }

  try {
    await prisma.curriculumItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete curriculum item:", error);
    return NextResponse.json({ error: "Failed to delete curriculum item" }, { status: 500 });
  }
}
