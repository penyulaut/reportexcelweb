import { auth } from "@/auth";
import { NextResponse, type NextRequest } from "next/server";

export default auth((req: NextRequest & { auth: { user?: { email?: string } } | null }) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
  const isPublicRoute = 
    nextUrl.pathname === "/" ||
    nextUrl.pathname === "/signin" ||
    nextUrl.pathname === "/error" ||
    nextUrl.pathname.startsWith("/_next") ||
    nextUrl.pathname.startsWith("/images") ||
    (nextUrl.pathname.startsWith("/api/") && !nextUrl.pathname.startsWith("/api/auth"));

  // Allow public routes and API auth routes
  if (isPublicRoute || isApiAuthRoute) {
    return NextResponse.next();
  }

  // Redirect to signin if not logged in
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/signin", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
