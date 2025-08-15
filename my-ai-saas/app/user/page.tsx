"use client";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import FolderModal from "@/components/FolderModal";

type Tab = "media" | "projects" | "character" | "studio";

export default function StudioPage() {
  const { user } = useUser();
  const [tab, setTab] = useState<Tab>("media");
  const [projects, setProjects] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [mediaCursor, setMediaCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<any | null>(null);
  const [viewerMedia, setViewerMedia] = useState<any | null>(null);

  async function loadProjects() {
    try {
      const r = await fetch("/api/social-twin/projects", { headers: { "X-User-Id": (window as any)?.Clerk?.user?.id || "" } });
      const j = await r.json();
      setProjects(j.projects || []);
    } catch {}
  }
  useEffect(() => { loadProjects(); }, []);
  useEffect(() => {
    if (user?.id) loadProjects();
  }, [user?.id]);

  // Pick tab from query (?tab=projects)
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const t = params.get('tab');
      if (t === 'projects' || t === 'media' || t === 'character' || t === 'studio') setTab(t as Tab);
    } catch {}
  }, []);

  // Load generated media (history)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/social-twin/history?limit=24", { headers: { "X-User-Id": (window as any)?.Clerk?.user?.id || "" } });
        const j = await r.json();
        setMedia(j.items || []);
        setMediaCursor(j.nextCursor || null);
      } catch {}
    })();
  }, []);

  function proxied(url?: string | null) {
    if (!url || typeof url !== "string") return "";
    try {
      if (url.startsWith("http") && !url.startsWith(location.origin)) return `/api/social-twin/proxy?url=${encodeURIComponent(url)}`;
    } catch {}
    return url;
  }

  return (
    <>
    <main className="min-h-screen bg-black p-6 text-white">
      {/* Header */}
      <section className="mx-auto mb-6 flex max-w-5xl items-center gap-4">
        <div className="h-20 w-20 overflow-hidden rounded-full border">
          {user?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.imageUrl} alt="avatar" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-black/5">👤</div>
          )}
        </div>
        <div className="flex-1">
          <div className="text-xl font-semibold">{user?.fullName || user?.username || "Your Studio"}</div>
          <div className="text-sm opacity-70">{user?.primaryEmailAddress?.emailAddress || "no-email"}</div>
          <div className="mt-2 text-sm">
            {/* Simple editable bio placeholder (non-persistent demo) */}
            <span className="opacity-70">Bio:</span> <span>Describe yourself...</span>
          </div>
        </div>
      </section>

      {/* Studio Tabs */}
      <section className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button onClick={() => setTab("media")} className={`rounded border px-3 py-1 text-sm ${tab === "media" ? "bg-black text-white" : ""}`}>Generated Media</button>
          <button
            className="rounded border px-3 py-1 text-sm"
            onClick={async ()=>{
              const name = prompt('New Project name');
              if (!name) return;
              try {
                const r = await fetch('/api/social-twin/projects', { method:'POST', headers:{ 'Content-Type':'application/json', 'X-User-Id': (window as any)?.Clerk?.user?.id || '' }, body: JSON.stringify({ title: name, data: {} }) });
                await r.json().catch(()=>null);
                await loadProjects();
                setTab('projects');
               } catch {}
            }}
          >New Project</button>
          <button onClick={() => setTab("projects")} className={`rounded border px-3 py-1 text-sm ${tab === "projects" ? "bg-black text-white" : ""}`}>Projects</button>
          <button onClick={() => setTab("character")} className={`rounded border px-3 py-1 text-sm ${tab === "character" ? "bg-black text-white" : ""}`}>Characters</button>
          <button onClick={() => setTab("studio")} className={`rounded border px-3 py-1 text-sm ${tab === "studio" ? "bg-black text-white" : ""}`}>Studio Main</button>
        </div>

        {/* Panels */}
        {tab === "media" && (
          <div>
            <div className="mb-3 flex items-center justify-between text-sm opacity-70">
              <span>All generated media</span>
              {/* New Project moved to tabs bar */}
            </div>
            <div className="max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {media.map((it) => {
                const u = proxied(it.display_url || it.result_url);
                const isVideo = it.type === 'video' || (typeof u === 'string' && /\.(mp4|webm)(\?|$)/i.test(u));
                return (
                  <div key={it.id} className="rounded border p-2">
                    <div className="group aspect-video overflow-hidden rounded border cursor-pointer" onClick={()=>{ setViewerMedia(it); }}>
                      {isVideo ? (
                        <video src={u} className="h-full w-full origin-center object-cover transition-transform duration-200 group-hover:scale-[1.12]" />
                      ) : (
                        <img src={u || "/placeholder.png"} alt={it.prompt || "media"} className="h-full w-full origin-center object-cover transition-transform duration-200 group-hover:scale-[1.12]" />
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="text-[10px] opacity-60">{new Date(it.created_at || it.createdAt || Date.now()).toLocaleDateString()}</div>
                      <button
                        className="rounded border px-2 py-0.5 text-xs"
                        onClick={()=>{ setPendingMedia(it); setFolderModalOpen(true); }}
                      >Add to project</button>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
            <div className="mt-4 flex justify-center">
              {mediaCursor ? (
                <button
                  disabled={loadingMore}
                  onClick={async () => {
                    if (!mediaCursor) return;
                    setLoadingMore(true);
                    try {
                      const r = await fetch(`/api/social-twin/history?limit=24&cursor=${encodeURIComponent(mediaCursor)}`, { headers: { "X-User-Id": (window as any)?.Clerk?.user?.id || "" } });
                      const j = await r.json();
                      setMedia((prev) => [...prev, ...(j.items || [])]);
                      setMediaCursor(j.nextCursor || null);
                    } finally { setLoadingMore(false); }
                  }}
                  className="rounded border px-3 py-1 text-sm"
                >{loadingMore ? 'Loading…' : 'Load more'}</button>
              ) : null}
            </div>
          </div>
        )}

         {tab === "projects" && (
          <div>
            <div className="mb-3 text-sm opacity-70">Your projects</div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {projects.map((p) => (
                 <a key={p.id} className="rounded border p-2 cursor-pointer block" href={`/social-twin?projectId=${encodeURIComponent(p.id)}`}>
                  <div className="group aspect-video overflow-hidden rounded border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={(p.thumbnail_url && p.thumbnail_url.startsWith('http')) ? p.thumbnail_url : (p.thumbnail_url || "/placeholder.png")} alt={p.title} className="h-full w-full origin-center object-cover transition-transform duration-200 group-hover:scale-[1.12]" />
                  </div>
                  <div className="mt-2 truncate text-sm" title={p.title}>{p.title}</div>
                  <div className="text-[10px] opacity-60">{new Date(p.updated_at || p.created_at).toLocaleString()}</div>
                </a>
              ))}
              {projects.length === 0 ? (
                <div className="opacity-60">
                  No projects yet. After arranging items on the grid, click Save Project (or type "save project" in chat), then refresh this tab.
                </div>
              ) : null}
            </div>
          </div>
        )}

        {tab === "character" && (
          <div className="opacity-70">Character settings coming soon.</div>
        )}

        {tab === "studio" && (
          <div className="opacity-70">Studio tools coming soon.</div>
        )}
      </section>
    </main>
    {/* Folder modal is outside main but inside component root */}
    <FolderModal
      isOpen={folderModalOpen}
      onClose={()=> { setFolderModalOpen(false); setPendingMedia(null); }}
      userId={(typeof window!=='undefined' && (window as any)?.Clerk?.user?.id) || ''}
      title="Add to project"
      onConfirm={async (folderId)=>{
        if (!pendingMedia) return;
        await fetch(`/api/social-twin/folders/${folderId}/items`, {
          method:'POST', headers:{ 'Content-Type':'application/json', 'X-User-Id': (typeof window!=='undefined' && (window as any)?.Clerk?.user?.id) || '' },
          body: JSON.stringify({ media_id: pendingMedia.id, media_url: pendingMedia.result_url || pendingMedia.display_url, type: pendingMedia.type, prompt: pendingMedia.prompt })
        });
      }}
    />

    {/* Viewer Modal */}
    {viewerMedia ? (
      <div className="fixed inset-0 z-[10040]" aria-modal>
        <div className="absolute inset-0 bg-black/70" onClick={()=> setViewerMedia(null)} />
        <div className="absolute left-1/2 top-10 w-[92vw] max-w-5xl -translate-x-1/2 rounded-2xl border border-white/10 bg-black p-3 shadow-2xl text-white">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs opacity-70">{new Date(viewerMedia.created_at || viewerMedia.createdAt || Date.now()).toLocaleString()}</div>
            <button className="rounded border border-white/20 px-2 py-1 text-xs" onClick={()=> setViewerMedia(null)}>Close</button>
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <div className="aspect-video w-full overflow-hidden rounded border border-white/10">
              {viewerMedia.type==='video' ? (
                <video src={proxied(viewerMedia.display_url || viewerMedia.result_url)} className="h-full w-full object-contain" controls />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={proxied(viewerMedia.display_url || viewerMedia.result_url)} alt={viewerMedia.prompt || 'media'} className="h-full w-full object-contain" />
              )}
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <div className="font-medium">Prompt</div>
              <div className="text-xs opacity-80 whitespace-pre-wrap">{viewerMedia.prompt || '-'}</div>
            </div>
          </div>
        </div>
      </div>
    ) : null}
  </>
  );
}

// (Removed duplicate server component export)
