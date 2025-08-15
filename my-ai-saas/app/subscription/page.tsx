"use client";
import { useEffect, useState } from "react";
import { PricingTable } from "@clerk/nextjs";

export default function SubscriptionPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(()=> setMounted(true), []);
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Ambient blurred orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute right-0 top-32 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <section className="mx-auto max-w-5xl p-6">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Subscriptions</h1>
            <p className="opacity-70">Choose a plan to power your Studio.</p>
          </div>
          <div className="text-sm opacity-70">{mounted ? new Date().toLocaleDateString() : ""}</div>
        </header>

        {/* Clerk Pricing Table (working subscription flow) */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-md">
          <PricingTable />
        </div>

        {/* Legal footnotes */}
        <section className="mt-12 space-y-4 text-xs opacity-70">
          <div className="text-sm font-semibold opacity-80">Terms & Privacy</div>
          <p>
            By using The Social Twin, you agree to our Terms of Service and Privacy Policy. All content generated using our
            AI tools is, to the fullest extent permitted by law, owned by and constitutes the intellectual property of The Social
            Twin in perpetuity. You receive a non-exclusive license to display such content within our platform and for personal
            portfolio and social sharing, subject to our policies. Commercial use may require an appropriate license or plan upgrade.
          </p>
          <p>
            Subscriptions are non-refundable once a billing period begins. Cancelling will stop renewal at the end of the current
            period. We may remove content that violates our guidelines. See detailed policies for prohibited content, takedown,
            and dispute procedures.
          </p>
          <p>
            Data: We store account data and generation metadata to operate the service. Media may be stored in Supabase Storage or
            referenced from external endpoints; we provide signed URLs where applicable. See our Privacy Policy for retention and
            access details.
          </p>
          <div className="flex flex-wrap gap-4">
            <a className="underline hover:opacity-80" href="#" onClick={(e)=> e.preventDefault()}>Full Terms of Service</a>
            <a className="underline hover:opacity-80" href="#" onClick={(e)=> e.preventDefault()}>Privacy Policy</a>
            <a className="underline hover:opacity-80" href="#" onClick={(e)=> e.preventDefault()}>Refund Policy</a>
          </div>
        </section>
      </section>
    </main>
  );
}
