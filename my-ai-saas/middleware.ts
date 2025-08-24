import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Allow unauthenticated access for developer tools and select APIs
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/dev",
  "/api/dev/jwt",
  "/api/dev/runpod",
  "/api/webhooks/clerk",
  "/api/webhooks/razorpay",
  // Internal server-to-server generation call; upstream route enforces auth+credits
  "/api/social-twin/generate",
  // Public generation entrypoint handles its own auth + X-User-Id fallback for mobile/webviews
  "/api/generate-with-tracking",
  // Allow these in dev; route handlers still enforce auth for real data
  "/api/users/credits",
  "/api/generations",
]);

export default clerkMiddleware(async (auth, req) => {
  // Always let preflight pass to API routes (fixes mobile/webview CORS + fetch)
  if (req.method === 'OPTIONS') {
    return NextResponse.next();
  }
  if (!isPublicRoute(req)) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId) {
      return redirectToSignIn({ returnBackUrl: req.url });
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
