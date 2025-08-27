'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SignedOut, SignInButton, SignedIn, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Menu, X, Home, Users, CreditCard, Zap } from 'lucide-react';
import { usePathname } from 'next/navigation';

const HamburgerMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [oneMaxBalance, setOneMaxBalance] = useState<number | null>(null);
  const [isOneMaxUser, setIsOneMaxUser] = useState<boolean>(false);
  const [simple, setSimple] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const pathname = usePathname();
  const router = useRouter();
  const isTwin = pathname?.startsWith('/social-twin');
  const isDashboard = pathname?.startsWith('/dashboard');

  // Load credits
  useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        const r = await fetch('/api/users/credits');
        if (!r.ok) return;
        const j = await r.json();
        if (!ignore) {
          if (typeof j?.credits === 'number') setCredits(j.credits);
          if (typeof j?.oneMaxBalance === 'number') setOneMaxBalance(j.oneMaxBalance);
          if (typeof j?.isOneMaxUser === 'boolean') setIsOneMaxUser(j.isOneMaxUser);
        }
      } catch {}
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { ignore = true; clearInterval(id); };
  }, []);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const isSmallScreen = window.innerWidth < 640;
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isMobileDevice = isSmallScreen || (isTouchDevice && isIOS) || isIOS;
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  // Sync Simple/Pro with Social Twin page
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

  // Close menu on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const toggleSimple = () => {
    const next = !simple;
    setSimple(next);
    try {
      localStorage.setItem('social_twin_simple', next ? '1' : '0');
      const f: any = (window as any).__setSimpleMode;
      if (typeof f === 'function') f(next);
    } catch {}
  };

  const toggleSidebar = () => {
    if (isTwin) {
      // For social-twin page, control the sidebar
      try {
        const f: any = (window as any).__setSidebarOpen;
        if (typeof f === 'function') {
          f(!isOpen);
        }
        setIsOpen(!isOpen);
      } catch {}
    } else {
      // For other pages, show dropdown menu
      setIsOpen(!isOpen);
    }
  };

  const menuItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/social-twin', label: 'Social Twin', icon: Users },
    { href: '/news', label: 'News', icon: () => <span className="text-lg">📰</span> },
    { href: '/subscription', label: 'Subscriptions', icon: CreditCard },
    { href: '/one', label: 'Code of ONE', icon: Zap },
    { href: '/explore', label: 'Explore', icon: () => <span className="text-lg">🔍</span> },
  ];

  return (
    <>
      {/* Top Right Corner - Credits and Turbo Mode */}
      <div className="fixed top-4 right-4 z-[99999] flex items-center space-x-3">
        {/* Turbo Mode Toggle - Only show on Social Twin pages */}
        {isTwin && (
          <button
            onClick={toggleSimple}
            className={`p-2 rounded-lg transition-all duration-200 backdrop-blur-sm ${
              simple
                ? 'bg-black/50 border border-white/20 text-white hover:bg-black/70 hover:border-white/40'
                : 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/30 text-blue-300 hover:from-blue-500/30 hover:to-cyan-500/30'
            }`}
            title={simple ? 'Switch to Pro Mode' : 'Switch to Normal Mode'}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </button>
        )}

        {/* Real Credits Display */}
        <SignedIn>
          {(credits !== null || oneMaxBalance !== null) && (
            <div className={`px-3 py-2 rounded-lg text-sm font-medium backdrop-blur-sm ${
              isOneMaxUser
                ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-400/30 text-white'
                : 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/30 text-white'
            }`}>
              {isOneMaxUser
                ? `$${(oneMaxBalance || 0).toFixed(2)}`
                : `${credits || 0} credits`
              }
            </div>
          )}
        </SignedIn>
      </div>

      {/* Hamburger Menu Button */}
      <button
        onClick={toggleSidebar}
        className={`fixed top-4 left-4 z-[99999] p-2 rounded-lg transition-all duration-200 backdrop-blur-sm ${
          isOpen
            ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30 text-purple-400'
            : 'bg-black/50 border border-white/20 text-white hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-pink-500/20 hover:border-purple-400/30 hover:text-purple-400'
        }`}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Dropdown Menu - Only show for non-social-twin pages */}
      {!isTwin && isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[20000]"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu Panel */}
          <div
            className={`absolute top-12 left-4 bg-black/95 border border-white/20 rounded-lg shadow-xl backdrop-blur-xl z-[20001] ${
              isMobile 
                ? 'w-[calc(100vw-2rem)] max-w-sm max-h-[calc(100vh-5rem)] overflow-y-auto' 
                : 'w-64'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Menu</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-md hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation Items */}
              <nav className="space-y-2 mb-4">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 group w-full text-left ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/30 text-blue-300'
                          : 'hover:bg-gradient-to-r hover:from-blue-500/20 hover:to-cyan-500/20 hover:border hover:border-blue-400/30 hover:text-blue-300 text-white'
                      }`}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 transition-colors duration-200 ${
                        isActive ? 'text-blue-300' : 'text-gray-400 group-hover:text-blue-300'
                      }`} />
                      <span className={`text-sm font-medium transition-colors duration-200 ${
                        isActive ? 'text-blue-300' : 'text-white group-hover:text-blue-300'
                      }`}>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </nav>

              {/* Auth Section */}
              <div className="border-t border-white/20 pt-4">
                <SignedIn>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Account</span>
                    <UserButton />
                  </div>
                </SignedIn>
                <SignedOut>
                  <SignInButton>
                    <Button className="w-full bg-white text-black hover:bg-gray-200">
                      Sign In
                    </Button>
                  </SignInButton>
                </SignedOut>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default HamburgerMenu;