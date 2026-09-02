import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Edge-safe check: just verifies a valid, unexpired session cookie exists.
// The actual page/API still re-checks role and account status server-side —
// this is a first line of defense, not the source of truth.

const PROTECTED_PREFIXES = ["/dashboard"];

export async function middleware(req: NextRequest) {
  const isProtected = PROTECTED_PREFIXES.some((p) => req.nextUrl.pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get("nak_session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error("missing secret");
    await jwtVerify(token, new TextEncoder().encode(secret));
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
