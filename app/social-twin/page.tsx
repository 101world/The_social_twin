"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FolderModal from "@/components/FolderModal";
import ProjectModal from "@/components/ProjectModal";
import GenerationsTab from "@/components/GenerationsTab";
import UserAnalyticsDashboard from "@/components/UserAnalyticsDashboard";
import { useAuth, useUser } from "@clerk/nextjs";

type ChatRole = "user" | "assistant" | "system" | "error";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  createdAt?: string;
  loading?: boolean;
  pendingType?: 'text' | 'image' | 'video';
  sourceImageUrl?: string;
  images?: string[];
};

type CanvasItem = {
  id: string;
  type: 'image' | 'video' | 'text' | 'operator';
  url?: string;
  text?: string;
  fontIdx?: number;
  fontScale?: number; // relative text scale; 1 = 1rem, default 3.2
  x: number;
  y: number;
  w: number;
  h: number;
  operatorKind?: 'compile' | 'export-pdf' | 'publish';
  order?: number; // insertion sequence for fallback ordering
};

type Edge = {
  id: string;
  fromId: string;
  fromPort: 'male' | 'female';
  toId: string;
  toPort: 'male' | 'female';
  transitionMs?: number;
  imageDurationSec?: number;
};

type Mode = "text" | "image" | "image-modify" | "video";

const LOCAL_KEYS = {
  text: "runpod_text_url",
  image: "runpod_image_url",
  imageModify: "runpod_image_modify_url",
  video: "runpod_video_url", // default video (LTXV)
  videoWan: "runpod_video_wan_url",
  videoKling: "runpod_video_kling_url",
  loraName: "runpod_lora_name",
  loraScale: "runpod_lora_scale",
  batchSize: "runpod_batch_size",
  aspectRatio: "runpod_aspect_ratio",
};

function generateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export default function SocialTwinPage() {
  const router = useRouter();
  const { userId } = useAuth();
  const { user } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("text");
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [textUrl, setTextUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageModifyUrl, setImageModifyUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoWanUrl, setVideoWanUrl] = useState("");
  const [videoKlingUrl, setVideoKlingUrl] = useState("");
  const [loraName, setLoraName] = useState("");
  const [loraScale, setLoraScale] = useState<number | "">("");
  const [batchSize, setBatchSize] = useState<number | "">("");
  const [aspectRatio, setAspectRatio] = useState<string>("");
  const [textProvider, setTextProvider] = useState<'social'|'openai'|'deepseek'>('social');
  const LORA_CHOICES = ["None", "Custom..."];
  const [availableLoras, setAvailableLoras] = useState<Array<{name:string;filename:string;type?:string}>>([]);
  const [lorasLoading, setLorasLoading] = useState<boolean>(false);
  const BATCH_CHOICES = [1, 2, 4, 8];
  const AR_CHOICES = ["1:1", "3:2", "4:3", "16:9", "9:16", "2:3"];
  const [attached, setAttached] = useState<{ name: string; type: string; dataUrl: string } | null>(null);
  const [showBin, setShowBin] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [topics, setTopics] = useState<{id:string;title:string}[]>([]);
  const [binItems, setBinItems] = useState<any[]>([]);
  const [binCursor, setBinCursor] = useState<string | null>(null);
  const [currentTopicId, setCurrentTopicId] = useState<string | null>(null);
  const [targetScrollTs, setTargetScrollTs] = useState<string | null>(null);
  // Removed legacy pinned grid overlay in favor of main canvas-only flow
  const [gridEnabled, setGridEnabled] = useState<boolean>(false);
  const [gridLinesOn, setGridLinesOn] = useState<boolean>(true);
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([]);
  const [chatCollapsed, setChatCollapsed] = useState<boolean>(false);
  const [gridPan, setGridPan] = useState<{x:number;y:number}>({ x: 0, y: 0 });
  const gridSectionRef = useRef<HTMLElement | null>(null);
  const [gridScale, setGridScale] = useState<number>(1);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [linking, setLinking] = useState<{ id: string; port: 'male' | 'female' } | null>(null);
  const [linkPos, setLinkPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [linkStartScreen, setLinkStartScreen] = useState<{ x: number; y: number } | null>(null);
  const [linkAnim, setLinkAnim] = useState(0);
  const [hoverPort, setHoverPort] = useState<{ id: string; port: 'male' | 'female' } | null>(null);
  const [simpleMode, setSimpleMode] = useState<boolean>(true); // Start in Normal mode by default
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ open: boolean; x: number; y: number; targetId: string | null }>({ open: false, x: 0, y: 0, targetId: null });
  const [operatorMenu, setOperatorMenu] = useState<{ open: boolean; x: number; y: number; targetId: string | null }>({ open: false, x: 0, y: 0, targetId: null });
  const [edgeMenu, setEdgeMenu] = useState<{ open: boolean; x: number; y: number; edgeId: string | null }>({ open: false, x: 0, y: 0, edgeId: null });
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreatePos, setQuickCreatePos] = useState<{ x: number; y: number }>({ x: 24, y: 80 });
  const quickCreateDragRef = useRef<{ dragging: boolean; offX: number; offY: number } | null>(null);
  const [showSaveProject, setShowSaveProject] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectTitle, setCurrentProjectTitle] = useState<string | null>(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const folderModalPayload = useRef<{ url: string; type: 'image'|'video'; prompt?: string }|null>(null);
  const [viewer, setViewer] = useState<{ open: boolean; src: string; ref?: string; gallery?: string[] }>({ open: false, src: '' });
  // Compile modal state
  const [compileOpen, setCompileOpen] = useState<boolean>(false);
  const [compileChain, setCompileChain] = useState<Array<{ url:string; type:'video' }>>([]);
  const [compileOriginId, setCompileOriginId] = useState<string | null>(null);
  const [compileAR, setCompileAR] = useState<'16:9'|'1:1'|'9:16'>('16:9');
  const [compileAudio, setCompileAudio] = useState<string>('');
  // Compose (PDF/PPT) modal
  const [composeOpen, setComposeOpen] = useState<boolean>(false);
  const [composeSize, setComposeSize] = useState<'A4P'|'A4L'|'16:9'>('A4P');
  const [composePages, setComposePages] = useState<Array<{ images: Array<{ url:string }>; texts: Array<{ content:string }> }>>([]);
  const [composeOriginId, setComposeOriginId] = useState<string | null>(null);
  const [imgTab, setImgTab] = useState<'effects'|'character'>('effects');
  const [effectsOn, setEffectsOn] = useState<boolean>(false);
  const [characterOn, setCharacterOn] = useState<boolean>(false);
  const [cfgScale, setCfgScale] = useState<number | ''>('');
  const [guidance, setGuidance] = useState<number | ''>('');
  const [steps, setSteps] = useState<number | ''>('');
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);
  const [videoModel, setVideoModel] = useState<'ltxv'|'kling'|'wan'>('ltxv');
  const [activeTab, setActiveTab] = useState<'chat' | 'generations' | 'analytics'>('chat');
  const [generationCost, setGenerationCost] = useState<number>(0);
  const [canAffordGeneration, setCanAffordGeneration] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  // Load dynamic LoRAs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLorasLoading(true);
        const r = await fetch('/api/runpod/discover-loras', { cache: 'no-store' }).catch(() => null as any);
        const j = r ? await r.json().catch(() => null) : null;
        if (!cancelled && j && Array.isArray(j.loras)) setAvailableLoras(j.loras);
      } catch {}
      setLorasLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Mobile detection effect
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    checkMobile(); // Initial check
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // expose hoverPort setter for port buttons (simple shared state approach)
  useEffect(() => {
    (window as any).__setHoverPort = setHoverPort;
    (window as any).__setGridMenu = setMenu;
    (window as any).__setEditingTextId = (id: string | null) => setEditingTextId(id);
    return () => { delete (window as any).__setHoverPort; };
  }, []);

  // Ensure the preview line follows the cursor even while dragging over items
  useEffect(() => {
    if (!linking) return;
    const handleMove = (e: MouseEvent) => {
      setLinkPos({ x: e.clientX, y: e.clientY });
    };
    const handleUp = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest && target.closest('.port')) {
        // Let the port's onMouseUp handle finalizing the link
        return;
      }
      // Otherwise, cancel the link preview
      setLinking((cur) => (cur ? null : cur));
    };
    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('mouseup', handleUp);
    let rafId: number | null = null;
    const tick = () => { setLinkAnim((v) => (v + 1) % 10000); rafId = requestAnimationFrame(tick); };
    rafId = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [linking]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  // Load a project if provided via query param
  useEffect(()=>{
    try {
      const url = new URL(location.href);
      const pid = url.searchParams.get('projectId');
      if (!pid) return;
      // Force Pro Mode when opening a project
      setSimpleMode(false);
      (async()=>{
        const r = await fetch(`/api/social-twin/projects/${encodeURIComponent(pid)}`, { headers: { 'X-User-Id': userId || '' }}).catch(()=>null as any);
        const j = r ? await r.json().catch(()=>null) : null;
        const data = j?.project?.data;
        if (data && typeof data === 'object') {
          setCanvasItems(Array.isArray(data.items)? data.items : []);
          setEdges(Array.isArray(data.edges)? data.edges : []);
          if (data.pan) setGridPan(data.pan);
          if (typeof data.scale === 'number') setGridScale(data.scale);
          setGridEnabled(true);
        }
        if (j?.project?.id) setCurrentProjectId(j.project.id);
        if (j?.project?.title) setCurrentProjectTitle(j.project.title);
      })();
    } catch {}
  }, [userId]);

  async function saveCurrentProject(optionalTitle?: string) {
    try {
      const signedInUserId = userId || (typeof window!=='undefined' ? (window as any)?.Clerk?.user?.id : '');
      if (!signedInUserId) {
        alert('Please sign in to save projects.');
        return;
      }
      const payload = { items: canvasItems, edges, pan: gridPan, scale: gridScale };
      const first = canvasItems.find(i=> i.type!=='text');
      let thumbnailUrl = first?.url;
      // If using signed URLs from storage, persist the storage path reference when possible
      if (thumbnailUrl && thumbnailUrl.startsWith('/api/social-twin/proxy?url=')) {
        try { thumbnailUrl = decodeURIComponent(thumbnailUrl.split('=')[1]); } catch {}
      }
      const res = await fetch('/api/social-twin/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Id': signedInUserId },
        body: JSON.stringify({ title: optionalTitle || `Project ${new Date().toLocaleString()}`, data: payload, thumbnailUrl })
      });
      const j = await res.json().catch(()=> ({} as any));
      if (!res.ok || !j?.id) {
        console.error('Failed to save project', j);
        alert(`Failed to save project: ${j?.error || res.status}`);
        return;
      }
      setShowSaveProject(false);
      setProjectModalOpen(false);
      try { router.push('/studio?tab=projects'); } catch {}
    } catch (e: any) {
      console.error(e);
      alert(`Failed to save project: ${e?.message || 'Unknown error'}`);
    }
  }

  async function updateExistingProject() {
    try {
      const signedInUserId = userId || (typeof window!=='undefined' ? (window as any)?.Clerk?.user?.id : '');
      if (!signedInUserId) { alert('Please sign in to save projects.'); return; }
      if (!currentProjectId) { alert('No project is currently open.'); return; }
      const payload = { items: canvasItems, edges, pan: gridPan, scale: gridScale };
      const first = canvasItems.find(i=> i.type!=='text');
      let thumbnailUrl = first?.url;
      if (thumbnailUrl && thumbnailUrl.startsWith('/api/social-twin/proxy?url=')) {
        try { thumbnailUrl = decodeURIComponent(thumbnailUrl.split('=')[1]); } catch {}
      }
      const res = await fetch('/api/social-twin/projects', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-User-Id': signedInUserId },
        body: JSON.stringify({ id: currentProjectId, data: payload, thumbnailUrl })
      });
      const j = await res.json().catch(()=> ({} as any));
      if (!res.ok) { console.error('Failed to update project', j); alert(`Failed to update project: ${j?.error || res.status}`); return; }
      setShowSaveProject(false);
      setProjectModalOpen(false);
      alert('Project updated.');
    } catch (e:any) {
      console.error(e); alert(`Failed to update project: ${e?.message || 'Unknown error'}`);
    }
  }

  function getDisplayUrl(raw?: string | null): string | undefined {
    if (!raw) return undefined;
    try {
      if (typeof window !== 'undefined' && raw.startsWith('http') && !raw.startsWith(location.origin)) {
        return `/api/social-twin/proxy?url=${encodeURIComponent(raw)}`;
      }
    } catch {}
    return raw;
  }

  function getRawUrl(display?: string | null): string | undefined {
    if (!display) return undefined;
    try {
      const m = /^\/api\/social-twin\/proxy\?url=(.*)$/i.exec(display);
      if (m) return decodeURIComponent(m[1]);
    } catch {}
    return display;
  }

  // Walk upstream (male -> female) chain ending at a node and collect media in exact order
  function getUpstreamMediaChain(nodeId: string): Array<{ id:string; type:'image'|'video'; url:string }> {
    const visited = new Set<string>();
    function walk(id: string): Array<{ id:string; type:'image'|'video'; url:string }> {
      if (visited.has(id)) return [];
      visited.add(id);
      const incoming = edges.filter(e=> e.toId === id);
      const list: Array<{ id:string; type:'image'|'video'; url:string }> = [];
      for (const ed of incoming) {
        list.push(...walk(ed.fromId));
        const n = canvasItems.find(i=> i.id===ed.fromId);
        if (n && (n.type==='image' || n.type==='video') && (n as any).url) {
          list.push({ id:n.id, type:n.type, url:(n as any).url });
        }
      }
      return list;
    }
    return walk(nodeId);
  }

  // Walk forward (male of current -> female of next) from a starting node and collect videos in order
  function getForwardVideoChain(startId: string): Array<{ id:string; type:'video'; url:string }> {
    const chain: Array<{ id:string; type:'video'; url:string }> = [];
    const seen = new Set<string>();
    let current: string | null = startId;
    while (current && !seen.has(current)) {
      seen.add(current);
      const node = canvasItems.find(i=> i.id===current);
      if (node && node.type==='video' && (node as any).url) {
        chain.push({ id: node.id, type:'video', url:(node as any).url });
      }
      const nextEdge = edges.find(e=> e.fromId===current && e.fromPort==='male');
      current = nextEdge ? nextEdge.toId : null;
      if (current && canvasItems.find(i=> i.id===current)?.type==='operator') {
        // stop at operator
        break;
      }
    }
    return chain;
  }

  function openCompileModalFromNode(nodeId: string) {
    const upstream = getUpstreamMediaChain(nodeId).filter(i=> i.type==='video');
    const forward = upstream.length ? getForwardVideoChain(upstream[0].id) : [];
    const chain = (forward.length ? forward : upstream).map(i=> ({ url: getRawUrl(i.url) || i.url, type: 'video' as const }));
    setCompileChain(chain);
    setCompileOriginId(nodeId);
    setCompileOpen(true);
  }

  // Collect images and texts in chain order and group into pages: image starts a page, following texts attach as captions
  function buildPagesFromNode(nodeId: string): Array<{ images:Array<{url:string}>; texts:Array<{content:string}> }> {
    // upstream all nodes in order (images, text)
    const visited = new Set<string>();
    const order: Array<{ type:'image'|'text'|'video'|'operator'; id:string; url?:string; text?:string }> = [];
    function walk(id: string) {
      if (visited.has(id)) return; visited.add(id);
      const incoming = edges.filter(e=> e.toId===id);
      for (const ed of incoming) {
        walk(ed.fromId);
        const node = canvasItems.find(i=> i.id===ed.fromId);
        if (!node) continue;
        if (node.type==='image' && (node as any).url) order.push({ type:'image', id: node.id, url: (node as any).url });
        else if (node.type==='text' && (node as any).text) order.push({ type:'text', id: node.id, text: (node as any).text });
      }
    }
    walk(nodeId);
    const pages: Array<{ images:Array<{url:string}>; texts:Array<{content:string}> }> = [];
    let current: { images:Array<{url:string}>; texts:Array<{content:string}> } | null = null;
    for (const it of order) {
      if (it.type==='image') { current = { images:[{ url: it.url! }], texts:[] }; pages.push(current); }
      else if (it.type==='text') { if (!current) { current = { images:[], texts:[] }; pages.push(current); } current.texts.push({ content: it.text! }); }
    }
    return pages.length ? pages : [];
  }

  function openComposeModalFromNode(nodeId: string) {
    const pages = buildPagesFromNode(nodeId);
    setComposePages(pages);
    setComposeOriginId(nodeId);
    setComposeOpen(true);
  }

  async function runExportPDF() {
    if (!composePages.length) { setComposeOpen(false); return; }
    try {
      const imgs = composePages.flatMap(p=> p.images.map(i=> i.url));
      const r = await fetch('/api/social-twin/export-pdf', { method:'POST', headers:{ 'Content-Type':'application/json', 'X-User-Id': userId || '' }, body: JSON.stringify({ images: imgs, topicId: currentTopicId || null, fileName: 'export.pdf' }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setMessages(prev=> [...prev, { id: generateId(), role:'assistant', content:'Exported PDF', imageUrl: undefined, createdAt: new Date().toISOString() }]);
      setComposeOpen(false);
    } catch (e:any) {
      setMessages(prev=> [...prev, { id: generateId(), role:'error', content:`PDF export failed: ${e?.message || 'Unknown error'}` }]);
    }
  }

  async function runExportPPT() {
    if (!composePages.length) { setComposeOpen(false); return; }
    try {
      const r = await fetch('/api/social-twin/export-ppt', { method:'POST', headers:{ 'Content-Type':'application/json', 'X-User-Id': userId || '' }, body: JSON.stringify({ pages: composePages, pageSize: composeSize, topicId: currentTopicId || null }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setMessages(prev=> [...prev, { id: generateId(), role:'assistant', content:'Exported PPTX', imageUrl: undefined, createdAt: new Date().toISOString() }]);
      setComposeOpen(false);
    } catch (e:any) {
      setMessages(prev=> [...prev, { id: generateId(), role:'error', content:`PPT export failed: ${e?.message || 'Unknown error'}` }]);
    }
  }

  async function runCompile(chain: Array<{ url:string; type:'video' }>) {
    if (!chain.length) {
      setMessages(prev=> [...prev, { id: generateId(), role:'assistant', content:'No videos to compile.', createdAt: new Date().toISOString() }]);
      return;
    }
    setCompileOpen(false);
    const tempId = generateId();
    setCanvasItems(prev=> [...prev, { id: tempId, type:'video', url: undefined as any, x: 40 + (canvasItems.length % 5) * 40, y: 40 + (canvasItems.length % 5) * 30, w: 360, h: 240, loading:true } as any]);
    try {
      const r = await fetch('/api/social-twin/compile', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' },
        body: JSON.stringify({ inputs: chain, fps: 24, topicId: currentTopicId || null, ar: compileAR, audioUrl: compileAudio || undefined })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ? `${j.error} ${j?.details?`- ${JSON.stringify(j.details)}`:''}` : `HTTP ${r.status}`);
      const url = j.url as string;
      setMessages(prev=> [...prev, { id: generateId(), role:'assistant', content:'Compiled video', videoUrl: url, createdAt: new Date().toISOString() }]);
      setCanvasItems(prev=> prev.map(it=> it.id===tempId ? { ...it, url, loading:false } : it));
    } catch (e:any) {
      setCanvasItems(prev=> prev.filter(it=> !(it as any).loading));
      setMessages(prev=> [...prev, { id: generateId(), role:'error', content:`Compile failed: ${e?.message || 'Unknown error'}` }]);
    }
  }

  useEffect(() => {
    // Load RunPod endpoints from localStorage on first render [[memory:5857110]]
    const DEFAULT_RP = "https://94ek2f3pah7ure-3001.proxy.runpod.net/";
    setTextUrl(localStorage.getItem(LOCAL_KEYS.text) || "");
    const lsImg = localStorage.getItem(LOCAL_KEYS.image);
    const lsImgMod = localStorage.getItem(LOCAL_KEYS.imageModify);
    setImageUrl(lsImg || DEFAULT_RP);
    setImageModifyUrl(lsImgMod || DEFAULT_RP);
    if (!lsImg) localStorage.setItem(LOCAL_KEYS.image, DEFAULT_RP);
    if (!lsImgMod) localStorage.setItem(LOCAL_KEYS.imageModify, DEFAULT_RP);
    setVideoUrl(localStorage.getItem(LOCAL_KEYS.video) || "");
    setVideoWanUrl(localStorage.getItem(LOCAL_KEYS.videoWan) || "");
    setVideoKlingUrl(localStorage.getItem(LOCAL_KEYS.videoKling) || "");
    setLoraName(localStorage.getItem(LOCAL_KEYS.loraName) || "");
    const lsScale = localStorage.getItem(LOCAL_KEYS.loraScale);
    setLoraScale(lsScale ? Number(lsScale) : "");
    const lsBatch = localStorage.getItem(LOCAL_KEYS.batchSize);
    setBatchSize(lsBatch ? Number(lsBatch) : "");
    setAspectRatio(localStorage.getItem(LOCAL_KEYS.aspectRatio) || "");
    const dm = localStorage.getItem('social_twin_dark') === '1';
    setDarkMode(dm);
  }, []);

  useEffect(() => {
    // On initial load, jump to bottom without a long smooth scroll
    if ((messages.length || 0) > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [messages.length]);

  // Auto-load unified chat feed on mount so user sees their entire history without topic navigation
  useEffect(() => {
    if (userId === undefined) return; // wait for auth to resolve
    (async () => {
      try {
        const r = await fetch('/api/social-twin/feed?limit=50', { headers: { 'X-User-Id': userId || '' } });
        if (!r.ok) return;
        const j = await r.json();
        const items = (j.items || []) as Array<{ id:string; role:ChatRole; content:string; imageUrl?:string; videoUrl?:string; createdAt?:string }>;
        setMessages(items.map((it) => ({ id: it.id, role: it.role, content: it.content, imageUrl: it.imageUrl, videoUrl: it.videoUrl, createdAt: it.createdAt })));
        setFeedCursor(j.nextCursor || null);
      } catch {}
    })();
  }, [userId]);

  // Infinite scroll: load older on scroll top
  const listRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = async () => {
      if (el.scrollTop <= 0 && !isLoadingMore && feedCursor) {
        setIsLoadingMore(true);
        try {
          const r = await fetch(`/api/social-twin/feed?limit=50&before=${encodeURIComponent(feedCursor)}`, { headers: { 'X-User-Id': userId || '' } });
          const j = await r.json();
          const items = (j.items || []) as Array<{ id:string; role:ChatRole; content:string; imageUrl?:string; videoUrl?:string; createdAt?:string }>;
          if (items.length) {
            setMessages((prev)=> [...items.map((it)=>({ id: it.id, role: it.role, content: it.content, imageUrl: it.imageUrl, videoUrl: it.videoUrl, createdAt: it.createdAt })), ...prev]);
            setFeedCursor(j.nextCursor || null);
          } else {
            setFeedCursor(null);
          }
        } catch {}
        setIsLoadingMore(false);
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => { el.removeEventListener('scroll', onScroll); };
  }, [feedCursor, isLoadingMore]);

  // Mobile keyboard-safe: keep viewport stable and composer above the keyboard
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const docEl = document.documentElement;
    const updateVars = () => {
      const vv = window.visualViewport;
      const vh = (vv?.height ?? window.innerHeight) * 0.01;
      docEl.style.setProperty('--vh', `${vh}px`);
      const kb = vv ? Math.max(0, window.innerHeight - vv.height - (vv.offsetTop || 0)) : 0;
      docEl.style.setProperty('--kb-offset', `${kb}px`);
      const h = composerRef.current?.offsetHeight ?? 64;
      docEl.style.setProperty('--composer-h', `${h}px`);
    };
    updateVars();
    const onResize = () => updateVars();
    const onScroll = () => updateVars();
    window.visualViewport?.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('scroll', onScroll);
    window.addEventListener('resize', onResize);
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(() => updateVars());
      if (composerRef.current) ro.observe(composerRef.current);
    } catch {}
    return () => {
      window.visualViewport?.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      try { ro?.disconnect(); } catch {}
    };
  }, []);

  // After messages load, if targetScrollTs set, scroll to nearest message
  useEffect(() => {
    if (!targetScrollTs || messages.length === 0) return;
    const ts = new Date(targetScrollTs).getTime();
    let bestId: string | null = null;
    let bestDelta = Number.MAX_VALUE;
    for (const m of messages) {
      const mt = m.createdAt ? new Date(m.createdAt).getTime() : 0;
      const d = Math.abs(mt - ts);
      if (mt && d < bestDelta) { bestDelta = d; bestId = m.id; }
    }
    if (bestId) {
      const el = document.getElementById(`msg-${bestId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block:'center' });
    }
    setTargetScrollTs(null);
  }, [messages, targetScrollTs]);

  const activeEndpoint = useMemo(() => {
    switch (mode) {
      case "text":
        return textUrl;
      case "image":
        return imageUrl;
      case "image-modify":
        return imageModifyUrl;
      case "video":
        if (videoModel==='wan') return videoWanUrl || videoUrl;
        if (videoModel==='kling') return videoKlingUrl || videoUrl;
        return videoUrl;
      default:
        return "";
    }
  }, [mode, textUrl, imageUrl, imageModifyUrl, videoUrl, videoWanUrl, videoKlingUrl, videoModel]);

  function saveSettings() {
    localStorage.setItem(LOCAL_KEYS.text, textUrl);
    localStorage.setItem(LOCAL_KEYS.image, imageUrl);
    localStorage.setItem(LOCAL_KEYS.imageModify, imageModifyUrl);
    localStorage.setItem(LOCAL_KEYS.video, videoUrl);
    localStorage.setItem(LOCAL_KEYS.videoWan, videoWanUrl);
    localStorage.setItem(LOCAL_KEYS.videoKling, videoKlingUrl);
    localStorage.setItem(LOCAL_KEYS.loraName, loraName);
    if (loraScale !== "") localStorage.setItem(LOCAL_KEYS.loraScale, String(loraScale));
    if (batchSize !== "") localStorage.setItem(LOCAL_KEYS.batchSize, String(batchSize));
    localStorage.setItem(LOCAL_KEYS.aspectRatio, aspectRatio);
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    // Chat commands: save project / create project <title>
    const lower = trimmed.toLowerCase();
    if (lower === 'save project' || lower === 'create project') {
      if (currentProjectId) await updateExistingProject(); else await saveCurrentProject();
      setMessages((prev)=> [...prev, { id: generateId(), role: 'assistant', content: 'Project saved.' }]);
      setInput('');
      return;
    }
    if (lower.startsWith('create project ')) {
      const title = trimmed.slice('create project '.length).trim();
      await saveCurrentProject(title || undefined);
      setMessages((prev)=> [...prev, { id: generateId(), role: 'assistant', content: `Project "${title || 'Untitled'}" saved.` }]);
      setInput('');
      return;
    }
    // Enforce requirements for image-to-video: must have image attachment and non-empty text
    if (mode === 'video' && attached && !attached.type.startsWith('image')) {
      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: 'error', content: 'Image-to-video requires an image attachment. Remove non-image or attach an image.' },
      ]);
      return;
    }
    if (mode === 'video' && attached && attached.type.startsWith('image') && trimmed.length === 0) {
      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: 'error', content: 'Please enter text along with the image for image-to-video.' },
      ]);
      return;
    }
    // Require an image attachment for modify mode
    if (mode === 'image-modify' && !attached) {
      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: 'error', content: 'Image Modify requires an image attachment.' },
      ]);
      return;
    }
    const userMsg: ChatMessage = { id: generateId(), role: "user", content: trimmed, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    if (!activeEndpoint) {
      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: "error", content: `No endpoint configured for '${mode}'. Open settings to set a URL.` },
      ]);
      return;
    }

    try {
      // Route all generations through our enhanced tracking API
      const tempId = generateId();
      const placeholder: ChatMessage = {
        id: tempId,
        role: "assistant",
        content: (mode==='text') ? 'Generating…' : ((mode==='image' || mode==='image-modify') ? 'Generating image…' : (mode==='video' ? 'Generating video…' : 'Working…')),
        loading: true,
        pendingType: ((mode==='image' || mode==='image-modify') ? 'image' : (mode==='video' ? 'video' : 'text')),
        createdAt: new Date().toISOString(),
      };
      setMessages((prev)=> [...prev, placeholder]);
      
      // Use the new tracking API endpoint
      const res = await fetch("/api/generate-with-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": userId || "" },
        body: JSON.stringify({
          prompt: trimmed,
          mode,
          runpodUrl: activeEndpoint,
          provider: textProvider,
          lora: loraName || undefined,
          lora_scale: typeof loraScale === 'number' ? loraScale : undefined,
          batch_size: typeof batchSize === 'number' ? batchSize : undefined,
          aspect_ratio: aspectRatio || undefined,
              cfg: typeof cfgScale === 'number' ? cfgScale : undefined,
              guidance: typeof guidance === 'number' ? guidance : undefined,
              steps: typeof steps === 'number' ? steps : undefined,
              video_model: mode==='video' ? videoModel : undefined,
              video_type: mode==='video' ? (attached?.dataUrl ? 'image' : 'text') : undefined,
          userId: userId || undefined,
          attachment: attached || undefined,
          imageUrl: (mode==='image-modify' && attached?.dataUrl) ? attached.dataUrl : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const payload = await res.json().catch(() => ({} as any));
      const data = payload.runpod ?? payload; // our API returns { ok, urls, runpod }
      const urls: string[] = payload.urls || (data?.urls || []);
      const batchImages: string[] = payload.images || (data?.images || []);
      const batchVideos: string[] = payload.videos || (data?.videos || []);
      const aiText: string | undefined = data?.text ?? data?.output ?? data?.message;
      const rawFromData: string | undefined = (data?.imageUrl ?? data?.image ?? data?.url) || undefined;
      const isVideoLike = (u?: string) => Boolean(u && /\.(mp4|webm)(\?|$)/i.test(u));
      const aiVideoFromData = isVideoLike(rawFromData) ? rawFromData : undefined;
      const aiImageFromData = !isVideoLike(rawFromData) ? rawFromData : undefined;
      const aiImage: string | undefined = aiImageFromData || urls.find(u=>!isVideoLike(u));
      const aiVideo: string | undefined = (data?.videoUrl ?? data?.video ?? aiVideoFromData);
      // If the backend mislabels video under images (as in SaveVideo images array), fix it here
      const remappedFromImages = (!aiVideo && batchImages && batchImages.length && batchImages[0].match(/\.(mp4|webm)(\?|$)/i)) ? batchImages[0] : undefined;
      const firstVideo = (batchVideos && batchVideos.length ? batchVideos[0] : undefined);

      // Replace placeholder with final
      setMessages((prev)=> prev.map(m=> m.id===tempId ? ({
        ...m,
        content: aiText || (aiImage ? 'Generated image' : (aiVideo || firstVideo || remappedFromImages) ? 'Generated video' : 'Done.'),
        imageUrl: aiImage,
        videoUrl: aiVideo || firstVideo || remappedFromImages,
        images: (batchImages && batchImages.length ? batchImages : undefined),
        sourceImageUrl: (mode==='image-modify' && attached?.dataUrl) ? attached.dataUrl : undefined,
        loading: false,
      }) : m));
      // If multiple images, also add a thumb strip to canvas
      const gallery = (batchVideos && batchVideos.length ? batchVideos : (batchImages && batchImages.length ? batchImages : urls));
      if (gallery && gallery.length > 1) {
        gallery.forEach((u) => {
          const isVideo = typeof u === 'string' && /\.(mp4|webm)(\?|$)/i.test(u);
          addToCanvas(u, isVideo ? 'video' : 'image');
        });
      }
      setAttached(null);
      // Auto add generated media to canvas grid if present
      const final = { imageUrl: aiImage, videoUrl: (aiVideo || firstVideo) };
      if (final.imageUrl || final.videoUrl) {
        const url = final.imageUrl || final.videoUrl!;
        const type = final.imageUrl ? 'image' : 'video';
        addToCanvas(url, type);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: "error", content: `Request failed: ${err?.message ?? "Unknown error"}` },
      ]);
    }
  }

  function addToCanvas(url: string, type: 'image' | 'video') {
    const item: CanvasItem = {
      id: generateId(),
      url: getDisplayUrl(url) || url,
      type,
      x: 40 + (canvasItems.length % 5) * 40,
      y: 40 + (canvasItems.length % 5) * 30,
      w: 360,
      h: 240,
      order: Date.now(),
    };
    setCanvasItems((prev) => [...prev, item]);
    setGridEnabled(true);
    setShowSaveProject(true);
  }

  function getIncomingMedia(operatorId: string): Array<{ id:string; type:'image'|'video'; url:string; transitionMs?: number; imageDurationSec?: number; x:number; y:number }> {
    const visited = new Set<string>();
    type MediaWithMeta = { id:string; type:'image'|'video'; url:string; transitionMs?: number; imageDurationSec?: number; x:number; y:number };
    function collect(nodeId: string): MediaWithMeta[] {
      if (visited.has(nodeId)) return [];
      visited.add(nodeId);
      const incoming = edges.filter(e=> e.toId === nodeId);
      // Order strictly by male→female connection chain; do not sort by XY
      return incoming.flatMap((ed)=> {
        const upstream = collect(ed.fromId);
        const node = canvasItems.find(i=> i.id===ed.fromId);
        const self: MediaWithMeta[] = (node && (node.type==='image' || node.type==='video') && (node as any).url)
          ? [{ id: node.id, type: node.type, url: (node as any).url, transitionMs: (ed as any).transitionMs, imageDurationSec: (ed as any).imageDurationSec, x: (node as any).x || 0, y: (node as any).y || 0 }]
          : [];
        return [...upstream, ...self];
      });
    }
    const result = collect(operatorId);
    // De-duplicate while preserving order
    const seen = new Set<string>();
    const dedup: MediaWithMeta[] = [];
    for (const it of result) { if (!seen.has(it.id)) { seen.add(it.id); dedup.push(it); } }
    return dedup;
  }

  async function executeOperator(operator: CanvasItem, manualInputs?: Array<{ url: string; type: 'image'|'video'; imageDurationSec?: number; transitionMs?: number }>) {
    if (operator.operatorKind === 'publish') {
      if (currentProjectId) {
        await updateExistingProject();
      } else {
        setProjectModalOpen(true);
      }
      return;
    }
    if (operator.operatorKind === 'compile') {
      const chainFromIncoming = getUpstreamMediaChain(operator.id).filter(i=> i.type==='video');
      const chainFromForward = chainFromIncoming.length ? getForwardVideoChain(chainFromIncoming[0].id) : [];
      const chain = chainFromForward.length ? chainFromForward : chainFromIncoming;
      const inputs = Array.isArray(manualInputs) && manualInputs.length ? manualInputs : chain;
      if (!inputs.length) {
        setMessages(prev=> [...prev, { id: generateId(), role:'assistant', content:'No videos connected to Compile. Link videos with the orange string into the Compile operator, or use the right-click Compile on the last video in the chain.', createdAt: new Date().toISOString() }]);
        return;
      }
      setCompileChain(inputs.map(i=> ({ url: getRawUrl(i.url) || i.url, type:'video' as const })));
      setCompileOpen(true);
      return;
    }
    if (operator.operatorKind === 'export-pdf') {
      const all = Array.isArray(manualInputs) && manualInputs.length ? manualInputs : getIncomingMedia(operator.id);
      const inputs = all.filter(i=> i.type==='image');
      if (!inputs.length) {
        setMessages(prev=> [...prev, { id: generateId(), role:'assistant', content:'No images connected to Export PDF.', createdAt: new Date().toISOString() }]);
        return;
      }
      try {
        // Server-side PDF export (also logs to Supabase and returns a signed URL)
        const r = await fetch('/api/social-twin/export-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' },
          body: JSON.stringify({ images: inputs.map(i=> getRawUrl(i.url) || i.url), topicId: currentTopicId || null, fileName: 'export.pdf' })
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        const url = j.url as string;
        setMessages(prev=> [...prev, { id: generateId(), role:'assistant', content:'Exported PDF', pdfUrl: url, createdAt: new Date().toISOString() }]);
      } catch (e:any) {
        setMessages(prev=> [...prev, { id: generateId(), role:'error', content:`Export failed: ${e?.message || 'Unknown error'}` }]);
      }
    }
  }

  function executeOperatorKind(op: CanvasItem, kind: 'compile'|'export-pdf'|'publish', manualInputs?: Array<{ url: string; type: 'image'|'video'; imageDurationSec?: number; transitionMs?: number }>) {
    const withKind = { ...op, operatorKind: kind } as CanvasItem;
    executeOperator(withKind, manualInputs);
  }

  // Build a smooth, wind-like path from an array of points using Catmull-Rom -> Bezier
  function buildSmoothPath(points: Array<{ x: number; y: number }>, tension = 1): string {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) * (tension / 6);
      const c1y = p1.y + (p2.y - p0.y) * (tension / 6);
      const c2x = p2.x - (p3.x - p1.x) * (tension / 6);
      const c2y = p2.y - (p3.y - p1.y) * (tension / 6);
      d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
    }
    return d;
  }

  function buildWindPathScreen(sx: number, sy: number, tx: number, ty: number, t: number, segments = 10, amp = 24): string {
    const dx = tx - sx; const dy = ty - sy; const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist; const uy = dy / dist; const nx = -uy; const ny = ux;
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= segments; i++) {
      const s = i / segments;
      const baseX = sx + dx * s;
      const baseY = sy + dy * s;
      const falloff = Math.sin(Math.PI * s); // stronger in the middle
      const offset = amp * falloff * (
        0.6 * Math.sin(t * 0.13 + s * 5.2) +
        0.4 * Math.cos(t * 0.19 + s * 8.3)
      );
      const along = (amp * 0.2) * falloff * Math.cos(t * 0.11 + s * 3.7);
      const px = baseX + nx * offset + ux * along;
      const py = baseY + ny * offset + uy * along;
      pts.push({ x: px, y: py });
    }
    return buildSmoothPath(pts, 1);
  }

  function buildWindPathLocal(fromX: number, fromY: number, toX: number, toY: number, t: number, segments = 8, amp = 16): string {
    // local (canvas) coordinates
    const dx = toX - fromX; const dy = toY - fromY; const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist; const uy = dy / dist; const nx = -uy; const ny = ux;
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= segments; i++) {
      const s = i / segments;
      const baseX = fromX + dx * s;
      const baseY = fromY + dy * s;
      const falloff = Math.sin(Math.PI * s);
      const offset = amp * falloff * (
        0.5 * Math.sin(t * 0.12 + s * 5.1) +
        0.5 * Math.cos(t * 0.17 + s * 7.7)
      );
      const along = (amp * 0.15) * falloff * Math.cos(t * 0.1 + s * 3.2);
      const px = baseX + nx * offset + ux * along;
      const py = baseY + ny * offset + uy * along;
      pts.push({ x: px, y: py });
    }
    return buildSmoothPath(pts, 1);
  }

  return (
    <main 
      className={`relative h-screen w-screen overflow-hidden ${darkMode ? 'bg-black text-neutral-100' : ''} touch-manipulation`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
  width: '100vw',
  height: 'calc(var(--vh, 1vh) * 100)',
        overflowY: 'hidden',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'none',
        touchAction: 'manipulation'
      }}
    >
      {/* Make header icons clickable on top in Normal mode */}
      {simpleMode ? <div className="pointer-events-none fixed inset-0 z-[10001]" /> : null}
      {/* Mode toggle - hide on mobile in pro mode when chat collapsed */}
      <button
        className={`fixed right-4 top-4 z-[10001] rounded-full px-3 py-1 text-xs shadow ${darkMode ? 'bg-neutral-900 border border-neutral-700 text-neutral-100' : 'bg-white'} ${!simpleMode && chatCollapsed ? 'hidden sm:block' : ''}`}
        onClick={()=> setSimpleMode(v=>!v)}
        title={simpleMode ? 'Switch to Pro Mode' : 'Switch to Normal Mode'}
      >
        {simpleMode ? 'Pro Mode' : 'Normal Mode'}
      </button>
      {simpleMode && !isMobile && (
        <button
          className={`fixed left-4 top-4 z-[10001] rounded-full px-3 py-1 text-xs shadow ${darkMode ? 'bg-neutral-900 border border-neutral-700 text-neutral-100' : 'bg-white'}`}
          onClick={()=> setSidebarOpen(v=>!v)}
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? 'Close' : 'Menu'}
        </button>
      )}
      {/* Chat panel docked right (collapsible) - mobile optimized */}
      <section
        className={`absolute ${simpleMode ? 'inset-0' : 'right-0 top-0 h-screen'} z-50 pointer-events-auto flex flex-col ${simpleMode ? '' : 'border-l backdrop-blur-sm transition-[width] duration-200'} ${darkMode ? (simpleMode ? 'bg-black/20' : 'bg-neutral-900 border-neutral-800') : (simpleMode ? 'bg-white' : 'bg-white/95')}`}
        style={simpleMode ? { left: sidebarOpen ? 240 : 0, transition: 'left 150ms ease' } : { 
          width: chatCollapsed ? 40 : isMobile ? '100vw' : '30vw', 
          minWidth: chatCollapsed ? 40 : isMobile ? '100vw' : 320, 
          maxWidth: chatCollapsed ? 40 : isMobile ? '100vw' : 520 
        }}
      >
        {/* Full-rail click target when collapsed */}
        {chatCollapsed ? (
          <button
            className="absolute inset-0 z-[1000] cursor-pointer bg-transparent"
            onClick={()=> setChatCollapsed(false)}
            aria-label="Expand chat"
            title="Expand chat"
          />
        ) : null}
        {/* Collapse handle (only in Pro mode) */}
        {!simpleMode && (
          <button
            className="absolute left-[-34px] top-1/2 z-50 -translate-y-1/2 rounded-full p-2 shadow bg-black hover:opacity-90"
            onClick={()=> setChatCollapsed(v=>!v)}
            title={chatCollapsed ? 'Expand chat' : 'Collapse chat'}
            aria-label={chatCollapsed ? 'Expand chat' : 'Collapse chat'}
          >
            {chatCollapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </button>
        )}
        <header className={`flex items-center justify-between gap-2 border-b p-3 ${darkMode ? 'border-neutral-800' : ''}`} style={{ display: (!simpleMode && chatCollapsed) ? 'none' : undefined }}>
          <h1 className="text-2xl font-bold">The Social Twin</h1>
          <div className="flex items-center gap-2">
            <button
              className={`cursor-pointer rounded border px-3 py-1 text-sm ${darkMode ? 'border-neutral-700 hover:bg-neutral-800' : 'hover:bg-gray-50'}`}
              onClick={() => setShowSettings((s) => !s)}
            >
              Settings
            </button>
            <button
              className={`cursor-pointer rounded border px-3 py-1 text-sm ${darkMode ? 'border-neutral-700 hover:bg-neutral-800' : 'hover:bg-gray-50'}`}
              onClick={() => { const v = !darkMode; setDarkMode(v); localStorage.setItem('social_twin_dark', v ? '1' : '0'); }}
            >
              {darkMode ? 'Light' : 'Dark'}
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className={`flex border-b ${darkMode ? 'border-neutral-800' : 'border-gray-200'}`} style={{ display: (!simpleMode && chatCollapsed) ? 'none' : undefined }}>
          {[
            { id: 'chat', label: 'Chat', icon: '💬' },
            { id: 'generations', label: 'Generations', icon: '🎨' },
            { id: 'analytics', label: 'Analytics', icon: '📊' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                activeTab === tab.id
                  ? darkMode
                    ? 'border-b-2 border-blue-500 bg-blue-900/20 text-blue-300'
                    : 'border-b-2 border-blue-500 bg-blue-50 text-blue-700'
                  : darkMode
                    ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {!chatCollapsed && showSettings && (
          <div className={`grid gap-2 border-b p-3 ${darkMode ? 'border-neutral-800' : ''}`}>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Text RunPod URL</label>
              <input
                className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400' : ''}`}
              placeholder="https://..."
              value={textUrl}
              onChange={(e) => setTextUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Ratio</label>
              <select
                className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
            >
              <option value="">Select</option>
              {AR_CHOICES.map((ar) => (
                <option key={ar} value={ar}>{ar}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Image RunPod URL</label>
              <input
                className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400' : ''}`}
              placeholder="https://..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Image Modify RunPod URL</label>
              <input
                className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400' : ''}`}
              placeholder="https://..."
              value={imageModifyUrl}
              onChange={(e) => setImageModifyUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Video RunPod URL</label>
              <input
                className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400' : ''}`}
              placeholder="https://..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">WAN Video RunPod URL</label>
              <input
                className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400' : ''}`}
              placeholder="https://..."
              value={videoWanUrl}
              onChange={(e) => setVideoWanUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Kling Video RunPod URL</label>
              <input
                className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400' : ''}`}
              placeholder="https://..."
              value={videoKlingUrl}
              onChange={(e) => setVideoKlingUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Character (LoRA)</label>
              <select
                className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
              value={LORA_CHOICES.includes(loraName) ? loraName : (loraName ? loraName : "Custom...")}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "None") setLoraName("");
                else if (v === "Custom...") setLoraName(loraName || "");
                else setLoraName(v);
              }}
            >
              {LORA_CHOICES.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
              {/* Dynamic LoRAs */}
              {availableLoras.map((lo) => (
                <option key={lo.filename} value={lo.filename}>{lo.name}{lo.type?` (${lo.type})`:''}</option>
              ))}
            </select>
              <input
                className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400' : ''}`}
              placeholder="custom lora filename (optional)"
              value={loraName}
              onChange={(e) => setLoraName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <label className="text-sm font-medium">LoRA Scale</label>
                <input
                  className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400' : ''}`}
                placeholder="0.0 - 1.0"
                type="number"
                step="0.01"
                value={loraScale}
                onChange={(e) => setLoraScale(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Batch Size</label>
                <select
                  className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
                value={batchSize === "" ? "" : String(batchSize)}
                onChange={(e) => setBatchSize(e.target.value === "" ? "" : Number(e.target.value))}
              >
                <option value="">Select</option>
                {BATCH_CHOICES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
                className={`cursor-pointer rounded px-3 py-2 ${darkMode ? 'bg-neutral-50 text-black' : 'bg-black text-white'}`}
              onClick={saveSettings}
            >
              Save
            </button>
            <button
                className={`cursor-pointer rounded border px-3 py-2 ${darkMode ? 'border-neutral-700 hover:bg-neutral-800' : ''}`}
              onClick={() => {
                setTextUrl("");
                setImageUrl("");
                setImageModifyUrl("");
                setVideoUrl("");
                saveSettings();
              }}
            >
              Clear
            </button>
          </div>
          </div>
        )}

        <div className={`flex min-h-0 flex-1 flex-col ${simpleMode ? 'items-stretch' : ''}`} style={{ display: (!simpleMode && chatCollapsed) ? 'none' : undefined }}>
          {/* Tab Content */}
          {activeTab === 'chat' && (
            <>
              <div 
                ref={listRef} 
                className={`flex-1 space-y-3 overflow-y-auto p-3 ${simpleMode ? 'max-w-2xl mx-auto w-full no-scrollbar' : ''}`}
                style={{
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehavior: 'contain',
                  touchAction: 'pan-y',
                  paddingBottom: 'calc(var(--composer-h, 64px) + env(safe-area-inset-bottom, 0px) + 8px)',
                  position: 'relative',
                  zIndex: 1
                }}
              >
                {messages.length === 0 ? (
                <div className={`text-sm text-gray-500 ${simpleMode ? 'flex h-full items-center justify-center' : ''}`}>
                  {simpleMode ? (
                    <div className="w-full max-w-2xl">
                      {/* Center prompt when empty in Normal Mode */}
                      <div className="mb-4 text-center text-lg opacity-70">What's on your mind today?</div>
                      <div className="rounded-lg border p-2">
                        <textarea
                          value={input}
                          onChange={(e)=> setInput(e.target.value)}
                          placeholder="Ask anything"
                          className={`h-12 w-full resize-none rounded-md border p-3 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
                          onKeyDown={(e)=>{ if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        />
                      </div>
                    </div>
                  ) : 'Start by entering a prompt below.'}
                </div>
              ) : (
                messages.map((m) => {
                  const isUser = m.role === 'user';
                  return (
                    <div key={m.id}>
                      <div id={`msg-${m.id}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl border px-3 py-2 ${isUser ? (darkMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-blue-600 text-white border-blue-600') : (darkMode ? 'bg-neutral-900 text-neutral-100 border-neutral-800' : 'bg-white text-black border-neutral-200')}`}
                             style={{ borderTopLeftRadius: isUser ? 16 : 4, borderTopRightRadius: isUser ? 4 : 16 }}>
                          <div className={`mb-1 flex items-center gap-2 text-[11px] ${isUser ? 'opacity-90' : (darkMode ? 'text-neutral-400' : 'text-gray-500')}`}>
                            <span className="font-semibold">{isUser ? (user?.fullName || 'You') : 'Assistant'}</span>
                          </div>
                          <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                          {m.loading && m.pendingType==='image' ? (
                            <div className="mt-2 h-40 w-full animate-pulse rounded-lg border bg-gradient-to-r from-white/5 to-white/0" />
                          ) : null}
                          {m.loading && m.pendingType==='video' ? (
                            <div className="mt-2 h-40 w-full animate-pulse rounded-lg border bg-gradient-to-r from-white/5 to-white/0" />
                          ) : null}
                          <div className={`mt-1 text-[10px] opacity-60 ${isUser ? 'text-white' : (darkMode ? 'text-neutral-400' : 'text-gray-500')}`}>
                            {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                          {/* Only render image preview when it is not a video URL */}
                          {m.imageUrl && !/\.(mp4|webm)(\?|$)/i.test(m.imageUrl) ? (
                            <div className="mt-2 group">
                              <img
                                alt="generated"
                                src={m.imageUrl.startsWith('http') && !m.imageUrl.startsWith(location.origin) ? (`/api/social-twin/proxy?url=${encodeURIComponent(m.imageUrl)}`) : m.imageUrl}
                                className="max-h-80 w-full rounded-lg border"
                                draggable
                                onDragStart={(e)=>{
                                  try { e.dataTransfer.setData('application/x-chat-item', JSON.stringify({ url: m.imageUrl, type: 'image' })); } catch {}
                                  e.dataTransfer.setData('text/uri-list', m.imageUrl!);
                                  e.dataTransfer.setData('text/plain', m.imageUrl!);
                                  e.dataTransfer.effectAllowed = 'copyMove';
                                }}
                              />
                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  className="rounded border px-2 py-0.5 text-xs"
                                  onClick={()=>{ folderModalPayload.current = { url: m.imageUrl!, type: 'image', prompt: m.content }; setFolderModalOpen(true); }}
                                >Add to project</button>
                                {m.sourceImageUrl ? (
                                  <button
                                    className="rounded border px-2 py-0.5 text-xs"
                                    onClick={()=>{ setViewer({ open: true, src: m.imageUrl!, ref: m.sourceImageUrl!, gallery: m.images || [] }); }}
                                  >Compare</button>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                          {(m as any).images && (m as any).images.length > 1 ? (
                            <div className="mt-2 flex gap-2 overflow-x-auto">
                              {(m as any).images.map((u: string, i: number) => (
                                <a key={i} href={u} target="_blank" rel="noreferrer">
                                  <img
                                    src={u.startsWith('http') && !u.startsWith(location.origin) ? (`/api/social-twin/proxy?url=${encodeURIComponent(u)}`) : u}
                                    className="h-20 w-auto rounded border object-cover"
                                    alt="thumb"
                                    draggable
                                    onDragStart={(e)=>{
                                      try { e.dataTransfer.setData('application/x-chat-item', JSON.stringify({ url: u, type: 'image' })); } catch {}
                                      e.dataTransfer.setData('text/uri-list', u);
                                      e.dataTransfer.setData('text/plain', u);
                                      e.dataTransfer.effectAllowed = 'copyMove';
                                    }}
                                  />
                                </a>
                              ))}
                            </div>
                          ) : null}
                          {m.videoUrl ? (
                            <video
                              src={m.videoUrl.startsWith('http') && !m.videoUrl.startsWith(location.origin) ? (`/api/social-twin/proxy?url=${encodeURIComponent(m.videoUrl)}`) : m.videoUrl}
                              className="mt-2 max-h-80 w-full rounded-lg border"
                              controls
                              draggable
                              onDragStart={(e)=>{
                                try { e.dataTransfer.setData('application/x-chat-item', JSON.stringify({ url: m.videoUrl, type: 'video' })); } catch {}
                                e.dataTransfer.setData('text/uri-list', m.videoUrl!);
                                e.dataTransfer.setData('text/plain', m.videoUrl!);
                                e.dataTransfer.effectAllowed = 'copyMove';
                              }}
                            />
                          ) : null}
                        </div>
                      </div>
                      {simpleMode ? (
                        <div className={`my-2 border-t ${darkMode ? 'border-neutral-800' : 'border-neutral-200'}`} />
                      ) : null}
                    </div>
                  );
                })
              )}
                <div ref={chatEndRef} />
              </div>
            </>
          )}

          {/* Chat Controls - only show for chat tab */}
          {activeTab === 'chat' && (
            <>
            <div className={`border-t p-2 ${simpleMode ? 'max-w-2xl mx-auto w-full' : ''}`}>
            {/* Controls header: mode selector above the prompt box */}
              <div className="mb-2 flex flex-wrap items-end gap-3">
              {!(mode==='image' || mode==='image-modify') && (
                <div className="grid gap-1">
                  <label className="text-xs opacity-70">Mode</label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as Mode)}
                    className={`w-[170px] cursor-pointer rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : 'bg-white'}`}
                    title="Mode"
                  >
                    <option value="text">Text</option>
                    <option value="image">Image</option>
                    <option value="image-modify">Image Modify</option>
                    <option value="video">Video</option>
                  </select>
                </div>
              )}
              {mode === 'text' ? (
                <div className="grid gap-1">
                  <label className="text-xs opacity-70">Provider</label>
                  <select
                    value={textProvider}
                    onChange={(e)=> setTextProvider(e.target.value as any)}
                    className={`w-[200px] cursor-pointer rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : 'bg-white'}`}
                    title="Text provider"
                  >
                    <option value="social">Social Twin AI</option>
                    <option value="openai">ChatGPT (OpenAI)</option>
                    <option value="deepseek">DeepSeek</option>
                  </select>
                </div>
              ) : null}
              {(mode === 'image' || mode === 'image-modify') ? (
                <>
                  {/* Primary row: Mode, Effects, Character, Aspect Ratio */}
                  <div className="relative">
                    {/* Advanced button in top-right above the row */}
                    <button
                      className={`absolute right-0 -top-6 rounded px-2 py-1 text-xs border ${darkMode? 'border-neutral-700' : 'border-neutral-300'}`}
                      onClick={()=> setAdvancedOpen(v=>!v)}
                    >{advancedOpen ? 'Hide Advanced' : 'Advanced'}</button>
                    <div className="mb-2 overflow-x-auto pr-1">
                      <div className="inline-flex items-end gap-2 whitespace-nowrap">
                        <div className="grid gap-1">
                          <label className="text-xs opacity-70">Effects</label>
                          <select
                            className={`w-[120px] rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
                            value={LORA_CHOICES.includes(loraName) ? loraName : 'Custom...'}
                            onChange={(e)=> setLoraName(e.target.value)}
                            title="Effects (LoRA)"
                          >
                            {LORA_CHOICES.map((n)=> (<option key={n} value={n}>{n}</option>))}
                          </select>
                        </div>
                        <div className="grid gap-1">
                          <label className="text-xs opacity-70">Character</label>
                          <select
                            className={`w-[110px] rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
                            value={characterOn ? 'On' : 'Off'}
                            onChange={(e)=> setCharacterOn(e.target.value === 'On')}
                            title="Character"
                          >
                            <option value="Off">Off</option>
                            <option value="On">On</option>
                          </select>
                        </div>
                        <div className="grid gap-1">
                          <label className="text-xs opacity-70">Ratio</label>
                          <select
                            className={`w-[88px] rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
                            value={aspectRatio}
                            onChange={(e)=> setAspectRatio(e.target.value)}
                          >
                            <option value="">Select</option>
                            {AR_CHOICES.map((ar)=> (<option key={ar} value={ar}>{ar}</option>))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Advanced row: Qty, Steps, CFG, Guidance, optional LoRA custom + scale */}
                  {advancedOpen && (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="grid gap-1">
                        <label className="text-xs opacity-70">Qty</label>
                        <select
                          className={`w-[80px] rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
                          value={batchSize === '' ? '' : String(batchSize)}
                          onChange={(e)=> setBatchSize(e.target.value === '' ? '' : Number(e.target.value))}
                        >
                          <option value="">Default</option>
                          {BATCH_CHOICES.map((n)=> (<option key={n} value={n}>{n}</option>))}
                        </select>
                      </div>
                      <div className="grid gap-1">
                        <label className="text-xs opacity-70">Steps</label>
                        <select
                          className={`w-[90px] rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
                          value={steps === '' ? '' : String(steps)}
                          onChange={(e)=> setSteps(e.target.value===''?'':Number(e.target.value))}
                        >
                          <option value="">Default</option>
                          {[10,15,20,24,30,40,50].map(n=> (<option key={n} value={n}>{n}</option>))}
                        </select>
                      </div>
                      <div className="grid gap-1">
                        <label className="text-xs opacity-70">CFG</label>
                        <select
                          className={`w-[80px] rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
                          value={cfgScale === '' ? '' : String(cfgScale)}
                          onChange={(e)=> setCfgScale(e.target.value===''?'':Number(e.target.value))}
                        >
                          <option value="">Default</option>
                          {[1,2,3,4,5,6].map(n=> (<option key={n} value={n}>{n}</option>))}
                        </select>
                      </div>
                      <div className="grid gap-1">
                        <label className="text-xs opacity-70">Guidance</label>
                        <select
                          className={`w-[100px] rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
                          value={guidance === '' ? '' : String(guidance)}
                          onChange={(e)=> setGuidance(e.target.value===''?'':Number(e.target.value))}
                        >
                          <option value="">Default</option>
                          {[1.0,2.0,2.5,3.0,3.5,4.0,5.0].map(n=> (<option key={n} value={n}>{n}</option>))}
                        </select>
                      </div>
                      {loraName==='Custom...' && (
                        <>
                          <input
                            className={`w-[160px] rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
                            placeholder="lora file or hf path"
                            value={loraName==='Custom...' ? '' : loraName}
                            onChange={(e)=> setLoraName(e.target.value)}
                          />
                          <input
                            type="number"
                            step="0.1"
                            className={`w-[80px] rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
                            value={loraScale === '' ? '' : String(loraScale)}
                            onChange={(e)=> setLoraScale(e.target.value === '' ? '' : Number(e.target.value))}
                            title="LoRA Scale"
                          />
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : null}

              {mode === 'video' ? (
                <>
                  {/* Primary row for Video: Mode, Model, Effects */}
                  <div className="relative">
                    <button
                      className={`absolute right-0 -top-6 rounded px-2 py-1 text-xs border ${darkMode? 'border-neutral-700' : 'border-neutral-300'}`}
                      onClick={()=> setAdvancedOpen(v=>!v)}
                    >{advancedOpen ? 'Hide Advanced' : 'Advanced'}</button>
                    <div className="mb-2 overflow-x-auto pr-1">
                      <div className="inline-flex items-end gap-2 whitespace-nowrap">
                        <div className="grid gap-1">
                          <label className="text-xs opacity-70">Model</label>
                          <select
                            value={videoModel}
                            onChange={(e)=> setVideoModel(e.target.value as any)}
                            className={`w-[120px] cursor-pointer rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : 'bg-white'}`}
                            title="Video Model"
                          >
                            <option value="ltxv">LTXV</option>
                            <option value="kling">Kling</option>
                            <option value="wan">WAN</option>
                          </select>
                        </div>
                        <div className="grid gap-1">
                          <label className="text-xs opacity-70">Effects</label>
                          <select
                            className={`w-[120px] rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
                            value={LORA_CHOICES.includes(loraName) ? loraName : 'Custom...'}
                            onChange={(e)=> setLoraName(e.target.value)}
                            title="Effects (LoRA)"
                          >
                            {LORA_CHOICES.map((n)=> (<option key={n} value={n}>{n}</option>))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Advanced row for Video: Steps, CFG, Guidance, optional LoRA custom+scale */}
                  {advancedOpen && (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="grid gap-1">
                        <label className="text-xs opacity-70">Steps</label>
                        <select
                          className={`w-[90px] rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
                          value={steps === '' ? '' : String(steps)}
                          onChange={(e)=> setSteps(e.target.value===''?'':Number(e.target.value))}
                        >
                          <option value="">Default</option>
                          {[10,15,20,24,30,40,50].map(n=> (<option key={n} value={n}>{n}</option>))}
                        </select>
                      </div>
                      <div className="grid gap-1">
                        <label className="text-xs opacity-70">CFG</label>
                        <select
                          className={`w-[80px] rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
                          value={cfgScale === '' ? '' : String(cfgScale)}
                          onChange={(e)=> setCfgScale(e.target.value===''?'':Number(e.target.value))}
                        >
                          <option value="">Default</option>
                          {[1,2,3,4,5,6].map(n=> (<option key={n} value={n}>{n}</option>))}
                        </select>
                      </div>
                      <div className="grid gap-1">
                        <label className="text-xs opacity-70">Guidance</label>
                        <select
                          className={`w-[100px] rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
                          value={guidance === '' ? '' : String(guidance)}
                          onChange={(e)=> setGuidance(e.target.value===''?'':Number(e.target.value))}
                        >
                          <option value="">Default</option>
                          {[1.0,2.0,2.5,3.0,3.5,4.0,5.0].map(n=> (<option key={n} value={n}>{n}</option>))}
                        </select>
                      </div>
                      {loraName==='Custom...' && (
                        <>
                          <input
                            className={`w-[160px] rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
                            placeholder="lora file or hf path"
                            value={loraName==='Custom...' ? '' : loraName}
                            onChange={(e)=> setLoraName(e.target.value)}
                          />
                          <input
                            type="number"
                            step="0.1"
                            className={`w-[80px] rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`}
                            value={loraScale === '' ? '' : String(loraScale)}
                            onChange={(e)=> setLoraScale(e.target.value === '' ? '' : Number(e.target.value))}
                            title="LoRA Scale"
                          />
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div
              ref={composerRef}
              className={`flex gap-2 items-end ${simpleMode ? (isMobile ? '' : 'sticky bottom-2') : ''}`}
              style={
                simpleMode && isMobile
                  ? {
                      position: 'fixed',
                      left: 0,
                      right: 0,
                      bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--kb-offset, 0px))',
                      zIndex: 10000,
                      background: darkMode ? '#000000' : '#ffffff',
                      padding: '8px',
                      borderTop: darkMode ? '1px solid #262626' : '1px solid #e5e7eb'
                    }
                  : { position: 'relative', zIndex: 10 }
              }
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your prompt..."
                className={`min-h-[44px] flex-1 resize-y rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400' : ''}`}
              />
              {/* Right-side vertical controls: Send above Upload */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSend}
                  className="cursor-pointer rounded-full p-2 flex items-center justify-center transition-all bg-black hover:opacity-90"
                  title="Send"
                  aria-label="Send"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none">
                    <path d="M5 12h14" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M13 5l7 7-7 7" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <label className={`cursor-pointer rounded-full p-2 flex items-center justify-center bg-black hover:opacity-90`} title="Attach image/video/pdf">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="#ffffff">
                    <path d="M16.5 6.5l-7.79 7.79a3 3 0 104.24 4.24l6.01-6.01a4.5 4.5 0 10-6.36-6.36L6.59 8.93" stroke="#ffffff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 17a1 1 0 01-1-1l.01-.12a1 1 0 01.29-.58l6.01-6.01a2.5 2.5 0 113.54 3.54l-6.01 6.01A3 3 0 119 15" stroke="#ffffff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <input
                    type="file"
                    accept="image/*,video/*,application/pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const dataUrl = String(reader.result || "");
                        setAttached({ name: f.name, type: f.type, dataUrl });
                      };
                      reader.readAsDataURL(f);
                    }}
                  />
                </label>
              </div>
              </div>
              {attached ? (
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded border p-2">
                    {attached && attached.type.startsWith('image') ? (
                      <img src={attached.dataUrl} alt={attached.name || 'attachment'} className="h-12 w-12 object-cover rounded" />
                    ) : attached && attached.type.startsWith('video') ? (
                      <div className="h-12 w-12 overflow-hidden rounded border">
                        <video src={attached.dataUrl} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className={`flex h-12 w-12 items-center justify-center rounded border ${darkMode ? 'bg-neutral-900 border-neutral-700 text-neutral-300' : 'bg-white text-black'}`}>
                        PDF
                      </div>
                    )}
                    <div className="text-xs">
                      <div className="font-medium truncate max-w-[40vw]" title={attached?.name || ''}>{attached?.name || ''}</div>
                      <div className={`opacity-70 ${darkMode ? 'text-neutral-400' : ''}`}>{attached?.type || ''}</div>
                    </div>
                  </div>
                  <button
                    className={`rounded border px-2 py-1 text-xs ${darkMode ? 'border-neutral-700 hover:bg-neutral-800' : ''}`}
                    onClick={() => setAttached(null)}
                  >Remove</button>
                </div>
              ) : null}
            </div>
      </section>
      {/* Canvas grid background */}
      {!simpleMode && (
        <section
        ref={gridSectionRef as any}
        className="absolute inset-0 z-0 grid-canvas"
        style={{ cursor: gridEnabled ? 'grab' : undefined, overflow: 'hidden' }}
        onDragOver={(e)=>{ e.preventDefault(); }}
        onDrop={(e)=>{
          e.preventDefault();
          // 1) Support dragging URL payload from chat thumbnails
          const custom = e.dataTransfer.getData('application/x-chat-item');
          if (custom) {
            try {
              const parsed = JSON.parse(custom);
              if (parsed && typeof parsed.url === 'string') {
                addToCanvas(parsed.url, parsed.type === 'video' ? 'video' : 'image');
                return;
              }
            } catch {}
          }
          const urlList = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
          if (urlList && /^https?:\/\//i.test(urlList)) {
            addToCanvas(urlList, urlList.match(/\.mp4($|\?)/i) ? 'video' : 'image');
            return;
          }
          // 2) Fallback: direct file drop
          const f = e.dataTransfer.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => {
            const url = String(reader.result || '');
            addToCanvas(url, f.type.startsWith('video') ? 'video' : 'image');
          };
          reader.readAsDataURL(f);
        }}
        onMouseDown={(e)=>{
          if (!gridEnabled) return;
          // only pan when clicking background, not items
          const target = e.target as HTMLElement;
          if (target.closest('.canvas-item')) return;
          const startX = e.clientX; const startY = e.clientY;
          const startPan = { ...gridPan };
          let started = false;
          const move = (ev: MouseEvent)=>{
            if (ev.buttons !== 1) { up(); return; }
            const dx = ev.clientX - startX; const dy = ev.clientY - startY;
            if (!started && Math.hypot(dx, dy) < 5) return; // deadzone
            started = true;
            setGridPan({ x: startPan.x + dx, y: startPan.y + dy });
          };
          const up = ()=>{
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
          };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', up);
        }}
        onWheel={(e)=>{
          if (!gridEnabled) return;
          e.preventDefault();
          const delta = e.deltaY > 0 ? -0.1 : 0.1;
          setGridScale(s => Math.max(0.2, Math.min(3, +(s + delta).toFixed(2))));
        }}
        onMouseMove={(e)=>{ if (linking) setLinkPos({ x: e.clientX, y: e.clientY }); }}
        onMouseLeave={(e)=>{ if (linking) setLinkPos({ x: e.clientX, y: e.clientY }); }}
      >
        {/* Inner scaled/panned container */}
          {/* Static background grid layer (not transformed) */}
          <div
            className="absolute inset-0"
            aria-hidden
            style={gridEnabled && gridLinesOn ? {
              backgroundImage:
                darkMode
                  ? 'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)'
                  : 'linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)',
              backgroundSize: '24px 24px, 24px 24px',
              backgroundPosition: `${(gridPan.x % 24)}px ${(gridPan.y % 24)}px`,
            } : {} }
          />

          {/* Transformed items layer */}
          <div
            className="absolute inset-0"
            style={{ transform: `translate(${gridPan.x}px, ${gridPan.y}px) scale(${gridScale})`, transformOrigin: '0 0' }}
          >
          {/* Draggable/resizable items */}
          {canvasItems.map((it, idx) => (
            <DraggableResizableItem key={it.id} item={it} dark={darkMode} scale={gridScale} hoverPort={hoverPort}
              onChange={(ni)=>{
                setCanvasItems((prev)=> prev.map(p=> p.id===ni.id ? ni : p));
              }}
              onStartLink={(port)=>{ setLinking({ id: it.id, port }); }}
              onFinishLink={(port, targetId)=>{
                if (linking && linking.id !== targetId) {
                  // Only allow connections from male (right) to female (left)
                  if (linking.port === 'male' && port === 'female') {
                    setEdges(prev=> [...prev, { id: generateId(), fromId: linking.id, fromPort: 'male', toId: targetId, toPort: 'female' }]);
                  }
                }
                setLinking(null);
              }}
            />
          ))}
          {/* Operator nodes simple UI overlay */}
          {canvasItems.filter(i=> i.type==='operator').map(op=> (
            <div key={`op-ui-${op.id}`} style={{ position:'absolute', left: op.x, top: op.y - 28 }}>
              <select
                className={`rounded border px-2 py-1 text-xs ${darkMode? 'bg-neutral-900 border-neutral-700 text-neutral-100':''}`}
                value={op.operatorKind || 'compile'}
                onChange={(e)=> setCanvasItems(prev=> prev.map(p=> p.id===op.id ? { ...p, operatorKind: (e.target.value as any) } : p))}
              >
                <option value="compile">Compile Video</option>
                <option value="export-pdf">Export PDF</option>
                <option value="publish">Publish/Save</option>
              </select>
              <button
                className={`ml-2 rounded border px-2 py-1 text-xs ${darkMode? 'border-neutral-700':''}`}
                onClick={()=> executeOperator(op)}
              >Execute</button>
            </div>
          ))}
          <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
            {edges.map((edge)=>{
              const from = canvasItems.find(i=>i.id===edge.fromId);
              const to = canvasItems.find(i=>i.id===edge.toId);
              if (!from || !to) return null;
              const fromX = edge.fromPort==='male' ? from.x+from.w : from.x;
              const fromY = from.y + from.h/2;
              const toX = edge.toPort==='female' ? to.x : to.x+to.w;
              const toY = to.y + to.h/2;
              const t = linkAnim / 10;
              const d = buildWindPathLocal(fromX, fromY, toX, toY, t, 10, 14);
              return <path key={edge.id} d={d} stroke={'#ff8a00'} strokeWidth={2.5} fill="none" style={{ filter: 'drop-shadow(0 0 6px rgba(255,138,0,0.55))' }} />
            })}
          </svg>
        </div>
        {/* Right-side floating toolbar */}
        {!simpleMode && (
        <div className="fixed left-6 top-1/2 z-40 -translate-y-1/2 flex flex-col gap-3">
          <button className="rounded-full p-3 shadow" title="Add text"
            onClick={()=>{
              const id = generateId();
              setCanvasItems(prev=> [...prev, { id, type:'text', text:'Double-click to edit', fontIdx: 0, fontScale: 3.2, x: 80, y: 80, w: 320, h: 160 }]);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M4 7h16M9 7v10m6-10v10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
          <label className="rounded-full p-3 shadow cursor-pointer" title="Upload">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
            <input type="file" className="hidden" accept="image/*,video/*" onChange={(e)=>{
              const f = e.target.files?.[0]; if (!f) return;
              const reader = new FileReader();
              reader.onload = ()=>{ const url = String(reader.result||''); addToCanvas(url, f.type.startsWith('video')?'video':'image'); };
              reader.readAsDataURL(f);
            }} />
          </label>
          {/* Generate via current mini-prompt/input */}
          <button className="rounded-full p-3 shadow" title="Generate" onClick={()=>{ handleSend(); if (quickCreateOpen) setQuickCreateOpen(false); }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path d="M4 12h10M9 7l5 5-5 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="16" y="6" width="4" height="12" rx="1.2" stroke="#fff" strokeWidth="1.4"/>
            </svg>
          </button>
          <button className="rounded-full p-3 shadow" title="Create"
            onClick={()=> setQuickCreateOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 5v14m-7-7h14" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>
        )}
          {/* Context menu for grid items */}
          {/* Inline simple menu (no external component) */}
          {menu.open ? (
          <div className="fixed z-[10000]" style={{ left: menu.x, top: menu.y }}
               onClick={()=> setMenu({ open:false, x:0, y:0, targetId:null })}
          >
            <div className={`min-w-[160px] overflow-hidden rounded-lg border shadow ${darkMode ? 'bg-neutral-900 border-neutral-700 text-neutral-100' : 'bg-white'}`} onClick={(e)=> e.stopPropagation()}>
              <button className={`block w-full text-left px-3 py-2 text-sm ${darkMode? 'hover:bg-white/10' : 'hover:bg-black/5'}`} onClick={()=>{ setMenu({ open:false, x:0, y:0, targetId:null }); }}>Close</button>
                <div className="px-3 py-2 text-xs opacity-70">Clip settings</div>
                <div className="px-3 pb-2 text-xs">
                  <label className="mr-1">Transition (ms)</label>
                  <input type="number" className={`w-24 rounded border px-1 py-0.5 ${darkMode? 'bg-neutral-800 border-neutral-700 text-neutral-100':''}`}
                    onChange={(e)=>{ const v = Number(e.target.value)||0; if (menu.targetId) setEdges(prev=> prev.map(ed=> ed.fromId===menu.targetId ? { ...ed, transitionMs: v } : ed)); }} />
                </div>
                <div className="px-3 pb-2 text-xs">
                  <label className="mr-1">Image duration (s)</label>
                  <input type="number" step="0.1" className={`w-24 rounded border px-1 py-0.5 ${darkMode? 'bg-neutral-800 border-neutral-700 text-neutral-100':''}`}
                    onChange={(e)=>{ const v = Number(e.target.value)||0; if (menu.targetId) setEdges(prev=> prev.map(ed=> ed.fromId===menu.targetId ? { ...ed, imageDurationSec: v } : ed)); }} />
                </div>
              <button className={`block w-full text-left px-3 py-2 text-sm ${darkMode? 'hover:bg-white/10' : 'hover:bg-black/5'}`} onClick={()=>{
                if (menu.targetId) setCanvasItems(prev=> prev.filter(i=> i.id!==menu.targetId));
                setMenu({ open:false, x:0, y:0, targetId:null });
              }}>Delete</button>
              <button className={`block w-full text-left px-3 py-2 text-sm ${darkMode? 'hover:bg-white/10' : 'hover:bg-black/5'}`} onClick={()=>{
                if (menu.targetId) {
                  const src = canvasItems.find(i=> i.id===menu.targetId);
                  if (src) setCanvasItems(prev=> [...prev, { ...src, id: generateId(), x:(src.x||0)+20, y:(src.y||0)+20 }]);
                }
                setMenu({ open:false, x:0, y:0, targetId:null });
              }}>Duplicate</button>
              <button className={`block w-full text-left px-3 py-2 text-sm ${darkMode? 'hover:bg-white/10' : 'hover:bg-black/5'}`} onClick={()=>{
                if (menu.targetId) setCanvasItems(prev=> prev.map(i=> i.id===menu.targetId ? { ...i, type:'text', text: i.url || i.text || '' } : i));
                setMenu({ open:false, x:0, y:0, targetId:null });
              }}>Convert to Text</button>
                {/* Export submenu */}
                <div className="border-t my-1" />
                <div className="px-3 py-1 text-xs opacity-70">Export</div>
                <button className={`block w-full text-left px-3 py-2 text-sm ${darkMode? 'hover:bg-white/10' : 'hover:bg-black/5'}`} onClick={()=>{
                  if (!menu.targetId) return;
                  openCompileModalFromNode(menu.targetId);
                  setMenu({ open:false, x:0, y:0, targetId:null });
                }}>Compiled Video</button>
                <button className={`block w-full text-left px-3 py-2 text-sm ${darkMode? 'hover:bg-white/10' : 'hover:bg-black/5'}`} onClick={()=>{
                  if (!menu.targetId) return;
                  openComposeModalFromNode(menu.targetId);
                  setMenu({ open:false, x:0, y:0, targetId:null });
                }}>Compose (PDF/PPT)</button>
            </div>
          </div>
        ) : null}
      </section>
      )}
      {/* Side-by-side viewer for compare */}
      {viewer.open && (
        <div className="fixed inset-0 z-[10040]">
          <div className="absolute inset-0 bg-black/70" onClick={()=> setViewer({ open:false, src:'', ref: undefined })} />
          <div className={`absolute left-1/2 top-10 -translate-x-1/2 w-[92vw] max-w-6xl rounded-2xl border ${darkMode?'border-white/10 bg-black':'border-black/10 bg-white'} p-4`}>
            <div className="mb-3 flex items-center justify-between text-xs opacity-70">
              <div>Compare</div>
              <button className="rounded border px-2 py-1" onClick={()=> setViewer({ open:false, src:'', ref: undefined })}>Close</button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {viewer.ref ? (
                <div>
                  <div className="mb-1 text-xs opacity-70">Original</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getDisplayUrl(viewer.ref)} alt="original" className="max-h-[70vh] w-full rounded border object-contain" />
                </div>
              ) : null}
              <div>
                <div className="mb-1 text-xs opacity-70">Result</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getDisplayUrl(viewer.src)} alt="result" className="max-h-[70vh] w-full rounded border object-contain" />
                {viewer.gallery && viewer.gallery.length>1 ? (
                  <div className="mt-2 flex gap-2 overflow-x-auto">
                    {viewer.gallery.map((u)=> (
                      <img key={u} src={getDisplayUrl(u)} className="h-16 w-auto rounded border object-cover" alt="variant" />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compile modal */}
      {compileOpen ? (
        <div className="fixed inset-0 z-[10050] pointer-events-auto">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={()=> setCompileOpen(false)} />
          {/* Modal card */}
          <div className={`absolute left-1/2 top-20 -translate-x-1/2 w-[92vw] max-w-xl rounded-2xl border p-4 ${darkMode?'bg-black border-neutral-800 text-neutral-100':'bg-white'}`} role="dialog" aria-modal="true">
            <div className="mb-3 text-lg font-semibold">Compile Video</div>
            <div className="mb-3 text-sm opacity-80">Clips to be compiled (in order):</div>
            <div className="mb-4 max-h-48 overflow-auto rounded border p-2 text-xs">
              {compileChain.length ? compileChain.map((c, i)=> (
                <div key={i} className="truncate">{i+1}. {c.url}</div>
              )) : <div className="opacity-70">No videos detected from the chain. All videos on canvas will be compiled.</div>}
            </div>
            <div className="mb-3 flex items-center gap-3">
              <label className="text-sm">Aspect Ratio</label>
              <select className={`rounded border px-2 py-1 text-sm ${darkMode?'bg-neutral-900 border-neutral-700':''}`} value={compileAR} onChange={(e)=> setCompileAR(e.target.value as any)}>
                <option value="16:9">16:9</option>
                <option value="1:1">1:1</option>
                <option value="9:16">9:16</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-sm">Background music</label>
              <div className="flex gap-2">
                <input className={`flex-1 rounded border px-2 py-1 text-sm ${darkMode?'bg-neutral-900 border-neutral-700':''}`} placeholder="https://.../track.mp3" value={compileAudio} onChange={(e)=> setCompileAudio(e.target.value)} />
                <label className={`cursor-pointer rounded border px-2 py-1 text-sm ${darkMode?'border-neutral-700':''}`}>
                  Upload
                  <input type="file" accept="audio/*" className="hidden" onChange={async (e)=>{
                    const f = e.target.files?.[0]; if (!f) return;
                    const reader = new FileReader();
                    reader.onload = ()=> setCompileAudio(String(reader.result||''));
                    reader.readAsDataURL(f);
                  }} />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={`rounded border px-3 py-1 text-sm ${darkMode?'border-neutral-700':''}`} onClick={(e)=> { e.preventDefault(); e.stopPropagation(); setCompileOpen(false); }}>Cancel</button>
              <button type="button" className={`rounded bg-black px-3 py-1 text-sm text-white`} onClick={(e)=> { e.preventDefault(); e.stopPropagation();
                let chain = compileChain;
                if ((!chain || !chain.length) && compileOriginId) {
                  const upstream = getUpstreamMediaChain(compileOriginId).filter(i=> i.type==='video');
                  const forward = upstream.length ? getForwardVideoChain(upstream[0].id) : [];
                  chain = (forward.length ? forward : upstream).map(i=> ({ url: getRawUrl(i.url) || i.url, type:'video' as const }));
                }
                if (!chain || !chain.length) {
                  setMessages(prev=> [...prev, { id: generateId(), role:'assistant', content:'No videos connected to Compile.', createdAt: new Date().toISOString() }]);
                  return;
                }
                runCompile(chain);
              }}>Compile</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Compose (PDF/PPT) modal */}
      {composeOpen ? (
        <div className="fixed inset-0 z-[10050] pointer-events-auto">
          <div className="absolute inset-0 bg-black/50" onClick={()=> setComposeOpen(false)} />
          <div className={`absolute left-1/2 top-14 -translate-x-1/2 w-[92vw] max-w-3xl rounded-2xl border p-4 ${darkMode?'bg-black border-neutral-800 text-neutral-100':'bg-white'}`}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-lg font-semibold">Compose Document</div>
              <div className="flex items-center gap-2 text-sm">
                <span>Size</span>
                <select className={`rounded border px-2 py-1 ${darkMode?'bg-neutral-900 border-neutral-700':''}`} value={composeSize} onChange={(e)=> setComposeSize(e.target.value as any)}>
                  <option value="A4P">A4 Portrait</option>
                  <option value="A4L">A4 Landscape</option>
                  <option value="16:9">16:9</option>
                </select>
              </div>
            </div>
            <div className="mb-3 text-sm opacity-80">Pages (preview)</div>
            <div className="grid max-h-[48vh] grid-cols-2 gap-3 overflow-auto">
              {composePages.length ? composePages.map((pg, i)=> (
                <div key={i} className={`relative rounded border p-2 ${darkMode?'border-neutral-700':''}`}>
                  <div className="mb-1 text-xs opacity-70">Page {i+1}</div>
                  <div className="h-48 w-full overflow-hidden rounded border">
                    {/* Simple preview: first image + texts */}
                    <div className="relative h-full w-full bg-white">
                      {pg.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={getDisplayUrl(pg.images[0].url)} alt="page" className="h-full w-full object-contain" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs opacity-60">No image</div>
                      )}
                      {pg.texts.slice(0,1).map((t, ti)=> (
                        <div key={ti} className="absolute bottom-1 left-1 right-1 rounded bg-black/60 p-1 text-[11px] text-white">{t.content}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="col-span-2 text-sm opacity-70">No pages detected from chain. Connect images and text with the orange string and try again.</div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={`rounded border px-3 py-1 text-sm ${darkMode?'border-neutral-700':''}`} onClick={()=> setComposeOpen(false)}>Cancel</button>
              <button type="button" className={`rounded border px-3 py-1 text-sm ${darkMode?'border-neutral-700':''}`} onClick={()=> runExportPDF()}>Export PDF</button>
              <button type="button" className={`rounded bg-black px-3 py-1 text-sm text-white`} onClick={()=> runExportPPT()}>Export PPTX</button>
            </div>
          </div>
        </div>
      ) : null}
      <FolderModal
        isOpen={folderModalOpen}
        onClose={()=> setFolderModalOpen(false)}
        userId={userId || ''}
        dark={darkMode}
        title="Add to project"
        onConfirm={async (folderId)=>{
          const p = folderModalPayload.current;
          if (!p) return;
          await fetch(`/api/social-twin/folders/${folderId}/items`, {
            method:'POST', headers:{ 'Content-Type':'application/json', 'X-User-Id': userId || '' },
            body: JSON.stringify({ media_url: p.url, type: p.type, prompt: p.prompt })
          });
        }}
      />
      {/* Save Project floating button (appears when grid has new content) */}
      {!simpleMode && showSaveProject ? (
        <button
          className={`fixed bottom-20 left-6 z-[10001] rounded-full px-4 py-2 text-sm shadow ${darkMode ? 'bg-neutral-900 border border-neutral-700 text-neutral-100' : 'bg-white'}`}
          onClick={()=> setProjectModalOpen(true)}
        >Save Project</button>
      ) : null}
      <ProjectModal
        isOpen={projectModalOpen}
        onClose={()=> setProjectModalOpen(false)}
        onConfirmNew={(title)=> saveCurrentProject(title)}
        onConfirmExisting={currentProjectId ? updateExistingProject : undefined}
        hasExisting={Boolean(currentProjectId)}
        existingTitle={currentProjectTitle || undefined}
        dark={darkMode}
      />
      {simpleMode && sidebarOpen && (
        <aside className={`fixed left-0 top-0 z-[10000] h-screen w-60 border-r ${darkMode ? 'bg-neutral-950 border-neutral-800 text-neutral-100' : 'bg-white'}`}>
          <div className="p-3 border-b flex items-center justify-between">
            <div className="font-semibold text-sm">Menu</div>
            <button className="text-xs rounded border px-2 py-1" onClick={()=> setSidebarOpen(false)}>Close</button>
          </div>
          <div className="p-3 space-y-2 text-sm">
            <button className="w-full rounded border px-2 py-1 text-left" onClick={()=> setShowSettings(true)}>Settings</button>
            <button className="w-full rounded border px-2 py-1 text-left" onClick={()=> setShowBin(true)}>Generated Bin</button>
            <button className="w-full rounded border px-2 py-1 text-left" onClick={async ()=>{
              const r = await fetch('/api/social-twin/topics'); const j = await r.json(); setTopics(j.topics||[]); setShowSidebar(true);
            }}>Topics</button>
          </div>
        </aside>
      )}
      {/* Top-level overlay for preview line in screen space to ensure visibility */}
      {linking && (()=>{
        const from = canvasItems.find(i=>i.id===linking.id);
        if (!from) return null;
        const fromX = linking.port==='male' ? from.x+from.w : from.x;
        const fromY = from.y + from.h/2;
        const rect = gridSectionRef.current?.getBoundingClientRect();
        if (!rect) return null;
        const sx = rect.left + (fromX + gridPan.x) * gridScale;
        const sy = rect.top + (fromY + gridPan.y) * gridScale;
        let tx = linkPos.x; let ty = linkPos.y;
        // if hovering female target, snap end-point to that port center (screen space)
        if (hoverPort && hoverPort.port==='female' && linking.port==='male' && hoverPort.id!==linking.id) {
          const tgt = canvasItems.find(i=>i.id===hoverPort.id);
          if (tgt) {
            const tpx = rect.left + (tgt.x + gridPan.x) * gridScale;
            const tpy = rect.top + (tgt.y + tgt.h/2 + gridPan.y) * gridScale;
            tx = tpx; ty = tpy;
          }
        }
        // wind-like floating preview curve: displace control points along the normal with time-based oscillation
        const dx = tx - sx; const dy = ty - sy; const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist; const uy = dy / dist;            // unit along direction
        const nx = -uy; const ny = ux;                         // unit normal
        const t = linkAnim / 10;                               // time
        const amp = Math.min(24, dist * 0.12);                 // wind amplitude
        const j1 = amp * 0.18 * Math.cos(t * 0.9 + 0.7);       // along-direction jitter
        const j2 = amp * 0.18 * Math.sin(t * 0.8 + 1.9);
        const n1 = amp * Math.sin(t + 0.3);                    // normal offsets
        const n2 = amp * Math.sin(t + 2.1);
        // base control points at 1/3 and 2/3 along the segment
        let c1x = sx + dx * 0.33 + nx * n1 + ux * j1;
        let c1y = sy + dy * 0.33 + ny * n1 + uy * j1;
        let c2x = sx + dx * 0.66 + nx * n2 + ux * j2;
        let c2y = sy + dy * 0.66 + ny * n2 + uy * j2;
        const d = `M ${sx},${sy} C ${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`;
        return (
          <svg className="pointer-events-none fixed inset-0 z-[9999]" width="100%" height="100%">
            <path d={d} stroke={'#ff8a00'} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="14 10" style={{ filter: 'drop-shadow(0 0 10px rgba(255,138,0,0.85))' }} />
          </svg>
        );
      })()}
      {/* Context menu portal removed to avoid duplicate dropdown; using single inline menu above */}

      {/* Quick Create mini prompt */}
      {quickCreateOpen ? (
        <div className="fixed inset-0 z-[10000]" onClick={()=> setQuickCreateOpen(false)}>
          <div
            className="absolute w-[360px] rounded-xl border bg-white p-3 shadow-xl text-black"
            style={{ left: quickCreatePos.x, top: quickCreatePos.y }}
            onClick={(e)=> e.stopPropagation()}
          >
            <div
              className="mb-2 flex cursor-move items-center justify-between"
              onMouseDown={(e)=>{
                e.preventDefault();
                const startX = e.clientX; const startY = e.clientY;
                const offX = startX - quickCreatePos.x; const offY = startY - quickCreatePos.y;
                quickCreateDragRef.current = { dragging: true, offX, offY };
                const move = (ev: MouseEvent)=>{
                  if (!quickCreateDragRef.current?.dragging) return;
                  setQuickCreatePos({ x: ev.clientX - offX, y: ev.clientY - offY });
                };
                const up = ()=>{
                  if (quickCreateDragRef.current) quickCreateDragRef.current.dragging = false;
                  window.removeEventListener('mousemove', move);
                  window.removeEventListener('mouseup', up);
                };
                window.addEventListener('mousemove', move);
                window.addEventListener('mouseup', up);
              }}
            >
              <div className="px-1 text-sm font-medium">Quick Create</div>
              <button className="rounded px-2 py-1 text-xs" onClick={()=> setQuickCreateOpen(false)}>✕</button>
            </div>
            <div className="mb-2 flex items-end gap-2">
              {/* Mode selection removed here to avoid duplicate dropdowns; use main header Mode */}
              {mode==='image' || mode==='image-modify' ? (
                <>
                  <select value={aspectRatio} onChange={(e)=> setAspectRatio(e.target.value)} className="rounded border px-2 py-1 text-sm">
                    <option value="">AR</option>
                    {AR_CHOICES.map((ar)=> (<option key={ar} value={ar}>{ar}</option>))}
                  </select>
                  <select value={batchSize===''?'':String(batchSize)} onChange={(e)=> setBatchSize(e.target.value===''?'':Number(e.target.value))} className="rounded border px-2 py-1 text-sm">
                    <option value="">Qty</option>
                    {BATCH_CHOICES.map((n)=> (<option key={n} value={n}>{n}</option>))}
                  </select>
                </>
              ) : null}
              {mode==='text' ? (
                <select value={textProvider} onChange={(e)=> setTextProvider(e.target.value as any)} className="rounded border px-2 py-1 text-sm">
                  <option value="social">Social</option>
                  <option value="openai">OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                </select>
              ) : null}
            </div>
            <textarea value={input} onChange={(e)=> setInput(e.target.value)} placeholder="Quick prompt..." className="mb-2 h-24 w-full resize-none rounded border p-2 text-sm text-black" />
            <div className="flex justify-end gap-2">
              <button className="rounded border px-3 py-1 text-sm" onClick={()=> setQuickCreateOpen(false)}>Cancel</button>
              <button className="rounded bg-black px-3 py-1 text-sm text-white" onClick={()=>{ handleSend(); setQuickCreateOpen(false); }}>Generate</button>
            </div>
          </div>
        </div>
      ) : null}
      {/* Docked grid controls (bottom-left) */}
      {!simpleMode && (
      <div className="fixed bottom-4 left-6 z-40 flex items-center gap-2">
        <button className="rounded-full p-2 shadow" title={gridEnabled ? 'Hide Grid' : 'Show Grid'} onClick={()=>setGridEnabled(v=>!v)}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none">
            <path d="M4 4h16v16H4z M8 4v16 M16 4v16 M4 8h16 M4 16h16" stroke="#fff" strokeWidth="1.4"/>
          </svg>
        </button>
        {gridEnabled ? (
          <>
            <button className="rounded-full p-2 shadow" title={gridLinesOn ? 'Hide Lines' : 'Show Lines'} onClick={()=>setGridLinesOn(v=>!v)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none">
                <path d="M4 12h16" stroke="#fff" strokeWidth="1.4"/>
              </svg>
            </button>
            <button className="rounded-full p-2 shadow" title="Zoom In" onClick={()=>setGridScale(s=> Math.min(3, +(s+0.1).toFixed(2)))}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none">
                <circle cx="10" cy="10" r="6" stroke="#fff" strokeWidth="1.4"/>
                <path d="M10 7v6M7 10h6" stroke="#fff" strokeWidth="1.4"/>
                <path d="M14.5 14.5L20 20" stroke="#fff" strokeWidth="1.4"/>
              </svg>
            </button>
            <button className="rounded-full p-2 shadow" title="Zoom Out" onClick={()=>setGridScale(s=> Math.max(0.2, +(s-0.1).toFixed(2)))}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none">
                <circle cx="10" cy="10" r="6" stroke="#fff" strokeWidth="1.4"/>
                <path d="M7 10h6" stroke="#fff" strokeWidth="1.4"/>
                <path d="M14.5 14.5L20 20" stroke="#fff" strokeWidth="1.4"/>
              </svg>
            </button>
            <button className="rounded-full p-2 shadow" title="Reset" onClick={()=>{ setGridScale(1); setGridPan({x:0,y:0}); }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none">
                <path d="M20 12a8 8 0 10-2.34 5.66M20 12h-5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
          </>
        ) : null}
      </div>
      )}
      {/* Sidebar */}
      {showSidebar ? (
        <aside className={`fixed top-0 left-0 z-40 h-screen w-64 border-r ${darkMode ? 'bg-neutral-950 border-neutral-800' : 'bg-white'}`}>
          <div className="p-3 flex items-center justify-between border-b">
            <h3 className="text-sm font-semibold">Daily Topics</h3>
            <button className="text-xs rounded border px-2 py-1" onClick={()=>setShowSidebar(false)}>Close</button>
          </div>
          <div className="p-2 space-y-2 overflow-y-auto h-[calc(100vh-48px)]">
            {topics.map((t)=> (
              <div key={t.id} className="text-sm truncate cursor-pointer rounded border px-2 py-1 hover:bg-black/5" title={t.title}>
                {t.title}
              </div>
            ))}
            {topics.length===0 ? <div className="text-xs opacity-60 p-2">No topics yet</div> : null}
          </div>
        </aside>
      ) : null}
      {/* Generated Bin button */}
      <button
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 shadow ${darkMode ? 'bg-neutral-900 border border-neutral-700 text-neutral-100' : 'bg-white'} `}
        onClick={async () => {
          setShowBin((v) => !v);
          if (!showBin) {
            const r = await fetch('/api/social-twin/history?limit=24', { headers: { 'X-User-Id': userId || '' } });
            const j = await r.json();
            setBinItems(j.items || []);
            setBinCursor(j.nextCursor || null);
          }
        }}
      >
        Generated Bin
      </button>

      {/* Generated Bin panel */}
      {showBin ? (
        <div className={"fixed inset-0 z-40 backdrop-blur-sm"} onClick={()=>setShowBin(false)} />
      ) : null}
      {showBin ? (
        <div className={`fixed bottom-6 left-1/2 z-50 h-[70vh] w-[70vw] max-w-4xl -translate-x-1/2 rounded-2xl border ${darkMode ? 'border-neutral-700' : 'border-white/30'} p-4 backdrop-blur-md bg-black/30`}
             onClick={(e)=> e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3">
            <h3 className="text-sm font-semibold">Your Generations</h3>
            <button className={`rounded border px-2 py-1 text-xs ${darkMode ? 'border-neutral-700' : ''}`} onClick={()=>setShowBin(false)}>Close</button>
          </div>
          <div className="overflow-y-auto max-h-[60vh] pr-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[...binItems].sort((a,b)=> new Date(b.created_at||b.createdAt||0).getTime() - new Date(a.created_at||a.createdAt||0).getTime()).map((it) => {
                const url = it.display_url || it.result_url;
                return (
                <div key={it.id} className="relative group rounded border p-2">
                  <div className="absolute right-2 top-2 z-20 hidden group-hover:block">
                    <div className={`rounded border text-xs shadow ${darkMode ? 'bg-neutral-900 text-neutral-100 border-neutral-700' : 'bg-white text-black'}`}>
                      <button className={`block w-full text-left px-3 py-1 ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`} onClick={()=>{
                        if (it.topic_id) {
                          fetch(`/api/social-twin/topics/${it.topic_id}/feed`, { headers: { 'X-User-Id': userId || '' } })
                            .then(r=>r.json())
                            .then(j=>{
                              const items = (j.items||[]) as any[];
                              const msgs = items.map((x:any)=>({ id:x.id, role:x.role, content:x.content, imageUrl:x.imageUrl, videoUrl:x.videoUrl, createdAt:x.createdAt }));
                              setMessages(msgs);
                              const ts = it.created_at || it.createdAt || null;
                              if (ts) setTargetScrollTs(ts);
                            });
                        }
                        setShowBin(false);
                      }}>Show in chat</button>
                      <button className={`block w-full text-left px-3 py-1 ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`} onClick={()=>{
                        folderModalPayload.current = { url: String(url), type: it.type, prompt: it.prompt } as any;
                        setFolderModalOpen(true);
                      }}>Add to project…</button>
                      <button className={`block w-full text-left px-3 py-1 ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`} onClick={()=>{
                        if (typeof url === 'string') setAttached({ name: 'bin-item', type: it.type==='video'?'video/mp4':'image/png', dataUrl: url });
                        setShowBin(false);
                      }}>Send to chat</button>
                      <button className={`block w-full text-left px-3 py-1 ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`} onClick={()=>{
                        if (typeof url === 'string') {
                          addToCanvas(url, it.type === 'video' ? 'video' : 'image');
                        }
                        setShowBin(false);
                      }}>Send to canvas</button>
                    </div>
                  </div>
                  <div className="group w-full aspect-video overflow-hidden rounded border">
                    {it.type === 'video' ? (
                      (url ? (
                        <video src={(typeof url==='string' && url.startsWith('http') && !url.startsWith(location.origin)) ? (`/api/social-twin/proxy?url=${encodeURIComponent(url)}`) : (url as string)} className="h-full w-full origin-center object-cover transition-transform duration-200 group-hover:scale-[1.12]" />
                      ) : (
                        <div className={`h-full w-full ${darkMode?'bg-neutral-900':'bg-neutral-100'} flex items-center justify-center text-xs opacity-70`}>Compiling…</div>
                      ))
                    ) : (
                      <img src={(typeof url==='string' && url.startsWith('http') && !url.startsWith(location.origin)) ? (`/api/social-twin/proxy?url=${encodeURIComponent(url)}`) : (url as string)} className="h-full w-full origin-center object-cover transition-transform duration-200 group-hover:scale-[1.12]" alt="gen" />
                    )}
                  </div>
                  <div className="mt-2">
                    <div className="text-xs opacity-70">{new Date(it.created_at || it.createdAt || Date.now()).toLocaleString()}</div>
                    <div className="text-xs truncate" title={it.prompt || ''}>{it.prompt || ''}</div>
                  </div>
                </div>
              );})}
            </div>
          </div>
        </div>
      ) : null}
      {/* Legacy pinned grid removed */}
    </main>
  );
}

function DraggableResizableItem({ item, dark, onChange, scale, onStartLink, onFinishLink, hoverPort }:{ item: any, dark:boolean, onChange:(it:any)=>void, scale?: number, onStartLink?:(port:'male'|'female')=>void, onFinishLink?:(port:'male'|'female', targetId:string)=>void, hoverPort: { id: string; port: 'male'|'female' } | null }){
  const ref = useRef<HTMLDivElement|null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTransform = useRef<{dx:number;dy:number}>({ dx: 0, dy: 0 });
  useEffect(()=>{
    const el = ref.current;
    if (!el) return;
    let sx=0, sy=0, ox=0, oy=0, dx=0, dy=0, dragging=false;
    function onMouseDown(e: MouseEvent){
      const tgt = e.target as HTMLElement;
      if (tgt.classList.contains('resize')) return;
      if (tgt.closest('.port')) return; // do not start drag when clicking ports
      e.stopPropagation();
      e.preventDefault();
      dragging = true;
      sx = e.clientX; sy = e.clientY; ox = item.x; oy = item.y; dx = 0; dy = 0;
      (el as HTMLElement).style.willChange = 'transform';
      window.addEventListener('mousemove', onMove, { passive: true });
      window.addEventListener('mouseup', onUp);
    }
    function onMove(e: MouseEvent){
      const sc = scale || 1;
      if (!dragging || e.buttons !== 1) { onUp(); return; }
      dx = (e.clientX - sx) / sc;
      dy = (e.clientY - sy) / sc;
      lastTransform.current = { dx, dy };
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          const { dx, dy } = lastTransform.current;
          (el as HTMLElement).style.transform = `translate(${dx}px, ${dy}px)`;
          rafRef.current = null;
        });
      }
    }
    function onUp(){
      if (!dragging) return;
      dragging = false;
      (el as HTMLElement).style.transform = '';
      (el as HTMLElement).style.willChange = '';
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const nx = ox + dx;
      const ny = oy + dy;
      if (dx !== 0 || dy !== 0) onChange({ ...item, x:nx, y:ny });
    }
    el.addEventListener('mousedown', onMouseDown);
    return ()=>{ el.removeEventListener('mousedown', onMouseDown); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [item, onChange, scale]);

  // Simple resize handle (bottom-right)
  useEffect(()=>{
    const el = ref.current;
    if (!el) return;
    const handle = el.querySelector('.resize') as HTMLElement | null;
    if (!handle) return;
    let sx=0, sy=0, ow=0, oh=0, resizing=false, dw=0, dh=0;
    function onDown(e: MouseEvent){
      e.stopPropagation();
      resizing = true;
      sx = e.clientX; sy = e.clientY; ow = item.w; oh = item.h; dw=0; dh=0;
      (el as HTMLElement).style.willChange = 'width, height';
      window.addEventListener('mousemove', onMove, { passive: true });
      window.addEventListener('mouseup', onUp);
    }
    function onMove(e: MouseEvent){
      const sc = scale || 1;
      if (!resizing || e.buttons !== 1) { onUp(); return; }
      dw = (e.clientX - sx) / sc; dh = (e.clientY - sy) / sc;
      const nw = Math.max(120, ow + dw);
      const nh = Math.max(80, oh + dh);
      (el as HTMLElement).style.width = `${nw}px`;
      (el as HTMLElement).style.height = `${nh}px`;
      // Update font scale relative to height for text items
      if (item.type === 'text') {
        const newScale = Math.max(0.5, Math.min(6, nh / 160 * (item.fontScale || 3.2)));
        onChange({ ...item, fontScale: newScale, w: nw, h: nh });
        return;
      }
    }
    function onUp(){
      if (!resizing) return;
      resizing = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      (el as HTMLElement).style.willChange = '';
      const nw = Math.max(120, ow + dw);
      const nh = Math.max(80, oh + dh);
      if (item.type === 'text') {
        const newScale = Math.max(0.5, Math.min(6, nh / 160 * (item.fontScale || 3.2)));
        onChange({ ...item, w:nw, h:nh, fontScale: newScale });
      } else {
        onChange({ ...item, w:nw, h:nh });
      }
    }
    handle.addEventListener('mousedown', onDown);
    return ()=>{ handle.removeEventListener('mousedown', onDown); };
  }, [item, onChange, scale]);

  return (
    <div ref={ref} style={{ position:'absolute', left:item.x, top:item.y, width:item.w, height:item.h }}
         className={`canvas-item group rounded border ${item.type==='text'
           ? ((typeof window !== 'undefined' && (window as any).__editingTextId === item.id) || false
               ? (dark ? 'border-neutral-700' : 'border-neutral-300')
               : 'border-transparent')
           : (dark ? 'border-neutral-700' : 'border-neutral-300')} overflow-visible select-none`}
         onContextMenu={(e)=>{
           e.preventDefault();
           const rect = (document.body as HTMLElement).getBoundingClientRect();
           (window as any).__setGridMenu && (window as any).__setGridMenu({ open:true, x:e.clientX - rect.left, y:e.clientY - rect.top, targetId: item.id });
         }}
    >
      {item.type==='video' ? (
        <div className="h-full w-full overflow-hidden">
          <video
            src={(typeof item.url==='string' && item.url.startsWith('http') && typeof location!=='undefined' && !item.url.startsWith(location.origin)) ? (`/api/social-twin/proxy?url=${encodeURIComponent(item.url)}`) : (item.url as string)}
            className="h-full w-full origin-center object-cover transition-transform duration-200 group-hover:scale-[1.12]"
            controls
          />
        </div>
      ) : item.type==='image' ? (
        <div className="h-full w-full overflow-hidden">
          <img
            src={(typeof item.url==='string' && item.url.startsWith('http') && typeof location!=='undefined' && !item.url.startsWith(location.origin)) ? (`/api/social-twin/proxy?url=${encodeURIComponent(item.url)}`) : (item.url as string)}
            className="h-full w-full origin-center object-cover transition-transform duration-200 group-hover:scale-[1.12]"
            alt="canvas"
          />
        </div>
      ) : (
        <EditableTextBlock item={item} dark={dark} onChange={onChange} />
      )}
      <div className={`resize absolute right-1 bottom-1 h-4 w-4 cursor-se-resize ${dark? 'bg-neutral-700' :'bg-neutral-300'}`}></div>
      {/* Male/Female ports */}
      <button className={`port absolute z-10 left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full border border-white shadow bg-orange-500 ${hoverPort && hoverPort.id===item.id && hoverPort.port==='female' ? 'ring-2 ring-orange-300' : ''}`}
        onMouseEnter={()=>{ (window as any).__setHoverPort && (window as any).__setHoverPort({ id:item.id, port:'female' }); }}
        onMouseLeave={()=>{ (window as any).__setHoverPort && (window as any).__setHoverPort(null); }}
        onMouseDown={(e)=>{ e.stopPropagation(); onStartLink && onStartLink('female'); }}
        onMouseUp={(e)=>{ e.stopPropagation(); onFinishLink && onFinishLink('female', item.id); }}
        title="Female port" />
      <button className={`port absolute z-10 right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-4 w-4 rounded-full border border-white shadow bg-white ${hoverPort && hoverPort.id===item.id && hoverPort.port==='male' ? 'ring-2 ring-white/60' : ''}`}
        onMouseEnter={()=>{ (window as any).__setHoverPort && (window as any).__setHoverPort({ id:item.id, port:'male' }); }}
        onMouseLeave={()=>{ (window as any).__setHoverPort && (window as any).__setHoverPort(null); }}
        onMouseDown={(e)=>{ e.stopPropagation(); onStartLink && onStartLink('male'); }}
        onMouseUp={(e)=>{ e.stopPropagation(); onFinishLink && onFinishLink('male', item.id); }}
        title="Male port" />
    </div>
  );
}

function EditableTextBlock({ item, dark, onChange }:{ item: CanvasItem, dark: boolean, onChange: (it: CanvasItem)=>void }){
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement|null>(null);
  const FONTS = [
    'font-sans',
    'font-serif',
    'font-mono',
    'font-semibold',
    'italic',
  ];
  const fontIdx = item.fontIdx || 0;
  useEffect(()=>{
    if (editing) {
      setTimeout(()=> inputRef.current?.focus(), 0);
      (window as any).__editingTextId = item.id;
    } else {
      (window as any).__editingTextId = null;
    }
  }, [editing, item.id]);
  const nextFont = () => {
    const nf = ((item.fontIdx || 0) + 1) % FONTS.length;
    onChange({ ...item, fontIdx: nf });
  };
  const scale = item.fontScale && item.fontScale > 0 ? item.fontScale : 3.2;
  return (
    <div className={`relative h-full w-full ${dark ? 'text-white' : 'text-black'}`} style={{ fontSize: `${scale * 1}rem` }}>
      <div className="absolute right-2 top-2 z-10 flex gap-2">
        <button className="rounded border px-2 py-0.5 text-[10px]" onClick={nextFont}>Aa</button>
        <button className="rounded border px-2 py-0.5 text-[10px]" onClick={()=> setEditing(e=>!e)}>{editing ? 'Done' : 'Edit'}</button>
      </div>
      {editing ? (
        <textarea
          ref={inputRef}
          className={`h-full w-full resize-none bg-transparent p-3 outline-none ${FONTS[fontIdx]}`}
          value={(item.text && item.text !== 'Double-click to edit') ? item.text : ''}
          onChange={(e)=> onChange({ ...item, text: e.target.value })}
          placeholder="Double-click to edit"
        />
      ) : (
        <div className={`h-full w-full whitespace-pre-wrap p-3 ${FONTS[fontIdx]}`} onDoubleClick={()=> setEditing(true)}>
          {(item.text && item.text !== 'Double-click to edit') ? item.text : ''}
        </div>
      )}
    </div>
  );
}
