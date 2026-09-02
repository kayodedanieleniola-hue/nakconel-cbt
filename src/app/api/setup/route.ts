import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";

const COURSES = [
  "Brand Strategy & Positioning",
  "Project Management for Brands",
  "Web & App Development",
  "AI Automation",
  "Content & Graphics Design",
  "Content Design (Intro Track)",
];

// Visit this URL once after your first deploy, from any browser:
//   https://YOUR-APP.vercel.app/api/setup?key=YOUR_SETUP_SECRET
//
// It creates the 6 courses (safe to run more than once — it won't duplicate
// them) and, if SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are set in your
// Vercel environment variables, creates that admin account too.
export async function GET(req: Request) {
  const setupSecret = process.env.SETUP_SECRET;
  if (!setupSecret) {
    return NextResponse.json(
      { error: "SETUP_SECRET is not set in your environment variables." },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (key !== setupSecret) {
    return NextResponse.json({ error: "Invalid or missing key." }, { status: 401 });
  }

  const results: string[] = [];

  for (const name of COURSES) {
    await prisma.course.upsert({ where: { name }, create: { name }, update: {} });
  }
  results.push(`Courses ready: ${COURSES.join(", ")}`);

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminName = process.env.SEED_ADMIN_NAME ?? "Admin";

  if (adminEmail && adminPassword) {
    const passwordHash = await hashPassword(adminPassword);
    await prisma.admin.upsert({
      where: { email: adminEmail.toLowerCase() },
      create: { email: adminEmail.toLowerCase(), fullName: adminName, passwordHash },
      update: {},
    });
    results.push(`Admin account ready: ${adminEmail}`);
  } else {
    results.push(
      "No admin created — set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in Vercel, then visit this URL again."
    );
  }

  return NextResponse.json({ ok: true, results });
}
