"use client";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

function proxied(url?: string | null) {
  if (!url || typeof url !== "string") return "";
  try {
    if (url.startsWith("http") && typeof window !== "undefined" && !url.startsWith(location.origin)) {
      return `/api/social-twin/proxy?url=${encodeURIComponent(url)}`;
    }
  } catch {}
  return url;
}

export default function PublicStudioPage() {
  const { handle } = useParams<{ handle: string }>();
  const router = useRouter();
  // Placeholder data – wire to real API later
  const studio = useMemo(() => ({
    handle: String(handle || "studio"),
    name: "Studio of Tomorrow",
    avatar: "",
    tagline: "Cinematic experiments in AI art",
    following: false,
  }), [handle]);
  const film = useMemo(() => ({
    title: "Neon Drift",
    logline: "A dream in chrome and color.",
    genres: ["Sci-fi", "Neo-noir"],
    duration: "3:12",
    posterUrl: "", // fill when publishing
    trailerUrl: "", // fill when publishing
  }), []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);

  return (
    <main className="min-h-screen w-full bg-black text-white">
      {/* Studio header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full border border-white/20 bg-white/5" />
          <div>
            <div className="text-sm uppercase tracking-wide opacity-70">@{studio.handle}</div>
            <div className="text-lg font-semibold">{studio.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded border border-white/20 px-3 py-1 text-sm hover:bg-white/10">Follow Studio</button>
          <button className="rounded border border-white/20 px-3 py-1 text-sm hover:bg-white/10">Tip</button>
        </div>
      </header>

      {/* Hero: Poster + Trailer */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 p-4 md:grid-cols-5">
        {/* Poster (1:1) */}
        <div className="md:col-span-2">
          <div className="group aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/5">
            {film.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proxied(film.posterUrl)}
                alt={film.title}
                className="h-full w-full origin-center object-cover transition-transform duration-300 group-hover:scale-[1.06]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/10 to-white/0">
                <div className="text-center text-sm opacity-60">Poster coming soon</div>
              </div>
            )}
          </div>
          {/* Overlay meta */}
          <div className="mt-3 space-y-1">
            <div className="text-xl font-semibold">{film.title}</div>
            <div className="text-sm opacity-70">{film.logline}</div>
            <div className="text-xs opacity-60">{film.genres.join(" • ")} • {film.duration}</div>
          </div>
        </div>

        {/* Trailer (16:9) */}
        <div className="md:col-span-3">
          <div className="group aspect-video overflow-hidden rounded-xl border border-white/10 bg-white/5">
            {film.trailerUrl ? (
              <video
                ref={videoRef}
                src={proxied(film.trailerUrl)}
                className="h-full w-full origin-center object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                playsInline
                muted={muted}
                autoPlay
                loop
                onMouseEnter={() => { try { setMuted(false); videoRef.current?.play().catch(()=>{}); } catch {} }}
                onMouseLeave={() => { try { setMuted(true); } catch {} }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/10 to-white/0">
                <div className="text-center text-sm opacity-60">Trailer coming soon</div>
              </div>
            )}
          </div>
          {/* Controls */}
          <div className="mt-3 flex items-center gap-2">
            <button className="rounded bg-white px-4 py-2 text-black" onClick={()=> router.push(`/s/${studio.handle}/neon-drift`)}>Watch Film</button>
            <button className="rounded border border-white/20 px-3 py-2 text-sm hover:bg-white/10">Save</button>
            <button className="rounded border border-white/20 px-3 py-2 text-sm hover:bg-white/10">Share</button>
            <button className="ml-auto rounded border border-white/20 px-3 py-2 text-sm hover:bg-white/10" onClick={()=> setMuted((m)=> !m)}>{muted ? "Unmute" : "Mute"}</button>
          </div>
        </div>
      </section>

      {/* Details + More */}
      <section className="mx-auto max-w-6xl p-4">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <div className="text-sm opacity-80">Synopsis</div>
            <p className="text-sm opacity-70">An atmospheric journey through neon-lit streets and synthetic dreams.</p>
            <div className="mt-4 text-sm opacity-80">Credits</div>
            <div className="text-xs opacity-70">Direction • Sound • Design • AI</div>
          </div>
          <div>
            <div className="text-sm opacity-80">Related Films</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="group aspect-[2/3] overflow-hidden rounded border border-white/10 bg-white/5">
                  <div className="h-full w-full origin-center bg-gradient-to-br from-white/10 to-white/0 transition-transform duration-300 group-hover:scale-[1.06]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}






