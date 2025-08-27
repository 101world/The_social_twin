'use client';

import { usePathname } from 'next/navigation';
import Navbar from "@/components/Navbar";
import HamburgerMenu from "@/components/HamburgerMenu";

export default function ConditionalNavigation() {
  const pathname = usePathname();
  
  // Hide navigation on home page only - updated with blue-cyan theme
  if (pathname === '/') {
    return null;
  }

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
