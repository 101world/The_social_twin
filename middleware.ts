import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Mark public routes explicitly; everything else is protected by Clerk
const isPublicRoute = createRouteMatcher([
  "/", // home
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/(.*)",
  "/dev",
  "/api/dev/(.*)",
  // Internal server-to-server generation call (auth + credits are enforced upstream in generate-with-tracking)
  "/api/social-twin/generate",
  "/favicon.ico",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return; // allow
  const { userId } = await auth();
  if (!userId) {
    // For API routes, return 401; for pages, Clerk will handle redirects
    return new Response('Authentication Required', { status: 401 });
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
