'use client';

import { useEffect, useState } from 'react';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import MatrixBackground from '@/components/MatrixBackground';
import Sidebar from '@/components/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <main className="relative h-screen w-screen bg-black text-white overflow-hidden">
      {/* Matrix Background */}
      <MatrixBackground />

      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900" />

      {/* Hamburger Menu - Top Left */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-6 left-6 z-[10002] p-3 rounded-lg bg-black/50 border border-white/20 backdrop-blur-sm hover:bg-black/70 transition-all duration-200"
        aria-label="Toggle menu"
      >
        <div className="w-6 h-5 flex flex-col justify-center">
          <span className={`w-full h-0.5 bg-white transition-all duration-200 ${sidebarOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
          <span className={`w-full h-0.5 bg-white transition-all duration-200 mt-1 ${sidebarOpen ? 'opacity-0' : ''}`} />
          <span className={`w-full h-0.5 bg-white transition-all duration-200 mt-1 ${sidebarOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
        </div>
      </button>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[10001]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full z-[10002] transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      </div>

      {/* Main Content Container */}
      <div className={`flex items-center justify-center h-full transition-all duration-300 ${
        sidebarOpen ? 'md:ml-16' : ''
      }`}>
        <div className="relative z-10 text-center px-6">
          {/* Main ONE text with fade animation */}
          <div
            className={`transition-all duration-2000 ease-out transform ${
              isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-8'
            }`}
          >
            <h1 className={`${inter.className} text-[12rem] md:text-[16rem] font-black tracking-tighter text-white mb-6`}>
              ONE
            </h1>
          </div>

          {/* Subtitle with delayed fade */}
          <div
            className={`transition-all duration-2000 delay-500 ease-out transform ${
              isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4'
            }`}
          >
            <p className={`${inter.className} text-lg md:text-xl text-gray-400 mb-12 tracking-wide`}>
              one neural engine
            </p>
          </div>

          {/* Buttons with staggered fade */}
          <div
            className={`flex flex-col sm:flex-row gap-4 justify-center items-center transition-all duration-2000 delay-1000 ease-out transform ${
              isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4'
            }`}
          >
            <Link
              href="/social-twin"
              className={`${inter.className} px-8 py-3 bg-white text-black font-semibold rounded-full hover:bg-gray-200 transition-colors duration-300 text-sm tracking-wide`}
            >
              Creator
            </Link>

            <Link
              href="/social-twin"
              className={`${inter.className} px-8 py-3 border border-white text-white font-semibold rounded-full hover:bg-white hover:text-black transition-colors duration-300 text-sm tracking-wide`}
            >
              News
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
