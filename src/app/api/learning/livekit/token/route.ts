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
          students: { select: { id: true, status: true, fullName: true } },
        },
      },
    },
  });

  if (!learningClass) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const isAdmin = !!adminSession;
  const enrolledStudent = studentSession
    ? learningClass.course.students.find((s) => s.id === studentSession.sub && s.status === "active")
    : undefined;

  if (!isAdmin && !enrolledStudent) {
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

  // Resolve a real display name so student tiles show the actual name
  // rather than the raw identity string.
  let displayName = identity;
  if (isAdmin) {
    const admin = await prisma.admin.findUnique({
      where: { id: adminSession.sub },
      select: { fullName: true },
    });
    displayName = admin?.fullName ?? "Instructor";
  } else if (enrolledStudent) {
    displayName = enrolledStudent.fullName;
  }

  // Every participant — instructor and student — can publish, subscribe,
  // and send data messages. Students publish their camera/mic automatically
  // on join; the instructor sees them as live video tiles with no manual
  // accept step required.
  const token = new AccessToken(apiKey, apiSecret, { identity, name: displayName });
  token.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return NextResponse.json({
    token: await token.toJwt(),
    url: livekitUrl,
    room,
    role: isAdmin ? "instructor" : "student",
  });
}
