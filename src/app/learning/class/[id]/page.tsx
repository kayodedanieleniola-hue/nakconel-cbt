import { notFound, redirect } from "next/navigation";
import ClassroomClient from "@/components/ClassroomClient";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncLearningClassStatuses } from "@/lib/learningSchedule";

export const dynamic = "force-dynamic";

export default async function ClassroomPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getStudentSession();
  if (!session) redirect("/login");

  await syncLearningClassStatuses();
  const { id } = await params;
  const learningClass = await prisma.learningClass.findFirst({
    where: {
      id,
      NOT: { status: "CANCELLED" },
      course: { students: { some: { id: session.sub, status: "active" } } },
    },
    include: {
      course: {
        select: {
          name: true,
          materials: {
            orderBy: { createdAt: "desc" },
            select: { id: true, title: true, fileName: true, mimeType: true, sizeBytes: true },
          },
        },
      },
      module: { select: { title: true } },
    },
  });

  if (!learningClass) notFound();

  return <ClassroomClient learningClass={{
    id: learningClass.id,
    title: learningClass.title,
    course: learningClass.course.name,
    module: learningClass.module?.title ?? null,
    instructor: learningClass.instructor,
    description: learningClass.description,
    activeMaterialId: learningClass.activeMaterialId,
  }} materials={learningClass.course.materials} />;
}
