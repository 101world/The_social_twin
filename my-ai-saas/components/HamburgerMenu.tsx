'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SignedOut, SignInButton, SignedIn, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Menu, X, Home, Users, CreditCard, Zap, BarChart3, Newspaper, MessageCircle, Coins } from 'lucide-react';
import { usePathname } from 'next/navigation';

const HamburgerMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [oneMaxBalance, setOneMaxBalance] = useState<number | null>(null);
  const [isOneMaxUser, setIsOneMaxUser] = useState<boolean>(false);
  const [simple, setSimple] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [aiPersonality, setAiPersonality] = useState<'creative' | 'news' | 'police' | 'lawyer' | 'accountant' | 'teacher' | 'atom'>('atom');
  const pathname = usePathname();
  const router = useRouter();
  const isTwin = pathname?.startsWith('/social-twin');
  const isDashboard = pathname?.startsWith('/dashboard');
  
  // Hide hamburger menu on home page - MUST be before any useEffect hooks
  const isHomePage = pathname === '/' || pathname === '';
  
  // Load AI personality from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ai_personality');
      if (saved && ['creative', 'news', 'police', 'lawyer', 'accountant', 'teacher'].includes(saved)) {
        setAiPersonality(saved as any);
      }
    } catch {}
  }, []);
  
  // Load credits - run on all pages to avoid React hook order issues
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

  // Mobile detection - run on all pages to avoid React hook order issues
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

  // Sync Simple/Pro with Social Twin page - run on all pages to avoid React hook order issues
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

  // Close menu on Escape key - run on all pages to avoid React hook order issues
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Don't render anything on home page - but after all useEffect hooks
  if (isHomePage) {
    return null;
  }

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
    // Always show dropdown menu for navigation
    setIsOpen(!isOpen);
    
    // Additionally, for social-twin page, also control the internal sidebar
    if (isTwin) {
      try {
        const f: any = (window as any).__setSidebarOpen;
        if (typeof f === 'function') {
          f(!isOpen);
        }
      } catch {}
    }
  };

  const menuItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/social-twin', label: 'Social Twin', icon: Users },
    { href: '/chat', label: 'Chat', icon: MessageCircle },
    { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { href: '/news', label: 'News', icon: Newspaper },
    { href: '/subscription', label: 'Subscriptions', icon: CreditCard },
    { href: '/one', label: 'Code of ONE', icon: Zap },
    { href: '/explore', label: 'Explore', icon: () => <span className="text-lg">🔍</span> },
  ];

  return (
    <>
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-[99999] border-b border-gray-700/30">
        <div className="flex items-center justify-between px-4 py-2">
          {/* Left Side - Hamburger Menu */}
          <div className="flex items-center">
            <button
              onClick={toggleSidebar}
              className={`p-2 rounded-lg transition-all duration-200 backdrop-blur-sm ${
                isOpen
                  ? 'bg-gradient-to-r from-gray-500/20 to-gray-400/20 border border-gray-500/30 text-gray-300'
                  : 'bg-gray-800/50 border border-gray-700/30 text-white hover:bg-gradient-to-r hover:from-gray-500/20 hover:to-gray-400/20 hover:border-gray-500/30 hover:text-gray-300'
              }`}
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Center - Empty space */}
          <div className="flex-1 flex justify-center">
          </div>

          {/* Right Side - Turbo Mode and Credits */}
          <div className="flex items-center space-x-3">
            {/* Turbo Mode Toggle - Only show on Social Twin pages */}
            {isTwin && (
              <button
                onClick={toggleSimple}
                className={`p-2 rounded-lg transition-all duration-200 backdrop-blur-sm ${
                  simple
                    ? 'bg-gray-800/50 border border-gray-700/30 text-white hover:bg-gray-700/50 hover:border-gray-600/40'
                    : 'bg-gradient-to-r from-gray-500/20 to-gray-400/20 border border-gray-500/30 text-gray-300 hover:from-gray-500/30 hover:to-gray-400/30'
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

            {/* Aesthetic Credits Display */}
            <SignedIn>
              {(credits !== null || oneMaxBalance !== null) && (
                <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg backdrop-blur-sm border transition-all duration-200 ${
                  isOneMaxUser
                    ? 'bg-gradient-to-r from-gray-500/20 to-gray-400/20 border-gray-500/30 text-white'
                    : 'bg-gradient-to-r from-gray-500/20 to-gray-400/20 border-gray-500/30 text-white hover:from-gray-500/30 hover:to-gray-400/30'
                }`}>
                  <Coins className={`w-4 h-4 ${isOneMaxUser ? 'text-gray-300' : 'text-gray-300'}`} />
                  <span className="text-sm font-bold">
                    {isOneMaxUser
                      ? `$${(oneMaxBalance || 0).toFixed(2)}`
                      : `${credits || 0}`
                    }
                  </span>
                </div>
              )}
            </SignedIn>
          </div>
        </div>
      </div>

      {/* Dropdown Menu - Show on all pages when hamburger menu is clicked */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[20000]"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu Panel */}
          <div
            className={`absolute top-16 left-4 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-900 border border-gray-700/30 rounded-lg shadow-xl backdrop-blur-xl z-[20001] ${
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
                          ? 'bg-gradient-to-r from-gray-500/20 to-gray-400/20 border border-gray-500/30 text-gray-300'
                          : 'hover:bg-gradient-to-r hover:from-gray-500/20 hover:to-gray-400/20 hover:border hover:border-gray-500/30 hover:text-gray-300 text-white'
                      }`}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 transition-colors duration-200 ${
                        isActive ? 'text-gray-300' : 'text-gray-400 group-hover:text-gray-300'
                      }`} />
                      <span className={`text-sm font-medium transition-colors duration-200 ${
                        isActive ? 'text-gray-300' : 'text-white group-hover:text-gray-300'
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