'use client';

import { useEffect, useState } from 'react';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import MatrixBackground from '@/components/MatrixBackground';

const inter = Inter({ subsets: ['latin'] });

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <main className="relative h-screen w-screen bg-black text-white overflow-hidden">
      {/* Matrix Background */}
      <MatrixBackground />

      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900" />

      {/* Clerk User Profile - Left Bottom Corner */}
      <div className="fixed bottom-6 left-6 z-[10002]">
        <SignedIn>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-12 h-12",
                userButtonAvatarBox: "w-12 h-12"
              }
            }}
          />
        </SignedIn>
        <SignedOut>
          <div className="w-12 h-12" /> {/* Placeholder to maintain layout */}
        </SignedOut>
      </div>

      {/* Main Content Container - Centered */}
      <div className="flex items-center justify-center h-full">
        <div className="relative z-10 text-center px-6">
          {/* Main Title with fade animation */}
          <div
            className={`transition-all duration-2000 ease-out transform ${
              isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-8'
            }`}
          >
            <h1 className={`${inter.className} text-6xl md:text-8xl font-black tracking-tighter text-white mb-4`}>
              The Social Twin
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
            <p className={`${inter.className} text-sm md:text-base text-gray-400 mb-12 tracking-wide`}>
              Powered by ONE
            </p>
          </div>

          {/* Buttons with staggered fade */}
          <div
            className={`flex flex-col sm:flex-row gap-6 justify-center items-center transition-all duration-2000 delay-1000 ease-out transform ${
              isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4'
            }`}
          >
            <Link
              href="/social-twin"
              className={`${inter.className} px-12 py-4 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-all duration-300 text-lg tracking-wide shadow-lg hover:shadow-xl transform hover:scale-105`}
            >
              CREATE
            </Link>

            <SignedOut>
              <SignInButton mode="modal">
                <button className={`${inter.className} px-12 py-4 border-2 border-white text-white font-bold rounded-full hover:bg-white hover:text-black transition-all duration-300 text-lg tracking-wide shadow-lg hover:shadow-xl transform hover:scale-105`}>
                  SIGN IN
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <Link
                href="/social-twin"
                className={`${inter.className} px-12 py-4 border-2 border-white text-white font-bold rounded-full hover:bg-white hover:text-black transition-all duration-300 text-lg tracking-wide shadow-lg hover:shadow-xl transform hover:scale-105`}
              >
                ENTER
              </Link>
            </SignedIn>
          </div>
        </div>
      </div>
    </main>
  );
}
