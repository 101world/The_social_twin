"use client";
import { SignedOut, SignInButton, SignedIn, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const Navbar = () => {
  // Minimal credits pill (compact)
  const [credits, setCredits] = useState<number | null>(null);
  const pathname = usePathname();
  const isTwin = pathname?.startsWith("/social-twin");
  const isDashboard = pathname?.startsWith("/dashboard");
  const [simple, setSimple] = useState<boolean>(true);
  const [twinDark, setTwinDark] = useState<boolean>(false);
  const [globalDark, setGlobalDark] = useState<boolean>(false);
  
  // Animation state for navbar click effects
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  
  // Trigger animation on navigation
  const triggerNavAnimation = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 800);
  };
  // Sync Simple/Pro with Social Twin page via global getter/localStorage
  useEffect(() => {
    if (!isTwin) return;
    const update = () => {
      try {
        const g: any = (window as any).__getSimpleMode;
        if (typeof g === 'function') setSimple(!!g());
        else setSimple(localStorage.getItem('social_twin_simple') === '0' ? false : true);
      } catch {}
    };
    update();
    const onFocus = () => update();
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('focus', onFocus); };
  }, [isTwin]);


  useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        const r = await fetch("/api/users/credits");
        if (!r.ok) return;
        const j = await r.json();
        if (!ignore && typeof j?.credits === "number") setCredits(j.credits);
      } catch {}
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { ignore = true; clearInterval(id); };
  }, []);

  // Track Social Twin dark mode from localStorage and refresh on window focus
  useEffect(() => {
    if (!isTwin) return;
    try {
      setTwinDark(localStorage.getItem('social_twin_dark') === '1');
    } catch {}
    const onFocus = () => {
      try { setTwinDark(localStorage.getItem('social_twin_dark') === '1'); } catch {}
    };
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('focus', onFocus); };
  }, [isTwin]);

  // Detect global dark mode (outside Social Twin) via 'dark' class or media query
  useEffect(() => {
    const update = () => {
      try {
  const hasDarkClass = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  setGlobalDark(Boolean(hasDarkClass));
      } catch { setGlobalDark(false); }
    };
    update();
    let observer: MutationObserver | null = null;
    try {
      observer = new MutationObserver(update);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    } catch {}
    window.addEventListener('focus', update);
    return () => {
      window.removeEventListener('focus', update);
      if (observer) observer.disconnect();
    };
  }, []);

  // Hide navbar while landing is active (controlled by app/page)
  const [hidden, setHidden] = useState<boolean>(false);
  useEffect(() => {
    const update = (active: boolean) => setHidden(active);
    const onEvt = (e: any) => update(!!e?.detail?.active);
    try {
      const active = document.documentElement.dataset.landingActive === '1';
      update(active);
    } catch {}
    document.addEventListener('landing:state', onEvt as any);
    return () => document.removeEventListener('landing:state', onEvt as any);
  }, []);

  return (
  <header data-landing-hidden={hidden ? '1' : '0'} className="pointer-events-none absolute inset-x-0 top-0 z-[20000] flex h-16 items-center justify-center p-4 transition-opacity duration-500" style={{ opacity: hidden ? 0 : 1 }}>
      {(() => {
        // Always use white icons for consistency
        const iconClass = 'text-white';
        const linkClass = `${iconClass} hover:opacity-90 cursor-pointer pointer-events-auto`;
        return (
          <nav className="pointer-events-auto relative flex w-full items-center">
            {/* Centered icon group with cool blending border */}
            <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center">
              <div className="pointer-events-auto relative">
                {/* Cool border that blends into top edge with animations */}
                <div className={`absolute -inset-4 -top-8 transition-all duration-800 ${isAnimating ? 'scale-105' : 'scale-100'}`}>
                  <div className="relative h-full w-full">
                    {/* Main container with organic border */}
                    <div className={`absolute inset-0 rounded-b-3xl bg-gradient-to-b from-black/20 via-black/10 to-transparent backdrop-blur-sm border-x border-b border-white/10 transition-all duration-800 ${isAnimating ? 'border-white/30 bg-gradient-to-b from-blue-500/20 via-purple-500/10 to-transparent' : ''}`}></div>
                    {/* Top blend effect */}
                    <div className={`absolute -top-4 inset-x-0 h-8 bg-gradient-to-b from-black/15 to-transparent rounded-t-2xl transition-all duration-800 ${isAnimating ? 'from-blue-400/25' : ''}`}></div>
                    {/* Side glow effects - enhanced during animation */}
                    <div className={`absolute -inset-2 rounded-3xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-50 transition-all duration-800 ${isAnimating ? 'via-blue-300/20 opacity-100' : ''}`}></div>
                    {/* Subtle inner highlight */}
                    <div className={`absolute inset-1 rounded-b-2xl border border-white/5 transition-all duration-800 ${isAnimating ? 'border-white/20' : ''}`}></div>
                    {/* Wave animation overlay */}
                    {isAnimating && (
                      <div className="absolute inset-0 rounded-b-3xl overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ animation: 'navbar-wave 0.8s ease-out' }}></div>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400" style={{ animation: 'navbar-wave 0.6s ease-out 0.1s' }}></div>
                        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent" style={{ animation: 'navbar-wave 0.7s ease-out 0.2s' }}></div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Icons container with tighter spacing and animation effects */}
                <div className={`relative flex items-center gap-3 px-6 py-3 transition-transform duration-300 ${isAnimating ? 'scale-105' : 'scale-100'}`}>
                <Link href="/" className={linkClass} title="Home" onClick={triggerNavAnimation}>
                  <span className="sr-only">Home</span>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9,22 9,12 15,12 15,22"/>
                  </svg>
                </Link>
                <Link href="/social-twin" className={linkClass} title="The Social Twin" onClick={triggerNavAnimation}>
                  <span className="sr-only">Social Twin</span>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 7a4 4 0 1 0 0 8m8-8a4 4 0 1 0 0 8" />
                    <path d="M2 21c1.5-3 4.5-5 6-5s4.5 2 6 5m2-9c3 0 6 2 6 5" />
                  </svg>
                </Link>
                {/* Dashboard link removed per request */}
                <Link href="/subscription" className={linkClass} title="Subscriptions" onClick={triggerNavAnimation}>
                  <span className="sr-only">Subscriptions</span>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M3 12h18M3 18h18" />
                  </svg>
                </Link>
                <Link href="/one" className={linkClass} title="The Code of ONE" onClick={triggerNavAnimation}>
                  <span className="sr-only">Code of ONE</span>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L12 22" />
                    <path d="M8 6L12 2L16 6" />
                  </svg>
                </Link>
                {/* Thunder toggle next to icons */}
                {isTwin && (() => {
                  const darkCtx = isTwin ? twinDark : (isDashboard || globalDark);
                  const toggle = () => {
                    triggerNavAnimation(); // Add animation trigger
                    const next = !simple;
                    setSimple(next);
                    try {
                      localStorage.setItem('social_twin_simple', next ? '1' : '0');
                      const f: any = (window as any).__setSimpleMode;
                      if (typeof f === 'function') f(next);
                    } catch {}
                  };
                  return (
                    <button
                      className={`rounded-full p-2 transition-colors ${darkCtx ? 'hover:bg-white/10' : 'hover:bg-neutral-100'}`}
                      onClick={toggle}
                      title={simple ? 'Switch to Pro' : 'Switch to Normal'}
                      aria-label="Toggle Normal/Pro"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill={simple ? '#ffffff' : '#facc15'} xmlns="http://www.w3.org/2000/svg">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    </button>
                  );
                })()}
                {/* User profile next to icons */}
                <SignedIn>
                  <div className="ml-1">
                    <UserButton />
                  </div>
                </SignedIn>
                <SignedOut>
                  <SignInButton>
                    <Button>Sign In</Button>
                  </SignInButton>
                </SignedOut>
                </div>
              </div>
            </div>
          </nav>
        );
      })()}
    </header>
  );
};

export default Navbar;
