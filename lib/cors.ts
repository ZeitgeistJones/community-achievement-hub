// CORS for the public claim-pipeline routes (/api/pending, /api/claim) so the
// embed script can call them from your other apps' domains.
// Allowed: any *.vercel.app subdomain and localhost (dev). Everything else
// gets no CORS headers (same-origin requests are unaffected either way).
// NOTE: /api/report intentionally has NO CORS — it is server-to-server only.

import { NextResponse } from "next/server";

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    const { hostname } = new URL(origin);
    if (
      hostname.endsWith(".vercel.app") ||
      hostname === "localhost" ||
      hostname === "127.0.0.1"
    ) {
      return origin;
    }
  } catch {
    // malformed origin header — ignore
  }
  return null;
}

export function withCors<T>(
  request: Request,
  response: NextResponse<T>
): NextResponse<T> {
  const origin = allowedOrigin(request);
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }
  return response;
}

export function corsPreflight(request: Request): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  const origin = allowedOrigin(request);
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    response.headers.set("Access-Control-Max-Age", "86400");
    response.headers.set("Vary", "Origin");
  }
  return response;
}
