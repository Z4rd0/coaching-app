import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Firebase Auth uses client-side tokens; we protect routes via the (app) layout.
// The middleware here handles only the /auth redirect for already-authenticated
// users (detected via a cookie set by the client after login).
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authCookie = request.cookies.get("coach-auth");

  // If authenticated user hits /auth, send them home
  if (authCookie && pathname === "/auth") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/auth", "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons).*)"],
};
