'use client';

import { usePathname } from 'next/navigation';
import Navbar from "@/components/Navbar";
import HamburgerMenu from "@/components/HamburgerMenu";

export default function ConditionalNavigation() {
  const pathname = usePathname();
  
  // Hide navigation on home page only - clean UI without hamburger menu
  // Force hide on exact home path
  console.log('ConditionalNavigation - Current pathname:', pathname);
  
  if (pathname === '/' || pathname === '') {
    console.log('ConditionalNavigation - Hiding navigation for home page');
    return null;
  }

  console.log('ConditionalNavigation - Showing navigation for non-home page');
  return (
    <>
      {/* Desktop: Hamburger Menu, Mobile: Navbar */}
      <div className="hidden md:block">
        <HamburgerMenu />
      </div>
      <div className="md:hidden">
        <Navbar />
      </div>
    </>
  );
}
