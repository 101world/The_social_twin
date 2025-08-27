'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SignedOut, SignInButton, SignedIn, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Menu, X, Home, Users, CreditCard, Zap } from 'lucide-react';
import { usePathname } from 'next/navigation';

const HamburgerMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [oneMaxBalance, setOneMaxBalance] = useState<number | null>(null);
  const [isOneMaxUser, setIsOneMaxUser] = useState<boolean>(false);
  const [simple, setSimple] = useState<boolean>(true);
  const pathname = usePathname();
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

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  const toggleSimple = () => {
    const next = !simple;
    setSimple(next);
    try {
      localStorage.setItem('social_twin_simple', next ? '1' : '0');
      const f: any = (window as any).__setSimpleMode;
      if (typeof f === 'function') f(next);
    } catch {}
  };

  const menuItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/social-twin', label: 'Social Twin', icon: Users },
    { href: '/subscription', label: 'Subscriptions', icon: CreditCard },
    { href: '/one', label: 'Code of ONE', icon: Zap },
    { href: '/explore', label: 'Explore', icon: () => <span className="text-lg">🔍</span> },
  ];

  return (
    <header className="fixed top-4 left-4 z-[20000]">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <button
            className="p-2 rounded-lg bg-black/50 border border-white/20 text-white hover:bg-black/70 hover:border-white/40 transition-all duration-200 backdrop-blur-sm"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-md bg-black/95 border border-white/20 text-white backdrop-blur-xl">
          <div className="flex flex-col space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Menu</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Credits/Balance Display */}
            <SignedIn>
              {(credits !== null || oneMaxBalance !== null) && (
                <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  isOneMaxUser
                    ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-400/30'
                    : 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/30'
                }`}>
                  {isOneMaxUser
                    ? `$${(oneMaxBalance || 0).toFixed(2)}`
                    : `${credits || 0} credits`
                  }
                </div>
              )}
            </SignedIn>

            {/* Navigation Items */}
            <nav className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleLinkClick}
                    className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors group"
                  >
                    <Icon className="w-5 h-5 text-gray-400 group-hover:text-white" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Simple/Pro Toggle for Social Twin */}
            {isTwin && (
              <div className="border-t border-white/20 pt-4">
                <button
                  onClick={toggleSimple}
                  className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors w-full group"
                >
                  <div className={`p-1 rounded ${simple ? 'bg-white/20' : 'bg-yellow-500/20'}`}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill={simple ? '#ffffff' : '#facc15'}
                      className="w-4 h-4"
                    >
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium">
                    {simple ? 'Normal Mode' : 'Pro Mode'}
                  </span>
                </button>
              </div>
            )}

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
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default HamburgerMenu;</content>
<parameter name="filePath">c:\Users\welco\OneDrive\Desktop\101World\my-ai-saas\components\HamburgerMenu.tsx
