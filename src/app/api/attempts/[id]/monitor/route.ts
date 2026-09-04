import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// A face-recognition embedding distance below this is treated as the same
// person. 0.6 is the threshold face-api.js itself documents/uses by
// default for its FaceMatcher — not something we invented.
const IDENTITY_MATCH_THRESHOLD = 0.6;

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

async function getActiveAttempt(id: string) {
  const session = await getSession();
  if (!session || session.role !== "student") return null;

  const attempt = await prisma.examAttempt.findFirst({
    where: { id, studentId: session.sub },
    include: { exam: { select: { name: true } } },
  });
  if (!attempt || attempt.status !== "IN_PROGRESS") return null;
  return { attempt, studentId: session.sub };
}

type Body =
  | { type: "identity"; descriptor: number[]; photo?: string }
  | { type: "presence"; facesDetected: number }
  | { type: "camera"; event: "ready" | "blocked" | "disconnected" };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getActiveAttempt(id);
  if (!ctx) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  const { attempt, studentId } = ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const b = body as Partial<Body>;

  if (b.type === "identity") {
    const descriptor = b.descriptor;
    if (!Array.isArray(descriptor) || descriptor.length < 32 || !descriptor.every((n) => typeof n === "number")) {
      return NextResponse.json({ error: "Invalid descriptor" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    // No baseline yet — this becomes the enrolled reference for every
    // future attempt. Never overwritten automatically; only an admin can
    // clear it (student detail page), which resets enrollment on purpose.
    if (!student.verificationDescriptor) {
      await prisma.student.update({
        where: { id: studentId },
        data: {
          verificationDescriptor: JSON.stringify(descriptor),
          verificationPhoto: typeof b.photo === "string" ? b.photo.slice(0, 200_000) : null,
          verificationCapturedAt: new Date(),
        },
      });
      await prisma.auditLog.create({
        data: {
          actorType: "student",
          actorId: studentId,
          action: "student.identity_baseline_set",
          detail: attempt.exam.name,
        },
      });
      return NextResponse.json({ status: "baseline_set" });
    }

    const baseline: number[] = JSON.parse(student.verificationDescriptor);
    const distance = euclideanDistance(baseline, descriptor);
    const matched = distance <= IDENTITY_MATCH_THRESHOLD;

    await prisma.auditLog.create({
      data: {
        actorType: "student",
        actorId: studentId,
        action: matched ? "student.identity_verified" : "student.identity_mismatch",
        detail: `${attempt.exam.name} — distance ${distance.toFixed(3)}`,
      },
    });

    return NextResponse.json({ status: matched ? "match" : "mismatch", distance });
  }

  if (b.type === "presence") {
    const count = b.facesDetected;
    if (typeof count !== "number" || !Number.isFinite(count) || count < 0) {
      return NextResponse.json({ error: "Invalid facesDetected" }, { status: 400 });
    }

    // Only genuinely abnormal states are worth an admin's attention —
    // "1 face" (normal) is intentionally not logged at all, so this signal
    // stays a review flag rather than noise, per the spec's caution against
    // treating a single AI signal as proof of anything.
    if (count === 0 || count >= 2) {
      await prisma.auditLog.create({
        data: {
          actorType: "student",
          actorId: studentId,
          action: count === 0 ? "student.presence_no_face" : "student.presence_multiple_faces",
          detail: attempt.exam.name,
        },
      });
    }

    return NextResponse.json({ ok: true });
  }

  if (b.type === "camera") {
    if (b.event !== "ready" && b.event !== "blocked" && b.event !== "disconnected") {
      return NextResponse.json({ error: "Invalid camera event" }, { status: 400 });
    }
    if (b.event !== "ready") {
      await prisma.auditLog.create({
        data: {
          actorType: "student",
          actorId: studentId,
          action: b.event === "blocked" ? "student.camera_blocked" : "student.camera_disconnected",
          detail: attempt.exam.name,
        },
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown event type" }, { status: 400 });
}
