"use client";

import { useEffect, useRef } from "react";
import { animate } from "animejs";

// Lightweight wrapper around <model-viewer> for the Cyberpunk scene
// Expects assets at /Model/Cyberpunk/scene.gltf
export function Hero3D({ children }: { children?: React.ReactNode }) {
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const subtitleRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    // Inject model-viewer script if not present
    const existing = document.querySelector(
      'script[src^="https://unpkg.com/@google/model-viewer"]'
    );
    if (!existing) {
      const s = document.createElement("script");
      s.type = "module";
      s.src = "https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js";
      document.head.appendChild(s);
    }

    // Subtle entrance animations
    if (titleRef.current) {
      animate(titleRef.current, { translateY: [20, 0], opacity: [0, 1], easing: "easeOutQuad", duration: 800 });
    }
    if (subtitleRef.current) {
      animate(subtitleRef.current, { translateY: [12, 0], opacity: [0, 1], delay: 150, easing: "easeOutQuad", duration: 700 });
    }
  }, []);

  return (
    <section className="relative w-screen h-screen overflow-hidden bg-black">
      <div className="absolute inset-0 -z-10 opacity-70">
        {/* Model Viewer */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <model-viewer
          src="/Model/Cyberpunk/scene.gltf"
          camera-controls
          autoplay
          shadow-intensity="0.8"
          exposure="1.0"
          style={{ width: "100%", height: "100vh", background: "radial-gradient(ellipse at center, #0a0a0a 0%, #000 100%)" }}
        ></model-viewer>
      </div>

      {/* Gradient overlay for depth */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center text-white">
        <h1 ref={titleRef} className="text-5xl sm:text-6xl font-extrabold tracking-tight">
          101 World
        </h1>
        <p ref={subtitleRef} className="mt-3 max-w-2xl text-base sm:text-lg text-white/80">
          Build, chat, and create with your Social Twin — generate text, images, and videos.
        </p>
        {children ? <div className="mt-8 flex items-center justify-center gap-6">{children}</div> : null}
      </div>
    </section>
  );
}

export default Hero3D;


