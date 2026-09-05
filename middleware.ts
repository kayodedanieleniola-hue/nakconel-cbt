import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Edge-safe first line of defense: confirms a valid session cookie exists
// AND carries the right role for the area being accessed. Every page and
// API route still re-checks server-side (see requireAdmin / getStudentSession
// / getAdminSession) — this just stops obviously-unauthenticated requests
// before they render.
//
// Student and admin sessions live in separate cookies (nak_student_session,
// nak_admin_session) so logging into one role never overwrites the other —
// which is exactly what happened when both shared a single cookie name.

async function verify(token: string | undefined) {
  if (!token) return null;
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error("missing secret");
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload as { role?: string };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const token = req.cookies.get("nak_student_session")?.value;
    const payload = await verify(token);
    if (!payload || payload.role !== "student") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = req.cookies.get("nak_admin_session")?.value;
    const payload = await verify(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
