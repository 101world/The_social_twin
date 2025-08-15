"use client";
import { SignedOut, SignInButton, SignedIn, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";

const Navbar = () => {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-[10002] flex h-16 items-center justify-center p-4">
      {(() => {
        const pathname = usePathname();
        // Use white icons in dark contexts; on /social-twin dark mode we want white
        const isTwin = pathname?.startsWith("/social-twin");
        const iconClass = isTwin ? "text-white" : "text-white";
        const linkClass = `${iconClass} hover:opacity-90 cursor-pointer`;
        return (
          <nav className="pointer-events-auto flex items-center gap-6">
            <Link href="/social-twin" className={linkClass} title="The Social Twin">
          <span className="sr-only">Social Twin</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 7a4 4 0 1 0 0 8m8-8a4 4 0 1 0 0 8" />
            <path d="M2 21c1.5-3 4.5-5 6-5s4.5 2 6 5m2-9c3 0 6 2 6 5" />
          </svg>
            </Link>
            <Link href="/dashboard" className={linkClass} title="Dashboard">
          <span className="sr-only">Dashboard</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
            </Link>
            <Link href="/subscription" className={linkClass} title="Subscriptions">
          <span className="sr-only">Subscriptions</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
            </Link>
            <Link href="/studio" className={linkClass} title="Studio">
          <span className="sr-only">Studio</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
          </svg>
            </Link>
            <SignedIn>
              <UserButton />
            </SignedIn>
            <SignedOut>
              <SignInButton>
                <Button>Sign In</Button>
              </SignInButton>
            </SignedOut>
          </nav>
        );
      })()}
    </header>
  );
};

export default Navbar;
