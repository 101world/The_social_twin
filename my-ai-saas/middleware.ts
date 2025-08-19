import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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
  // Allow these in dev; route handlers still enforce auth for real data
  "/api/users/credits",
  "/api/generations",
]);

export default clerkMiddleware(async (auth, req) => {
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
