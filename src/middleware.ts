import { NextRequest, NextResponse } from "next/server";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;
const ipBuckets = new Map<string, { count: number; resetAt: number }>();

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const now = Date.now();
  const bucket = ipBuckets.get(ip);

  if (!bucket || bucket.resetAt <= now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((bucket.resetAt - now) / 1000)) },
      }
    );
  }

  bucket.count += 1;
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
