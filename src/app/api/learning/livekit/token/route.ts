import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { getStudentSession, getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const studentSession = await getStudentSession();
  const adminSession = await getAdminSession();
  if (!studentSession && !adminSession) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const classId = url.searchParams.get("classId") ?? "";
  if (!classId) return NextResponse.json({ error: "classId is required" }, { status: 400 });

  const learningClass = await prisma.learningClass.findUnique({
    where: { id: classId },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          students: { select: { id: true, status: true } },
        },
      },
    },
  });

  if (!learningClass) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const isAdmin = !!adminSession;
  const isEnrolledStudent =
    !!studentSession &&
    learningClass.course.students.some((s) => s.id === studentSession.sub && s.status === "active");

  if (!isAdmin && !isEnrolledStudent) {
    return NextResponse.json({ error: "Access denied: Not enrolled in this course" }, { status: 403 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL ?? process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json({ error: "Live video is not configured" }, { status: 503 });
  }

  const room = `classroom-${learningClass.id}`;
  const identity = isAdmin
    ? `instructor-${adminSession.sub}`
    : `student-${studentSession!.sub}`;

  const token = new AccessToken(apiKey, apiSecret, { identity, name: identity });
  token.addGrant({
    roomJoin: true,
    room,
    canPublish: isAdmin,
    canSubscribe: true,
    canPublishData: isAdmin,
  });

  return NextResponse.json({
    token: await token.toJwt(),
    url: livekitUrl,
    room,
    role: isAdmin ? "instructor" : "student",
  });
}
