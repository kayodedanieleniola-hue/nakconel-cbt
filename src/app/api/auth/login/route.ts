/**
 * POST /api/auth/login
 *
 * Student login — email only. No password required.
 *
 * Flow:
 *  1. Receive email
 *  2. Check career_registrations in the main Nakconel DB (MAIN_DATABASE_URL)
 *     - Must have type = TRAINING
 *     - Must not have a blocked status (Cancelled / Rejected / Suspended)
 *  3. If not eligible → return 403 with a message pointing to nakconel.company
 *  4. If eligible → look up the student in this project's own students table
 *     - If found + active  → create session → redirect to /dashboard
 *     - If found + disabled → return 403
 *     - If not found → return 404 telling them their exam account is pending
 *
 * Admin login is separate (/api/auth/admin-login) and unchanged.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { findEligibleTrainingStudent } from "@/lib/mainDb";

const bodySchema = z.object({
  email: z.string().email(),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Rate limit — 10 attempts per 10 minutes per IP
  const rl = checkRateLimit(clientKeyFromRequest(req, "login"), 10, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  // Parse body
  let body: { email: string };
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const email = body.email.toLowerCase().trim();

  // ── Step 1: Check main Nakconel DB ──────────────────────────────────────
  let eligibility: Awaited<ReturnType<typeof findEligibleTrainingStudent>>;
  try {
    eligibility = await findEligibleTrainingStudent(email);
  } catch {
    return NextResponse.json(
      { error: "Unable to verify your registration. Please try again." },
      { status: 503 }
    );
  }

  if (!eligibility.eligible) {
    const messages: Record<string, string> = {
      email_not_found:
        "This email is not registered for Nakconel training. Please register at nakconel.company to get access.",
      not_training:
        "This email is registered for an internship, not a training programme. Only training students can access the exam portal. Register for training at nakconel.company.",
      status_blocked:
        "Your Nakconel registration is currently inactive. Please contact support at nakconel.company.",
    };
    return NextResponse.json(
      { error: messages[eligibility.reason] ?? "You are not eligible to access the exam portal. Visit nakconel.company to register." },
      { status: 403 }
    );
  }

  // ── Step 2: Find student in this project's own DB ───────────────────────
  const student = await prisma.student.findFirst({
    where: { email },
    include: { course: true },
  });

  if (!student) {
    // Registered with Nakconel but exam account not set up yet
    return NextResponse.json(
      {
        error:
          "Your Nakconel registration was found, but your exam account has not been set up yet. Please contact your administrator or visit nakconel.company for assistance.",
      },
      { status: 404 }
    );
  }

  if (student.status !== "active") {
    return NextResponse.json(
      { error: "Your exam account has been disabled. Contact your administrator." },
      { status: 403 }
    );
  }

  // ── Step 3: Create session ──────────────────────────────────────────────
  await createSession({ sub: student.id, role: "student", studentId: student.studentId });

  await prisma.auditLog.create({
    data: { actorType: "student", actorId: student.id, action: "student.login" },
  });

  return NextResponse.json({
    studentId: student.studentId,
    fullName:  student.fullName,
    email:     student.email,
    course:    student.course.name,
  });
}
