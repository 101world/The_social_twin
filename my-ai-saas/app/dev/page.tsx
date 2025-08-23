"use client";
import { useState } from "react";

export default function DevRunPod() {
  const [url, setUrl] = useState<string>(process.env.NEXT_PUBLIC_RUNPOD_IMAGE_URL || "");
  const [prompt, setPrompt] = useState<string>("");
  const [resp, setResp] = useState<any>(null);

  async function run() {
    setResp(null);
    const payload = { prompt: JSON.parse(JSON.stringify({ prompt })) }; // placeholder; replace with graph payload as needed
    const r = await fetch("/api/dev/runpod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, payload }),
    });
    const j = await r.json();
    setResp(j);
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Developer Mode: RunPod Direct</h1>
      <div className="grid gap-2 max-w-2xl">
        <label className="text-sm font-medium">RunPod Base URL</label>
        <input className="rounded border p-2" value={url} onChange={(e)=>setUrl(e.target.value)} placeholder="https://..." />
      </div>
      <div className="grid gap-2 max-w-2xl">
        <label className="text-sm font-medium">Prompt (simple)</label>
        <textarea className="rounded border p-2 min-h-[120px]" value={prompt} onChange={(e)=>setPrompt(e.target.value)} />
      </div>
      <button className="rounded bg-black text-white px-4 py-2" onClick={run}>Send</button>
      <pre className="mt-4 max-w-4xl overflow-auto whitespace-pre-wrap rounded border p-3 text-xs">{JSON.stringify(resp, null, 2)}</pre>
    </main>
  );
}







