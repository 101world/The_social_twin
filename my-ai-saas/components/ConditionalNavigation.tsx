'use client';

import { usePathname } from 'next/navigation';
import Navbar from "@/components/Navbar";
import HamburgerMenu from "@/components/HamburgerMenu";

export default function ConditionalNavigation() {
  const pathname = usePathname();
  
  // Always render components but let them handle their own visibility
  // This prevents React useEffect errors when components are unmounted
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
