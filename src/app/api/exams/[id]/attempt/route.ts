import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getExamStatus } from "@/lib/examStatus";

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "student") {
    return NextResponse.json({ error: "You must be logged in as a student" }, { status: 401 });
  }

  const { id: examId } = await params;
  const student = await prisma.student.findUnique({ where: { id: session.sub } });
  if (!student || student.status !== "active") {
    return NextResponse.json({ error: "Student account is not active" }, { status: 403 });
  }

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.courseId !== student.courseId) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  if (getExamStatus(exam, new Date()) !== "ONGOING") {
    return NextResponse.json({ error: "This exam is not currently available" }, { status: 422 });
  }

  const existing = await prisma.examAttempt.findUnique({
    where: { examId_studentId: { examId, studentId: student.id } },
    include: { questions: { orderBy: { position: "asc" } } },
  });

  if (existing?.status === "SUBMITTED") {
    return NextResponse.json({ error: "You have already submitted this exam" }, { status: 409 });
  }

  if (existing && existing.expiresAt > new Date()) {
    return NextResponse.json({ attempt: serializeAttempt(existing) });
  }

  if (existing) {
    await prisma.examAttempt.update({
      where: { id: existing.id },
      data: { status: "TIMED_OUT", submittedAt: new Date() },
    });
  }

  const questionPool = await prisma.question.findMany({
    where: { courseId: exam.courseId, examId, active: true },
    select: { id: true, text: true, options: true, correctIndex: true },
  });

  if (questionPool.length < exam.numQuestions) {
    return NextResponse.json({ error: "This exam does not have enough active questions" }, { status: 422 });
  }

  const selectedQuestions = shuffle(questionPool).slice(0, exam.numQuestions);
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + exam.durationMinutes * 60 * 1000);

  const attempt = await prisma.examAttempt.create({
    data: {
      examId,
      studentId: student.id,
      startedAt,
      expiresAt,
      questions: {
        create: selectedQuestions.map((question, position) => {
          const optionEntries = question.options.map((text, index) => ({ text, index }));
          const orderedOptions = exam.shuffleOptions ? shuffle(optionEntries) : optionEntries;
          return {
            questionId: question.id,
            position,
            text: question.text,
            options: orderedOptions.map((option) => option.text),
            correctIndex: orderedOptions.findIndex((option) => option.index === question.correctIndex),
          };
        }),
      },
    },
    include: { questions: { orderBy: { position: "asc" } } },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "student",
      actorId: student.id,
      action: "student.start_exam",
      detail: exam.name,
    },
  });

  return NextResponse.json({ attempt: serializeAttempt(attempt) }, { status: 201 });
}

function serializeAttempt(attempt: {
  id: string;
  examId: string;
  status: string;
  startedAt: Date;
  expiresAt: Date;
  questions: Array<{ id: string; position: number; text: string; options: string[]; selectedIndex: number | null }>;
}) {
  return {
    id: attempt.id,
    examId: attempt.examId,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    questions: attempt.questions.map(({ id, position, text, options, selectedIndex }) => ({
      id,
      position,
      text,
      options,
      selectedIndex,
    })),
  };
}
