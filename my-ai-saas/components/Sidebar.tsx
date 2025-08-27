'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { SignedOut, SignInButton, SignedIn, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import {
  Home,
  MessageCircle,
  Newspaper,
  FolderOpen,
  Plus,
  ChevronUp,
  ChevronDown,
  Zap,
  CreditCard,
  Settings
} from 'lucide-react';

interface Project {
  id: string;
  title: string;
  updated_at?: string;
  created_at?: string;
}

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

const Sidebar = ({ isOpen = true, onToggle }: SidebarProps = {}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectsMenu, setShowProjectsMenu] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [oneMaxBalance, setOneMaxBalance] = useState<number | null>(null);
  const [isOneMaxUser, setIsOneMaxUser] = useState<boolean>(false);
  const [simple, setSimple] = useState<boolean>(true);
  const pathname = usePathname();
  const router = useRouter();

  // Don't render sidebar if not open
  if (!isOpen) {
    return null;
  }

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

  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await fetch('/api/social-twin/projects');
        if (response.ok) {
          const data = await response.json();
          setProjects(Array.isArray(data.projects) ? data.projects : []);
        }
      } catch (error) {
        console.log('Projects API not available');
        setProjects([]);
      }
    };
    loadProjects();
  }, []);

  // Sync Simple/Pro with Social Twin page
  useEffect(() => {
    if (!pathname?.startsWith('/social-twin')) return;
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
  }, [pathname]);

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
    {
      href: '/',
      label: 'Home',
      icon: Home,
      action: () => router.push('/')
    },
    {
      href: '/social-twin',
      label: 'Chat',
      icon: MessageCircle,
      action: () => router.push('/social-twin?tab=chat')
    },
    {
      href: '/news',
      label: 'News',
      icon: Newspaper,
      action: () => router.push('/news')
    },
    {
      href: '/one',
      label: 'Code of ONE',
      icon: Zap,
      action: () => router.push('/one')
    },
    {
      href: '/subscription',
      label: 'Subscription',
      icon: CreditCard,
      action: () => router.push('/subscription')
    },
  ];

  const handleProjectsClick = () => {
    setShowProjectsMenu(!showProjectsMenu);
  };

  const handleNewProject = () => {
    setShowProjectsMenu(false);
    router.push('/social-twin?new=true');
  };

  return (
    <>
      {/* Permanent Thin Left Sidebar - Desktop Only */}
      <div className="fixed left-0 top-0 h-full w-16 bg-black/95 border-r border-white/20 backdrop-blur-xl z-[10001] flex flex-col items-center py-4">
        {/* Navigation Icons */}
        <nav className="flex-1 flex flex-col items-center space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href ||
              (item.href === '/user' && pathname === '/user') ||
              (item.href === '/social-twin' && pathname?.startsWith('/social-twin'));
            return (
              <button
                key={item.href}
                onClick={item.action}
                className={`group relative p-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-500/20 border border-blue-400/30 text-blue-400'
                    : 'hover:bg-blue-500/20 hover:border hover:border-blue-400/30 hover:text-blue-400 text-white'
                }`}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  <div className="bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap border border-white/20">
                    {item.label}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Projects Section */}
          <div className="relative">
            <button
              onClick={handleProjectsClick}
              className={`group relative p-3 rounded-lg transition-all duration-200 ${
                pathname?.startsWith('/social-twin') && pathname?.includes('projectId')
                  ? 'bg-blue-500/20 border border-blue-400/30 text-blue-400'
                  : 'hover:bg-blue-500/20 hover:border hover:border-blue-400/30 hover:text-blue-400 text-white'
              }`}
              title="Projects"
            >
              <FolderOpen className="w-5 h-5" />
              {/* Tooltip */}
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div className="bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap border border-white/20">
                  Projects
                </div>
              </div>
            </button>

            {/* Projects Drop-up Menu */}
            {showProjectsMenu && (
              <div className="absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg shadow-xl backdrop-blur-xl z-[10002] min-w-48">
                <div className="p-3">
                  {/* New Project Button */}
                  <button
                    onClick={handleNewProject}
                    className="flex items-center space-x-2 w-full px-3 py-2 rounded-lg transition-all duration-200 hover:bg-green-500/20 hover:text-green-400 text-white text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Project</span>
                  </button>

                  {/* Projects List */}
                  {projects.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {projects.slice(0, 5).map((project) => (
                        <Link
                          key={project.id}
                          href={`/social-twin?projectId=${encodeURIComponent(project.id)}`}
                          onClick={() => setShowProjectsMenu(false)}
                          className="block px-3 py-2 rounded-lg transition-all duration-200 hover:bg-blue-500/20 hover:text-blue-400 text-white text-sm truncate"
                        >
                          {project.title || 'Untitled Project'}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Bottom Section */}
        <div className="flex flex-col items-center space-y-2">
          {/* Turbo Mode Toggle - Only show on Social Twin pages */}
          {pathname?.startsWith('/social-twin') && (
            <button
              onClick={toggleSimple}
              className={`group relative p-2 rounded-lg transition-all duration-200 ${
                simple
                  ? 'bg-black/50 border border-white/20 text-white hover:bg-blue-500/20 hover:border-blue-400/30'
                  : 'bg-blue-500/20 border border-blue-400/30 text-blue-400 hover:bg-blue-500/30'
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
              {/* Tooltip */}
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div className="bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap border border-white/20">
                  {simple ? 'Turbo Mode' : 'Pro Mode'}
                </div>
              </div>
            </button>
          )}

          {/* User Account */}
          <div className="group relative">
            <SignedIn>
              <div className="scale-90">
                <UserButton />
              </div>
            </SignedIn>
            <SignedOut>
              <SignInButton>
                <Button size="sm" className="text-xs px-2 py-1 h-8">Sign In</Button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
      </div>

      {/* Top Right Corner - Credits Display */}
      <div className="fixed top-4 right-4 z-[99999] flex items-center space-x-3">
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

      {/* Click outside to close projects menu */}
      {showProjectsMenu && (
        <div
          className="fixed inset-0 z-[10000]"
          onClick={() => setShowProjectsMenu(false)}
        />
      )}
    </>
  );
};

export default Sidebar;
