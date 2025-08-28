"use client";
import { SignedOut, SignInButton, SignedIn, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const Navbar = () => {
  // Mobile detection state
  const [isMobile, setIsMobile] = useState<boolean>(false);
  
  // Minimal credits pill (compact)
  const [oneMaxBalance, setOneMaxBalance] = useState<number | null>(null);
  const [isOneMaxUser, setIsOneMaxUser] = useState<boolean>(false);
  const [credits, setCredits] = useState<number | null>(null);
  const pathname = usePathname();
  const isTwin = pathname?.startsWith("/social-twin");
  const isDashboard = pathname?.startsWith("/dashboard");
  const [simple, setSimple] = useState<boolean>(true);
  const [twinDark, setTwinDark] = useState<boolean>(false);
  const [globalDark, setGlobalDark] = useState<boolean>(false);
  
  // Animation state for navbar click effects
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  
  // Mobile detection effect - Enhanced for iOS devices
  useEffect(() => {
    const checkMobile = () => {
      // Primary check: screen width < 640px
      const isSmallScreen = window.innerWidth < 640;
      
      // Secondary check: touch capability (for tablets/phones)
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Tertiary check: user agent for iOS devices
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      // Consider mobile if: small screen OR (touch device AND iOS) OR (iOS regardless of screen size)
      const isMobileDevice = isSmallScreen || (isTouchDevice && isIOS) || isIOS;
      
      setIsMobile(isMobileDevice);
    };
    
    checkMobile(); // Initial check
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);
  
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
        if (!ignore) {
          if (typeof j?.oneMaxBalance === "number") setOneMaxBalance(j.oneMaxBalance);
          if (typeof j?.isOneMaxUser === "boolean") setIsOneMaxUser(j.isOneMaxUser);
          if (typeof j?.credits === "number") setCredits(j.credits);
        }
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

  // Show credits on mobile instead of hiding navbar completely
  if (isMobile) {
    return (
      <div className="fixed top-4 right-4 z-[99999]">
        <SignedIn>
          {((credits !== null && !isOneMaxUser) || (oneMaxBalance !== null && isOneMaxUser)) && (
            <div className={`px-3 py-2 rounded-lg text-sm font-medium backdrop-blur-sm ${
              isOneMaxUser
                ? 'bg-gradient-to-r from-gray-500/20 to-gray-400/20 border border-gray-500/30 text-white'
                : 'bg-gradient-to-r from-gray-500/20 to-gray-400/20 border border-gray-500/30 text-white'
            }`}>
              {isOneMaxUser
                ? `$${(oneMaxBalance || 0).toFixed(2)}`
                : `${credits || 0} credits`
              }
            </div>
          )}
        </SignedIn>
      </div>
    );
  }

  return (
  <header data-landing-hidden={hidden ? '1' : '0'} className="pointer-events-none absolute inset-x-0 z-[20000] flex items-center justify-center transition-opacity duration-500" style={{ 
    opacity: hidden ? 0 : 1,
    top: '12px', // Mobile: lower positioning instead of top-0
    height: '28px', // Mobile: more compact than h-8 sm:h-10
    padding: '4px 8px' // More compact padding
  }}>
      {(() => {
        // Always use white icons for consistency
        const iconClass = 'text-white';
        const linkClass = `${iconClass} hover:opacity-90 cursor-pointer pointer-events-auto`;
        return (
          <nav className="pointer-events-auto relative flex w-full items-center">
            {/* Centered icon group with compact blending border */}
            <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center">
              <div className="pointer-events-auto relative">
                {/* Compact border that blends into top edge with animations */}
                <div className={`absolute -inset-1 sm:-inset-2 -top-2 sm:-top-3 transition-all duration-800 ${isAnimating ? 'scale-105' : 'scale-100'}`}>
                  <div className="relative h-full w-full">
                    {/* Main container with compact organic border */}
                    <div className={`absolute inset-0 rounded-b-xl sm:rounded-b-2xl bg-gradient-to-b from-black/15 via-black/8 to-transparent backdrop-blur-sm border-x border-b border-white/8 transition-all duration-800 ${isAnimating ? 'border-white/20 bg-gradient-to-b from-gray-500/15 via-gray-400/8 to-transparent' : ''}`}></div>
                    {/* Minimal top blend effect */}
                    <div className={`absolute -top-1 sm:-top-2 inset-x-0 h-2 sm:h-4 bg-gradient-to-b from-black/10 to-transparent rounded-t-lg sm:rounded-t-xl transition-all duration-800 ${isAnimating ? 'from-gray-400/15' : ''}`}></div>
                    {/* Subtle side glow effects */}
                    <div className={`absolute -inset-0.5 sm:-inset-1 rounded-xl sm:rounded-2xl bg-gradient-to-r from-transparent via-white/3 to-transparent opacity-40 transition-all duration-800 ${isAnimating ? 'via-gray-300/15 opacity-80' : ''}`}></div>
                    {/* Minimal inner highlight */}
                    <div className={`absolute inset-0.5 rounded-b-lg sm:rounded-b-xl border border-white/3 transition-all duration-800 ${isAnimating ? 'border-white/15' : ''}`}></div>
                    {/* Wave animation overlay */}
                    {isAnimating && (
                      <div className="absolute inset-0 rounded-b-xl sm:rounded-b-2xl overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent" style={{ animation: 'navbar-wave 0.8s ease-out' }}></div>
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-gray-400 via-gray-300 to-gray-400" style={{ animation: 'navbar-wave 0.6s ease-out 0.1s' }}></div>
                        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" style={{ animation: 'navbar-wave 0.7s ease-out 0.2s' }}></div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Icons container with minimal spacing and compact design */}
                <div className={`relative flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 transition-transform duration-300 ${isAnimating ? 'scale-105' : 'scale-100'}`}>
                <Link href="/" className={linkClass} title="Home" onClick={triggerNavAnimation}>
                  <span className="sr-only">Home</span>
                  <svg width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9,22 9,12 15,12 15,22"/>
                  </svg>
                </Link>
                <Link href="/social-twin" className={linkClass} title="The Social Twin" onClick={triggerNavAnimation}>
                  <span className="sr-only">Social Twin</span>
                  <svg width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 7a4 4 0 1 0 0 8m8-8a4 4 0 1 0 0 8" />
                    <path d="M2 21c1.5-3 4.5-5 6-5s4.5 2 6 5m2-9c3 0 6 2 6 5" />
                  </svg>
                </Link>
                {/* Dashboard link removed per request */}
                <Link href="/subscription" className={linkClass} title="Subscriptions" onClick={triggerNavAnimation}>
                  <span className="sr-only">Subscriptions</span>
                  <svg width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M3 12h18M3 18h18" />
                  </svg>
                </Link>
                <Link href="/one" className={linkClass} title="The Code of ONE" onClick={triggerNavAnimation}>
                  <span className="sr-only">Code of ONE</span>
                  <svg width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L12 22" />
                    <path d="M8 6L12 2L16 6" />
                  </svg>
                </Link>
                {/* Thunder toggle next to icons - hidden on mobile */}
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
                      className={`hidden sm:block rounded-full p-0.5 sm:p-1 transition-colors ${darkCtx ? 'hover:bg-white/10' : 'hover:bg-neutral-100'}`}
                      onClick={toggle}
                      title={simple ? 'Switch to Pro' : 'Switch to Normal'}
                      aria-label="Toggle Normal/Pro"
                    >
                      <svg width="14" height="14" className="sm:w-4 sm:h-4" viewBox="0 0 24 24" fill={simple ? '#ffffff' : '#facc15'} xmlns="http://www.w3.org/2000/svg">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    </button>
                  );
                })()}
                {/* User profile next to icons */}
                <SignedIn>
                  <div className="ml-0.5 scale-90 sm:scale-100">
                    <UserButton />
                  </div>
                </SignedIn>
                <SignedOut>
                  <SignInButton>
                    <Button size="sm" className="text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 h-6 sm:h-auto">Sign In</Button>
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
