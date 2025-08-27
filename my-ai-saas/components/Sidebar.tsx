'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { SignedOut, SignInButton, SignedIn, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import {
  Menu,
  X,
  Home,
  MessageCircle,
  LayoutDashboard,
  Newspaper,
  FolderOpen,
  Plus,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface Project {
  id: string;
  title: string;
  updated_at?: string;
  created_at?: string;
}

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectsMenu, setShowProjectsMenu] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [oneMaxBalance, setOneMaxBalance] = useState<number | null>(null);
  const [isOneMaxUser, setIsOneMaxUser] = useState<boolean>(false);
  const pathname = usePathname();
  const router = useRouter();

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

  // Close menu on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setShowProjectsMenu(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const menuItems = [
    {
      href: '/social-twin',
      label: 'Chat',
      icon: MessageCircle,
      action: () => {
        setIsOpen(false);
        // Navigate to social-twin with chat tab
        router.push('/social-twin?tab=chat');
      }
    },
    {
      href: '/user',
      label: 'Dashboard',
      icon: LayoutDashboard,
      action: () => {
        setIsOpen(false);
        router.push('/user?tab=overview');
      }
    },
    {
      href: '/news',
      label: 'News',
      icon: Newspaper,
      action: () => {
        setIsOpen(false);
        router.push('/news');
      }
    },
  ];

  const handleProjectsClick = () => {
    setShowProjectsMenu(!showProjectsMenu);
  };

  const handleNewProject = () => {
    setIsOpen(false);
    setShowProjectsMenu(false);
    router.push('/social-twin?new=true');
  };

  return (
    <>
      {/* Thin Left Border - Desktop Only */}
      <div className="hidden md:block fixed left-0 top-0 h-full w-1 bg-gradient-to-b from-cyan-400/50 via-teal-400/50 to-cyan-400/50 z-[10000]" />

      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hidden md:flex fixed left-2 top-4 z-[10001] p-2 rounded-lg transition-all duration-200 backdrop-blur-sm bg-black/50 border border-white/20 text-white hover:bg-blue-500/20 hover:border-blue-400/30 hover:text-blue-400"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

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

      {/* Sidebar Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="hidden md:block fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000]"
            onClick={() => {
              setIsOpen(false);
              setShowProjectsMenu(false);
            }}
          />

          {/* Sidebar */}
          <div className="hidden md:block fixed left-0 top-0 h-full w-64 bg-black/95 border-r border-white/20 backdrop-blur-xl z-[10001] transform transition-transform duration-300 ease-in-out">
            <div className="p-6 pt-16">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Navigation</h2>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setShowProjectsMenu(false);
                  }}
                  className="p-1 rounded-md hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation Items */}
              <nav className="space-y-2 mb-6">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href ||
                    (item.href === '/user' && pathname === '/user') ||
                    (item.href === '/social-twin' && pathname?.startsWith('/social-twin'));
                  return (
                    <button
                      key={item.href}
                      onClick={item.action}
                      className={`flex items-center space-x-3 w-full px-3 py-3 rounded-lg transition-all duration-200 group text-left ${
                        isActive
                          ? 'bg-blue-500/20 border border-blue-400/30 text-blue-400'
                          : 'hover:bg-blue-500/20 hover:border hover:border-blue-400/30 hover:text-blue-400 text-white'
                      }`}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 transition-colors duration-200 ${
                        isActive ? 'text-blue-400' : 'text-gray-400 group-hover:text-blue-400'
                      }`} />
                      <span className={`text-sm font-medium transition-colors duration-200 ${
                        isActive ? 'text-blue-400' : 'text-white group-hover:text-blue-400'
                      }`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}

                {/* Projects Section */}
                <div className="relative">
                  <button
                    onClick={handleProjectsClick}
                    className={`flex items-center justify-between w-full px-3 py-3 rounded-lg transition-all duration-200 group text-left ${
                      pathname?.startsWith('/social-twin') && pathname?.includes('projectId')
                        ? 'bg-blue-500/20 border border-blue-400/30 text-blue-400'
                        : 'hover:bg-blue-500/20 hover:border hover:border-blue-400/30 hover:text-blue-400 text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <FolderOpen className={`w-5 h-5 flex-shrink-0 transition-colors duration-200 ${
                        pathname?.startsWith('/social-twin') && pathname?.includes('projectId')
                          ? 'text-blue-400'
                          : 'text-gray-400 group-hover:text-blue-400'
                      }`} />
                      <span className={`text-sm font-medium transition-colors duration-200 ${
                        pathname?.startsWith('/social-twin') && pathname?.includes('projectId')
                          ? 'text-blue-400'
                          : 'text-white group-hover:text-blue-400'
                      }`}>
                        Projects
                      </span>
                    </div>
                    {showProjectsMenu ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {/* Projects Drop-up Menu */}
                  {showProjectsMenu && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-black/95 border border-white/20 rounded-lg shadow-xl backdrop-blur-xl z-[10002]">
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
                                onClick={() => {
                                  setIsOpen(false);
                                  setShowProjectsMenu(false);
                                }}
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

export default Sidebar;
