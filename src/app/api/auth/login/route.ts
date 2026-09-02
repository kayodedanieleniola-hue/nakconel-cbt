import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validation";
import { createSession } from "@/lib/auth";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const rl = checkRateLimit(clientKeyFromRequest(req, "login"), 10, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again shortly." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your email/Student ID and password" }, { status: 400 });
  }

  const { identifier, password } = parsed.data;

  // Same generic error for "no such account" and "wrong password" — never
  // reveal which one it was, that's an enumeration leak.
  const genericError = () =>
    NextResponse.json({ error: "Incorrect email/Student ID or password" }, { status: 401 });

  const student = await prisma.student.findFirst({
    where: {
      OR: [{ email: identifier.toLowerCase() }, { studentId: identifier.toUpperCase() }],
    },
    include: { course: true },
  });

  if (!student) return genericError();

  if (student.status !== "active") {
    return NextResponse.json(
      { error: "This account has been disabled. Contact your administrator." },
      { status: 403 }
    );
  }

  const valid = await verifyPassword(password, student.passwordHash);
  if (!valid) {
    await prisma.auditLog.create({
      data: {
        actorType: "student",
        actorId: student.id,
        action: "student.login_failed",
      },
    });
    return genericError();
  }

  await createSession({ sub: student.id, role: "student", studentId: student.studentId });

  await prisma.auditLog.create({
    data: { actorType: "student", actorId: student.id, action: "student.login" },
  });

  return NextResponse.json({
    studentId: student.studentId,
    fullName: student.fullName,
    email: student.email,
    course: student.course.name,
  });
}
