import { clerkMiddleware } from "@clerk/nextjs/server";

// Allow unauthenticated access to public pages and webhooks
export default clerkMiddleware({
  publicRoutes: [
    "/", // home
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/api/webhooks/(.*)",
    "/dev",
    "/api/dev/(.*)",
    "/favicon.ico",
  ],
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
