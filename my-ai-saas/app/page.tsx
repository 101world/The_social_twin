import Hero3D from "@/components/Hero3D";
import NoScroll from "@/components/NoScroll";

export default function Home() {
  return (
    <main className="w-screen h-screen overflow-hidden max-w-none mx-0 p-0">
      <NoScroll />
      <Hero3D>
        <a className="group rounded-full border p-4 text-white hover:bg-white/10 cursor-pointer" href="/social-twin" title="The Social Twin">
          <span className="sr-only">Social Twin</span>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-colors group-hover:text-white">
            <path d="M8 7a4 4 0 1 0 0 8m8-8a4 4 0 1 0 0 8" />
            <path d="M2 21c1.5-3 4.5-5 6-5s4.5 2 6 5m2-9c3 0 6 2 6 5" />
          </svg>
        </a>
        <a className="group rounded-full border p-4 text-white hover:bg-white/10 cursor-pointer" href="/dashboard" title="Dashboard">
          <span className="sr-only">Dashboard</span>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-colors group-hover:text-white">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        </a>
        <a className="group rounded-full border p-4 text-white hover:bg-white/10 cursor-pointer" href="/subscription" title="Subscriptions">
          <span className="sr-only">Subscriptions</span>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-colors group-hover:text-white">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </a>
        <a className="group rounded-full border p-4 text-white hover:bg-white/10 cursor-pointer" href="/user" title="Profile">
          <span className="sr-only">User Profile</span>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-colors group-hover:text-white">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
          </svg>
        </a>
      </Hero3D>
    </main>
  );
}
