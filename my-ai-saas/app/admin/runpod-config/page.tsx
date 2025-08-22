"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";

export default function RunpodConfigAdminPage() {
  const { isSignedIn, user } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [imageUrl, setImageUrl] = useState("");
  const [imageModifyUrl, setImageModifyUrl] = useState("");
  const [textUrl, setTextUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const canView = useMemo(() => {
    // Optionally allow restricting by user IDs via env (client-visible)
    const ids = (process.env.NEXT_PUBLIC_ADMIN_USER_IDS || "").split(",").map(s=>s.trim()).filter(Boolean);
    if (!ids.length) return isSignedIn; // if not configured, any signed-in user can view, token still required to save
    return Boolean(isSignedIn && user && ids.includes(user.id));
  }, [isSignedIn, user]);

  useEffect(() => {
    try {
      const t = window.localStorage.getItem("runpod_config_token") || "";
      setToken(t);
    } catch {}
  }, []);

  async function loadConfig() {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/runpod-config", { method: "GET" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      const c = j?.config || {};
      setImageUrl(c.image_url || "");
      setImageModifyUrl(c.image_modify_url || "");
      setTextUrl(c.text_url || "");
      setVideoUrl(c.video_url || "");
      setStatus("Loaded current config");
    } catch (e: any) {
      setError(e?.message || "Failed to load config");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadConfig(); }, []);

  async function saveConfig() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      if (!token.trim()) throw new Error("Config token required");
      const body: any = {};
      if (imageUrl !== undefined) body.image_url = imageUrl.trim();
      if (imageModifyUrl !== undefined) body.image_modify_url = imageModifyUrl.trim();
      if (textUrl !== undefined) body.text_url = textUrl.trim();
      if (videoUrl !== undefined) body.video_url = videoUrl.trim();
      const res = await fetch("/api/runpod-config", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-config-token": token.trim() },
        body: JSON.stringify(body)
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setStatus("Saved");
    } catch (e: any) {
      setError(e?.message || "Failed to save config");
    } finally {
      setSaving(false);
    }
  }

  function persistToken(v: string) {
    setToken(v);
    try { window.localStorage.setItem("runpod_config_token", v); } catch {}
  }

  if (!isSignedIn) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold mb-2">RunPod Config</h1>
        <p>Please sign in to access admin settings.</p>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold mb-2">RunPod Config</h1>
        <p>Access restricted.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold mb-4">RunPod Endpoint Configuration</h1>
      <p className="text-sm mb-6 opacity-80">Update active RunPod endpoints. Server and worker will use these automatically. A token is required to save.</p>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Config Token</label>
        <input
          value={token}
          onChange={(e)=> persistToken(e.target.value)}
          type="password"
          placeholder="Enter RUNPOD_CONFIG_TOKEN"
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <div className="text-xs mt-1 opacity-70">Set RUNPOD_CONFIG_TOKEN in your env. This token is used only in the request header.</div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Image RunPod URL</label>
          <input value={imageUrl} onChange={(e)=> setImageUrl(e.target.value)} placeholder="https://..." className="w-full rounded border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Image Modify RunPod URL</label>
          <input value={imageModifyUrl} onChange={(e)=> setImageModifyUrl(e.target.value)} placeholder="https://..." className="w-full rounded border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Text RunPod URL</label>
          <input value={textUrl} onChange={(e)=> setTextUrl(e.target.value)} placeholder="https://..." className="w-full rounded border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Video RunPod URL</label>
          <input value={videoUrl} onChange={(e)=> setVideoUrl(e.target.value)} placeholder="https://..." className="w-full rounded border px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button onClick={loadConfig} disabled={loading} className="rounded border px-3 py-2 text-sm">
          {loading ? "Loading..." : "Reload"}
        </button>
        <button onClick={saveConfig} disabled={saving} className="rounded border px-3 py-2 text-sm">
          {saving ? "Saving..." : "Save"}
        </button>
        {status && <span className="text-emerald-600 text-sm">{status}</span>}
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </div>

      <div className="mt-6 text-xs opacity-70">
        <div>Notes:</div>
        <ul className="list-disc ml-5 mt-1 space-y-1">
          <li>These values override env defaults. Per-request overrides still work if provided.</li>
          <li>Worker respects RUNPOD_ENABLED=true; set to false to pause RunPod calls.</li>
          <li>After saving, existing requests and the worker will use the new URLs immediately.</li>
        </ul>
      </div>
    </div>
  );
}
