import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const COURSES = [
  "Brand Strategy & Positioning",
  "Project Management for Brands",
  "Web & App Development",
  "AI Automation",
  "Content & Graphics Design",
  "Content Design (Intro Track)",
];

async function main() {
  for (const name of COURSES) {
    await prisma.course.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }
  console.log(`Seeded ${COURSES.length} courses.`);

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminName = process.env.SEED_ADMIN_NAME ?? "Admin";

  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.admin.upsert({
      where: { email: adminEmail.toLowerCase() },
      create: { email: adminEmail.toLowerCase(), fullName: adminName, passwordHash },
      update: {},
    });
    console.log(`Seeded admin account: ${adminEmail}`);
  } else {
    console.log(
      "No SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD set — skipped creating an admin account. " +
        "Set them as env vars and re-run `npm run db:seed` to create one."
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
