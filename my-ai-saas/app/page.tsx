'use client';

import { useEffect, useState } from 'react';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import MatrixBackground from '@/components/MatrixBackground';

const inter = Inter({ subsets: ['latin'] });

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <main className="relative h-screen w-screen bg-black text-white flex items-center justify-center overflow-hidden">
      {/* Matrix Background */}
      <MatrixBackground />

      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900" />

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
    </main>
  );
}
