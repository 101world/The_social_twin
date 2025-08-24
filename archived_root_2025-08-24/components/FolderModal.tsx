"use client";
import { useEffect, useState } from "react";

type Folder = { id: string; name: string; created_at?: string };

export default function FolderModal({
  isOpen,
  onClose,
  userId,
  onConfirm,
  dark,
  title = "Add to folder",
  showList = true,
}: {
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
  onConfirm: (folderId: string) => Promise<void> | void;
  dark?: boolean;
  title?: string;
  showList?: boolean;
}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [selected, setSelected] = useState<string>("");
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      setLoading(true);
      try {
        if (showList) {
          const r = await fetch("/api/social-twin/folders", { headers: { "X-User-Id": userId || "" } });
          const j = await r.json();
          const fs: Folder[] = j.folders || [];
          setFolders(fs);
          setSelected(fs[0]?.id || "");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, userId, showList]);

  async function createFolder() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await fetch("/api/social-twin/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": userId || "" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const j = await r.json();
      if (j?.id) {
        const nf = { id: j.id, name: newName.trim() } as Folder;
        setFolders((prev) => [nf, ...prev]);
        setSelected(j.id);
        setNewName("");
      }
    } finally {
      setCreating(false);
    }
  }

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[10050]" aria-modal>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`absolute left-1/2 top-20 w-[420px] -translate-x-1/2 rounded-xl border p-3 shadow-xl ${dark ? "bg-neutral-900 border-neutral-700 text-neutral-100" : "bg-white"}`}>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">{title}</div>
          <button className="rounded border px-2 py-1 text-xs" onClick={onClose}>Close</button>
        </div>
        {showList && (
          <div className="mb-3">
            <div className="mb-1 text-xs opacity-70">Choose project</div>
            <div className="max-h-48 overflow-auto rounded border p-2">
              {loading ? (
                <div className="text-xs opacity-60">Loading…</div>
              ) : folders.length === 0 ? (
                <div className="text-xs opacity-60">No projects yet</div>
              ) : (
                <div className="grid gap-1">
                  {folders.map((f) => (
                    <label key={f.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="radio" name="folder" checked={selected === f.id} onChange={() => setSelected(f.id)} />
                      <span>{f.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <div className="mb-3">
          <div className="mb-1 text-xs opacity-70">Or create new project</div>
          <div className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Project name" className={`flex-1 rounded border px-2 py-1 ${dark ? "bg-neutral-800 border-neutral-700" : ""}`} />
            <button disabled={creating || !newName.trim()} onClick={createFolder} className="rounded border px-2 py-1 text-sm">Create</button>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="rounded border px-3 py-1 text-sm" onClick={onClose}>Cancel</button>
          <button disabled={!selected} className="rounded bg-black px-3 py-1 text-sm text-white" onClick={async () => { if (!selected) return; await onConfirm(selected); onClose(); }}>Add to project</button>
        </div>
      </div>
    </div>
  );
}


