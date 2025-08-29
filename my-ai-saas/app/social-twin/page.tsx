"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import FolderModal from "@/components/FolderModal";
import ProjectModal from "@/components/ProjectModal";
import { Button } from "@/components/ui/button";

// Utility function to safely get location origin
function getLocationOrigin(): string {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return '';
}

// Small icon-only button used across Creator Studio for a minimal aesthetic
function IconButton({ children, title, onClick, className }: { children: React.ReactNode; title?: string; onClick?: () => void; className?: string }) {
  return (
    <Button variant="ghost" size="icon" onClick={onClick} title={title} aria-label={title} className={className}>
      {children}
    </Button>
  );
}
// import GenerationsTab from "@/components/GenerationsTab"; // Merged into chat via Generated Bin
// Profile tab: keeping things lean; no colorful credit/analytics widgets here
import GenerationCostDisplay from "@/components/GenerationCostDisplay";
import { useAuth, useUser } from "@clerk/nextjs";
import { useSafeCredits } from "@/hooks/useSafeCredits";
import { cloudflareAI } from "@/lib/cloudflare-ai-new";

type ChatRole = "user" | "assistant" | "system" | "error";
type Mode = 'text'|'image'|'image-modify'|'video';

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  image?: string; // Base64 image data for vision mode
  imageUrl?: string;
  videoUrl?: string;
  pdfUrl?: string;
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
  operatorKind?: 'compile' | 'publish';
  order?: number; // insertion sequence for fallback ordering
};
 
 type Edge = {
   id: string;
   fromId: string;
   toId: string;
   fromPort: 'male' | 'female';
   toPort: 'male' | 'female';
 };
 
function SearchParamsWrapper({ children }: { children: (searchParams: URLSearchParams) => React.ReactNode }) {
  const searchParams = useSearchParams();
  return <>{children(searchParams)}</>;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center">Loading...</div>}>
      <SearchParamsWrapper>
        {(searchParams) => <PageContent searchParams={searchParams} />}
      </SearchParamsWrapper>
    </Suspense>
  );
}

function PageContent({ searchParams }: { searchParams: URLSearchParams }) {
  // Auth/user
  const { userId } = useAuth();
  const { user } = useUser();

  // UI mode and header
  const [simpleMode, setSimpleMode] = useState<boolean>(true);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [chatCollapsed, setChatCollapsed] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Providers and endpoints
  const [textProvider, setTextProvider] = useState<'social'|'openai'|'deepseek'>('social');
  const [textUrl, setTextUrl] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageModifyUrl, setImageModifyUrl] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoWanUrl, setVideoWanUrl] = useState<string>("");
  const [videoKlingUrl, setVideoKlingUrl] = useState<string>("");

  // LoRA and params
  const [loraName, setLoraName] = useState<string>(""); // Character LoRA filename
  const [loraScale, setLoraScale] = useState<number|''>(''); // Character LoRA strength
  const [effectLora, setEffectLora] = useState<string>(""); // Effects/Style LoRA filename
  const [effectLoraScale, setEffectLoraScale] = useState<number|''>(''); // Effects LoRA strength
  const [availableLoras, setAvailableLoras] = useState<any[]>([]);
  const [lorasLoading, setLorasLoading] = useState(false);
  const [batchSize, setBatchSize] = useState<number|''>('');
  const [seed, setSeed] = useState<number|''>('');
  const [aspectRatio, setAspectRatio] = useState<string>("");
  // Workflow popover and tweakable settings
  const [showWorkflowPopoverFor, setShowWorkflowPopoverFor] = useState<'image'|'image-modify'|null>(null);
  const [useFluxDev, setUseFluxDev] = useState<boolean>(true);
  const [sampler, setSampler] = useState<string>('euler');
  const [denoise, setDenoise] = useState<number|''>('');
  const [unetName, setUnetName] = useState<string>('flux1-kontext-dev.safetensors');

  // Quick Create enhanced state
  const [showQuickAdvanced, setShowQuickAdvanced] = useState<boolean>(false);
  const [sendToCanvas, setSendToCanvas] = useState<boolean>(true);
  const [saveToLibrary, setSaveToLibrary] = useState<boolean>(false);
  // Quick Create dropdown/tabs selections
  const [quickTemplateSel, setQuickTemplateSel] = useState<string>('');
  const [quickPresetSel, setQuickPresetSel] = useState<string>('');
  const [quickImageStyle, setQuickImageStyle] = useState<'cinematic'|'ultra'|'cool'|''>('');
  const [quickTextCategory, setQuickTextCategory] = useState<'instagram'|'linkedin'|'twitter'|'email'|'youtube'>('instagram');

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const [mode, setMode] = useState<Mode>('text');
  const [chatMode, setChatMode] = useState<'normal' | 'prompt' | 'creative' | 'think'>('normal');
  const [aiPersonality, setAiPersonality] = useState<'creative' | 'news' | 'police' | 'lawyer' | 'accountant' | 'teacher' | 'atom'>('atom');
  const [attached, setAttached] = useState<{ name: string; type: string; dataUrl: string } | null>(null);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [targetScrollTs, setTargetScrollTs] = useState<string | null>(null);
  const [currentTopicId, setCurrentTopicId] = useState<string | null>(null);
  const [currentTopic, setCurrentTopic] = useState<{ id: string; title: string } | null>(null);

  // Mode selection state for new UI behavior
  const [modeSelected, setModeSelected] = useState<boolean>(false);
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);

  // Mode selection handlers
  const handleModeSelect = (newMode: Mode) => {
    setMode(newMode);
    setModeSelected(true);
    setSelectedMode(newMode);
  };

  const handleModeBack = () => {
    setModeSelected(false);
    setSelectedMode(null);
    // Keep the current mode but allow switching
  };

  // Canvas/grid
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [gridEnabled, setGridEnabled] = useState<boolean>(false);
  const [gridLinesOn, setGridLinesOn] = useState<boolean>(true);
  const [gridPan, setGridPan] = useState<{ x:number; y:number }>({ x: 0, y: 0 });
  const [gridScale, setGridScale] = useState<number>(1);
  const [hoverPort, setHoverPort] = useState<{ id: string; port: 'male'|'female' } | null>(null);
  const gridSectionRef = useRef<HTMLElement | null>(null);

  // Initialize simple/pro from localStorage on first render
  useEffect(() => {
    try {
      const saved = localStorage.getItem('social_twin_simple');
      if (saved === '0') {
        setSimpleMode(false);
        setGridEnabled(true);
      } else if (saved === '1') {
        setSimpleMode(true);
      }
    } catch {}
  }, []);

  // Initialize saveToLibrary preference from localStorage
  useEffect(() => {
    try {
      const v = localStorage.getItem('social_twin_save_to_library');
      if (v === '1') setSaveToLibrary(true);
      else if (v === '0') setSaveToLibrary(false);
    } catch {}
  }, []);

  // Initialize AI personality from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ai_personality');
      if (saved && ['creative', 'news', 'police', 'lawyer', 'accountant', 'teacher'].includes(saved)) {
        setAiPersonality(saved as any);
      }
    } catch {}
  }, []);

  // Listen for AI personality changes from HamburgerMenu
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ai_personality' && e.newValue) {
        if (['creative', 'news', 'police', 'lawyer', 'accountant', 'teacher'].includes(e.newValue)) {
          setAiPersonality(e.newValue as any);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Expose and persist Simple/Pro so Navbar can toggle it from outside
  useEffect(() => {
    (window as any).__getSimpleMode = () => simpleMode;
    (window as any).__setSimpleMode = (next: boolean) => {
      setSimpleMode(next);
      if (!next) setGridEnabled(true);
      try { localStorage.setItem('social_twin_simple', next ? '1' : '0'); } catch {}
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'social_twin_simple' && e.newValue != null) {
        const next = e.newValue !== '0';
        setSimpleMode(next);
        if (!next) setGridEnabled(true);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      try {
        delete (window as any).__getSimpleMode;
        delete (window as any).__setSimpleMode;
      } catch {}
    };
  }, [simpleMode]);

  // Sidebar/topics and Generated Bin
  const [showSidebar, setShowSidebar] = useState<boolean>(false);
  const [topics, setTopics] = useState<Array<{ id:string; title:string }>>([]);
  const [showBin, setShowBin] = useState<boolean>(false);
  const [binItems, setBinItems] = useState<any[]>([]);
  const [binCursor, setBinCursor] = useState<string | null>(null);

  // Local storage keys and static choices
  const LOCAL_KEYS = {
    text: 'social_twin_text_url',
    image: 'social_twin_image_url',
    imageModify: 'social_twin_image_modify_url',
    video: 'social_twin_video_url',
    videoWan: 'social_twin_video_wan_url',
    videoKling: 'social_twin_video_kling_url',
    loraName: 'social_twin_lora_name',
    loraScale: 'social_twin_lora_scale',
    effectLora: 'social_twin_effect_lora',
    effectLoraScale: 'social_twin_effect_lora_scale',
    batchSize: 'social_twin_batch_size',
    aspectRatio: 'social_twin_aspect_ratio',
  } as const;
  
  // AI thinking phrases for more engaging loading states
  const THINKING_PHRASES = [
    "Hmmm…",
    "Ahh let's answer this…",
    "Ok let me give a thought before I answer to you…",
    "Let me see…",
    "Okay… thinking…",
    "Well… that's interesting…",
    "Hmm… I'm considering…",
    "Alright… let's figure this out…",
    "Let's see… how do I put this…",
    "Mmm… give me a moment…",
    "Okay, let's think this through…",
    "Ah… this requires some thought…",
    "Let me reason about that…",
    "Hmm… interesting question…",
    "Alright… I'm piecing it together…",
    "Let's ponder this for a second…",
    "Okay… breaking it down…",
    "Mmm… let me weigh the options…",
    "Hmmm… almost there…",
    "I see… let me think…",
    "Alright… connecting the dots…",
    "Hmm… I need a moment to process…",
    "Let's analyze this carefully…",
    "Ah… thinking out loud…",
    "Mmm… how can I explain this…",
    "Okay… forming an answer…",
    "Hmm… let me recall some info…",
    "Ah… there's more to consider…",
    "Let's see… what's the best way…",
    "Hmm… let me reason it step by step…",
    "Alright… weighing possibilities…",
    "Mmm… thinking through it…",
    "Hmmm… let me examine that…",
    "Okay… trying to make sense of this…",
    "Ah… I'm figuring it out…",
    "Hmm… let me reflect on that…",
    "Alright… I'm considering your request…",
    "Mmm… let's break it down slowly…",
    "Hmmm… thinking carefully…",
    "Okay… let me sort through that…",
    "Ah… almost there…",
    "Hmm… I see what you mean…",
    "Alright… let me think step by step…",
    "Mmm… this is interesting…",
    "Hmmm… connecting ideas…",
    "Okay… let me map this out…",
    "Ah… thinking about the best answer…",
    "Hmm… let me reason this…",
    "Alright… I'm reflecting on your question…",
    "Mmm… let's think this through carefully…",
    "Hmmm… almost figured it out…",
    "Okay… just a bit more thinking…",
    "Ah… I'm processing that idea…",
    "Mmm… let me explore the possibilities…"
  ];
  
  // Fixed: AR_CHOICES now match desktop with 3:2 and 2:3 ratios
  // Fixed: BATCH_CHOICES now match desktop [1,2,4,8] 
  // Fixed: LORA_CHOICES now load dynamically from API
  // Deployment: 2025-08-24 - Force cache refresh
  const LORA_CHOICES = ['None','Custom...'] as const;
  const BATCH_CHOICES = [1,2,4,8] as const;
  const AR_CHOICES = ['1:1','3:2','4:3','16:9','9:16','2:3'] as const;
  const isPresetLoRa = (name: string) => {
    return (LORA_CHOICES as readonly string[]).includes(name) || 
           availableLoras.some(lora => lora.filename === name);
  };

  // Id helper
  const generateId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  // Get random thinking phrase
  const getRandomThinkingPhrase = () => {
    return THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)];
  };

  // Animate thinking phrases
  const [currentThinkingPhrase, setCurrentThinkingPhrase] = useState("");
  const thinkingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startThinkingAnimation = (messageId: string) => {
    const updatePhrase = () => {
      const newPhrase = getRandomThinkingPhrase();
      setCurrentThinkingPhrase(newPhrase);
      
      // Update the message content with the new thinking phrase
      setMessages(prev => prev.map(msg => 
        msg.id === messageId && msg.loading 
          ? { ...msg, content: newPhrase }
          : msg
      ));
    };

    // Start with first phrase immediately
    updatePhrase();
    
    // Then update every 1.5-3 seconds for variety
    thinkingIntervalRef.current = setInterval(() => {
      updatePhrase();
    }, 1500 + Math.random() * 1500); // Random between 1.5-3 seconds
  };

  const stopThinkingAnimation = () => {
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
    }
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => stopThinkingAnimation();
  }, []);

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
  const folderModalPayload = useRef<{ url: string; type: 'image'|'video'|'pdf'; prompt?: string }|null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(false);
  const [viewer, setViewer] = useState<{ open: boolean; src: string; ref?: string; gallery?: string[] }>({ open: false, src: '' });
  // Compile modal state
  const [compileOpen, setCompileOpen] = useState<boolean>(false);
  const [compileChain, setCompileChain] = useState<Array<{ url:string; type:'video' }>>([]);
  const [compileOriginId, setCompileOriginId] = useState<string | null>(null);
  const [compileAR, setCompileAR] = useState<'16:9'|'1:1'|'9:16'>('16:9');
  // Compose (PDF/PPT) modal
  const [composeOpen, setComposeOpen] = useState<boolean>(false);
  const [composeSize, setComposeSize] = useState<'A4P'|'A4L'|'16:9'>('A4P');
  const [composePages, setComposePages] = useState<Array<{ images: Array<{ url:string }>; texts: Array<{ content:string }> }>>([]);
  const [composeOriginId, setComposeOriginId] = useState<string | null>(null);
  const [imgTab, setImgTab] = useState<'effects'|'character'>('effects');
  const [effectsOn, setEffectsOn] = useState<boolean>(false);
  const [characterOn, setCharacterOn] = useState<boolean>(false);
  const [effectsPreset, setEffectsPreset] = useState<'off'|'subtle'|'cinematic'|'stylized'>('off');
  const [cfgScale, setCfgScale] = useState<number | ''>('');
  const [guidance, setGuidance] = useState<number | ''>('');
  const [steps, setSteps] = useState<number | ''>('');
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);
  const [showAdvancedControls, setShowAdvancedControls] = useState<boolean>(false);
  const [videoModel, setVideoModel] = useState<'ltxv'|'kling'|'wan'>('ltxv');
  const [activeTab, setActiveTab] = useState<'chat' | 'generated' | 'dashboard' | 'news'>('chat');
  // Dashboard collapsibles
  const [dashOverviewOpen, setDashOverviewOpen] = useState(true);
  const [dashSettingsOpen, setDashSettingsOpen] = useState(false);
  const [dashProjectsOpen, setDashProjectsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generationCost, setGenerationCost] = useState<number>(0);
  const [canAffordGeneration, setCanAffordGeneration] = useState<boolean>(true);
  const [lowDataMode, setLowDataMode] = useState<boolean>(true);
  const [mediaAllowed, setMediaAllowed] = useState<Set<string>>(() => new Set());
  
  // Generated content viewer state
  const [viewerOpen, setViewerOpen] = useState<boolean>(false);
  const [viewerItem, setViewerItem] = useState<any>(null);
  const [viewerDetailsOpen, setViewerDetailsOpen] = useState<boolean>(false);
  // Hover state for showing video controls only on hover in Generated grid
  const [hoverVideoIds, setHoverVideoIds] = useState<Set<string>>(() => new Set());

  // News tab state
  const [newsArticles, setNewsArticles] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState<boolean>(false);
  const [newsCategory, setNewsCategory] = useState<string>('technology');
  const [newsError, setNewsError] = useState<string>('');
  const [newsSearch, setNewsSearch] = useState<string>('');
  const [newsView, setNewsView] = useState<'cards' | 'list'>('cards');
  const [bookmarkedArticles, setBookmarkedArticles] = useState<Set<string>>(new Set());
  const [imageLoadingStates, setImageLoadingStates] = useState<Map<string, boolean>>(new Map());
  const [imageErrorStates, setImageErrorStates] = useState<Map<string, boolean>>(new Map());
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [articleModalOpen, setArticleModalOpen] = useState<boolean>(false);

  // Reset viewer details when opening a new item
  useEffect(() => {
    if (viewerOpen) setViewerDetailsOpen(false);
  }, [viewerOpen, viewerItem]);
  
  const { creditInfo, refresh: refreshCredits } = useSafeCredits();
  
  // Utility function for API calls that may deduct credits
  const handleCreditDeductingAPI = async <T,>(apiCall: () => Promise<T>, alwaysRefresh = false): Promise<T> => {
    try {
      const result = await apiCall();
      // Always refresh credits after successful API calls from known credit-deducting endpoints
      // This ensures UI stays in sync regardless of whether credits were actually deducted
      if (alwaysRefresh) {
        refreshCredits();
      }
      return result;
    } catch (error) {
      // Don't refresh on errors
      throw error;
    }
  };
  
  const [projects, setProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState<boolean>(false);

  // News fetching function with multiple APIs and Supabase caching
  const fetchNews = async (category: string = 'technology') => {
    setNewsLoading(true);
    setNewsError('');

    try {
      // First, try to load from Supabase cache if it's less than 20 minutes old
      let cachedArticles = null;
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(supabaseUrl, supabaseKey);

          const { data: cacheData, error } = await supabase
            .from('news_cache')
            .select('articles, updated_at')
            .eq('category', category)
            .single();

          if (!error && cacheData) {
            const cacheAge = Date.now() - new Date(cacheData.updated_at).getTime();
            const twentyMinutes = 20 * 60 * 1000;

            if (cacheAge < twentyMinutes) {
              // Use cached data
              cachedArticles = JSON.parse(cacheData.articles);
              console.log(`Using cached news for ${category} (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
            }
          }
        }
      } catch (error) {
        console.log('Cache check failed:', error);
      }

      // If we have valid cached data, use it
      if (cachedArticles && cachedArticles.length > 0) {
        setNewsArticles(cachedArticles);
        setNewsLoading(false);
        return;
      }

      // Otherwise, fetch fresh data from APIs
      let articles = [];

      // 1. Try NewsAPI.org first
      try {
        const newsApiKey = process.env.NEXT_PUBLIC_NEWS_API_KEY || '3bf80b934d154d3790c54f292c2a81a9';
        const response = await fetch(
          `https://newsapi.org/v2/top-headlines?category=${category}&country=us&apiKey=${newsApiKey}&pageSize=15`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.articles && data.articles.length > 0) {
            articles = data.articles.map((article: any) => ({
              ...article,
              source: { name: article.source?.name || 'NewsAPI' },
              apiSource: 'NewsAPI'
            }));
          }
        }
      } catch (error) {
        console.log('NewsAPI failed:', error);
      }

      // 2. Try GNews.io if NewsAPI didn't return enough articles
      if (articles.length < 10) {
        try {
          const gnewsApiKey = process.env.NEXT_PUBLIC_GNEWS_IO_KEY || 'a8bcacc75413f60e5087c825d04e5c6a';
          const response = await fetch(
            `https://gnews.io/api/v4/top-headlines?category=${category}&lang=en&country=us&max=15&apikey=${gnewsApiKey}`
          );

          if (response.ok) {
            const data = await response.json();
            if (data.articles && data.articles.length > 0) {
              const gnewsArticles = data.articles.map((article: any) => ({
                ...article,
                source: { name: article.source?.name || 'GNews' },
                apiSource: 'GNews'
              }));

              // Merge with existing articles, avoiding duplicates
              const existingUrls = new Set(articles.map((a: any) => a.url));
              const uniqueGnewsArticles = gnewsArticles.filter((article: any) => !existingUrls.has(article.url));
              articles = [...articles, ...uniqueGnewsArticles].slice(0, 20);
            }
          }
        } catch (error) {
          console.log('GNews.io failed:', error);
        }
      }

      // 3. Try NewsData.io as final fallback
      if (articles.length < 10) {
        try {
          const newsDataApiKey = process.env.NEXT_PUBLIC_NEWSDATA_KEY || 'pub_22f3393a92744498a4535f2e65643d95';
          const response = await fetch(
            `https://newsdata.io/api/1/news?category=${category}&language=en&size=15&apikey=${newsDataApiKey}`
          );

          if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
              const newsDataArticles = data.results.map((article: any) => ({
                title: article.title,
                description: article.description || article.content?.substring(0, 200) + '...',
                url: article.link,
                urlToImage: article.image_url,
                publishedAt: article.pubDate,
                source: { name: article.source_id || 'NewsData' },
                apiSource: 'NewsData'
              }));

              // Merge with existing articles, avoiding duplicates
              const existingUrls = new Set(articles.map((a: any) => a.url));
              const uniqueNewsDataArticles = newsDataArticles.filter((article: any) => !existingUrls.has(article.url));
              articles = [...articles, ...uniqueNewsDataArticles].slice(0, 20);
            }
          }
        } catch (error) {
          console.log('NewsData.io failed:', error);
        }
      }

      // Process articles to add better image handling
      articles = articles.map((article: any) => ({
        ...article,
        // Enhance image URLs with proxy support and fallbacks
        urlToImage: article.urlToImage ? getDisplayUrl(article.urlToImage) : null,
        rawImageUrl: article.urlToImage, // Keep original for fallbacks
        // Add image loading state
        imageLoaded: false,
        imageError: false
      }));

      // Cache articles in Supabase for 20-minute intervals
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(supabaseUrl, supabaseKey);

          // Store news in Supabase
          const { error } = await supabase
            .from('news_cache')
            .upsert({
              category,
              articles: JSON.stringify(articles),
              updated_at: new Date().toISOString()
            });

          if (error) {
            console.log('Supabase cache error:', error);
          }
        }
      } catch (error) {
        console.log('Supabase caching failed:', error);
      }

      setNewsArticles(articles);
    } catch (error) {
      console.error('News fetch error:', error);
      setNewsError(error instanceof Error ? error.message : 'Failed to load news. Please try again later.');
      setNewsArticles([]);
    } finally {
      setNewsLoading(false);
    }
  };

  // Load news when tab becomes active or category changes
  useEffect(() => {
    if (activeTab === 'news') {
      fetchNews(newsCategory);
    }
  }, [activeTab, newsCategory]);

  // Auto-refresh news every 20 minutes
  useEffect(() => {
    if (activeTab !== 'news') return;

    const interval = setInterval(() => {
      fetchNews(newsCategory);
    }, 20 * 60 * 1000); // 20 minutes

    return () => clearInterval(interval);
  }, [activeTab, newsCategory]);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [modeRowExpanded, setModeRowExpanded] = useState(false);
  // Helper: format relative time like "3h ago"
  function formatRelativeTime(dateInput: string | number | Date | null | undefined): string {
    try {
      if (!dateInput) return '';
      const ts = new Date(dateInput).getTime();
      if (isNaN(ts)) return '';
      const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDay = Math.floor(diffHr / 24);
      if (diffDay < 7) return `${diffDay}d ago`;
      const diffWk = Math.floor(diffDay / 7);
      if (diffWk < 4) return `${diffWk}w ago`;
      const diffMo = Math.floor(diffDay / 30);
      if (diffMo < 12) return `${diffMo}mo ago`;
      const diffYr = Math.floor(diffDay / 365);
      return `${diffYr}y ago`;
    } catch {
      return '';
    }
  }
  // Library Modal state and functions
  const [showLibraryModal, setShowLibraryModal] = useState<boolean>(false);
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [libraryLoading, setLibraryLoading] = useState<boolean>(false);

  // Function to load user's library items
  const loadUserLibrary = async () => {
    if (!userId) return;
    
    setLibraryLoading(true);
    try {
      const r = await fetch(`/api/social-twin/history?limit=48`, { 
        headers: { 'X-User-Id': userId || '' } 
      });
      if (!r.ok) {
        console.error('Failed to load library:', r.status);
        return;
      }
      const j = await r.json().catch(() => ({ items: [] }));
      const items = Array.isArray(j.items) ? j.items : [];
      setLibraryItems(items);
      // Also update binItems for consistency
      setBinItems(items);
      setBinCursor(j.nextCursor || null);
    } catch (error) {
      console.error('Error loading user library:', error);
    } finally {
      setLibraryLoading(false);
    }
  };

  // Load library when modal opens
  useEffect(() => {
    if (showLibraryModal && userId) {
      loadUserLibrary();
    }
  }, [showLibraryModal, userId]);
  const [composerShown, setComposerShown] = useState<boolean>(false);
  
  // Linking preview state for canvas connections
  const [linking, setLinking] = useState<{ id: string; port: 'male'|'female' } | null>(null);
  const [linkPos, setLinkPos] = useState<{ x:number; y:number }>({ x: 0, y: 0 });

  // PDF Editor state
  const [pdfEditorOpen, setPdfEditorOpen] = useState(false);
  const [pdfImages, setPdfImages] = useState<Array<{ id: string; url: string; x: number; y: number; w: number; h: number }>>([]);
  const [pdfPageSize, setPdfPageSize] = useState<'A4' | 'Letter'>('A4');
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [pdfBackgroundColor, setPdfBackgroundColor] = useState<string>('#ffffff');
  const [pdfPages, setPdfPages] = useState<Array<{
    id: string;
    items: Array<{
      id: string;
      type: 'image' | 'text';
      url?: string;
      text?: string;
      x: number;
      y: number;
      w: number;
      h: number;
      fontSize?: number;
      fontFamily?: string;
      fontColor?: string;
      fontWeight?: 'normal' | 'bold';
      textAlign?: 'left' | 'center' | 'right';
    }>;
  }>>([]);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [storyboardOpen, setStoryboardOpen] = useState(false);
  
  // Director's Desk State
  const [directorMode, setDirectorMode] = useState<'gallery' | 'storyboard'>('gallery'); // Phase 1: Gallery, Phase 2: Storyboard
  const [imageGallery, setImageGallery] = useState<Array<{
    id: string;
    url: string;
    prompt: string;
    createdAt: string;
    style: string;
  }>>([]);
  const [batchPrompt, setBatchPrompt] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<string>('cinematic');
  const [isGeneratingBatch, setIsGeneratingBatch] = useState<boolean>(false);
  const [storyboardLocked, setStoryboardLocked] = useState<boolean>(false);
  
  const [storyboardFrames, setStoryboardFrames] = useState<Array<{
    id: string;
    imageUrl: string;
    title: string;
    duration: number;
    motionPreset: string;
    transition: string;
    character: string;
    background: string;
    action: string;
    cameraStyle: string;
    lookDirection: string;
    strength: number;
    seed: number;
    status: 'idle' | 'rendering' | 'done' | 'error';
    progress?: number;
  }>>([]);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0);
  const [globalSettings, setGlobalSettings] = useState({
    resolution: '1080p',
    fps: 24,
    aspect: '16:9',
    lengthCap: 7,
    stylePreset: 'Cinematic Alexa LF',
    cfg: 6.5,
    lora: 'Ayub-Ray 0.8',
    transitions: 'Auto',
    music: 'None',
    watermark: false,
    backend: 'ComfyUI @ localhost:8188',
    queueMode: 'Parallel'
  });
  const [linkAnim, setLinkAnim] = useState<number>(0);

  // Bridge context-menu and hover port setters for child items
  useEffect(()=>{
    (window as any).__setGridMenu = (v: any) => setMenu(v);
    (window as any).__setHoverPort = (v: any) => setHoverPort(v);
    return ()=>{
      try { delete (window as any).__setGridMenu; delete (window as any).__setHoverPort; } catch {}
    };
  }, []);

  // Mobile viewport height handling
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);

    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);

  // Handle mobile menu interactions (escape key and outside clicks)
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    // Prevent body scroll when mobile menu is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileMenuOpen]);

  // Animate wind lines continuously - throttled to reduce re-renders
  const linkAnimRef = useRef<number>(0);
  useEffect(()=>{
    let raf: number | null = null;
    const tick = () => { 
      linkAnimRef.current += 1;
      // Only update state every 10 frames to reduce re-renders
      if (linkAnimRef.current % 10 === 0) {
        setLinkAnim(linkAnimRef.current);
      }
      raf = requestAnimationFrame(tick); 
    };
    raf = requestAnimationFrame(tick);
    return ()=>{ if (raf!=null) cancelAnimationFrame(raf); };
  }, []);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const bottomInputRef = useRef<HTMLTextAreaElement | null>(null);
  async function saveCurrentProject(title?: string) {
    try {
      // Validation: Make sure there's something to save
      if (messages.length === 0 && canvasItems.length === 0) {
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'assistant',
          content: `❌ **Nothing to Save**\n\nYour project is empty. Create some content first:\n• Send a chat message\n• Generate images or videos\n• Add items to the grid\n\nThen try saving again!`,
          createdAt: new Date().toISOString()
        }]);
        setProjectModalOpen(false);
        return;
      }

      // Enhanced project saving - include both grid and chat data
      const gridData = { items: canvasItems || [], edges: edges || [] };
      
      // Filter out system/success messages when saving to avoid cascade
      const filteredMessages = messages.filter(msg => 
        !(msg.content.includes('Project Saved Successfully') || 
          msg.content.includes('Project') && msg.content.includes('Loaded') ||
          msg.content.includes('Enhanced Project Saved') ||
          msg.content.includes('Restoration Complete'))
      );
      
      const chatData = { 
        messages: filteredMessages, // Save only actual conversation messages
        topic: currentTopic ? { id: currentTopic.id, title: currentTopic.title } : null,
        messageCount: filteredMessages.length
      };
      
      console.log('💾 SAVING PROJECT:');
      console.log('Total messages before filter:', messages.length);
      console.log('Filtered messages to save:', filteredMessages.length);
      console.log('Grid data:', gridData);
      console.log('Chat data:', chatData);
      
      const thumb = canvasItems.find(i=> i.type==='image' || i.type==='video') as any;
      const thumbnailUrl = thumb?.url ? (getRawUrl(thumb.url) || thumb.url) : undefined;
      
      // Try enhanced projects API first
      try {
        console.log('About to fetch enhanced-projects API...');
        
        const res = await fetch('/api/social-twin/enhanced-projects', {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' },
          body: JSON.stringify({ 
            title: (title || currentProjectTitle || 'Untitled Project'), 
            gridData,
            chatData,
            topicId: currentTopic?.id || null,
            thumbnailUrl 
          })
        }).catch(fetchError => {
          console.error('Fetch error:', fetchError);
          throw new Error(`Network error: ${fetchError.message}`);
        });
        
        console.log('Fetch completed, response:', res);
        
        if (!res.ok) {
          console.error('Enhanced save failed with status:', res.status);
          const errorText = await res.text();
          console.error('Error response:', errorText);
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        
        const j = await res.json().catch(()=> ({} as any));
        if (res.ok) {
          setCurrentProjectId(j.id || j.projectId || null);
          setCurrentProjectTitle(j.title || (title || currentProjectTitle || null));
          setShowSaveProject(false);
          setProjectModalOpen(false);
          
          // Refresh projects list
          loadProjects();
          
          // Add success message to chat
          setMessages(prev => [...prev, {
            id: generateId(),
            role: 'assistant',
            content: `✅ **Project Saved Successfully!**\n\n**"${j.title || title || 'Untitled'}"** now includes:\n• 💬 **${messages.length} chat messages** - Full conversation preserved\n• 🎨 **${canvasItems.length} grid items** - All images, videos, and layouts saved\n• 🔗 **Grid connections** - All links and relationships maintained\n\n*When you reload this project, both your chat history and grid layout will be exactly as you left them.*`,
            createdAt: new Date().toISOString()
          }]);
          return;
        }
      } catch (enhancedError) {
        console.warn('Enhanced save failed, falling back to legacy:', enhancedError);
      }
      
      // Fallback to legacy save if enhanced fails
      const payload = { items: canvasItems, edges };
      const res = await fetch('/api/social-twin/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' },
        body: JSON.stringify({ title: (title || currentProjectTitle || 'Untitled Project'), data: payload, thumbnailUrl })
      });
      const j = await res.json().catch(()=> ({} as any));
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setCurrentProjectId(j.id || j.projectId || null);
      setCurrentProjectTitle(j.title || (title || currentProjectTitle || null));
      setShowSaveProject(false);
      setProjectModalOpen(false);
      
      // Refresh projects list
      loadProjects();
    } catch (e:any) {
      console.error('Save project failed:', e);
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'error',
        content: `❌ **Save Failed**\n\nError: ${e?.message || 'Unknown error'}\n\nPlease try again. If the problem persists, check your internet connection.`,
        createdAt: new Date().toISOString()
      }]);
      setProjectModalOpen(false);
    }
  }

  async function updateExistingProject() {
    if (!currentProjectId) { await saveCurrentProject(); return; }
    try {
      const payload = { items: canvasItems, edges };
      const thumb = canvasItems.find(i=> i.type==='image' || i.type==='video') as any;
      const thumbnailUrl = thumb?.url ? (getRawUrl(thumb.url) || thumb.url) : undefined;
      const res = await fetch('/api/social-twin/projects', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' },
        body: JSON.stringify({ id: currentProjectId, data: payload, thumbnailUrl })
      });
      const j = await res.json().catch(()=> ({} as any));
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setShowSaveProject(false);
      setProjectModalOpen(false);
    } catch (e:any) {
      console.error('update project failed', e);
    }
  }
  async function loadProjects() {
    try {
      setProjectsLoading(true);
      const r = await fetch('/api/social-twin/projects', { headers: { 'X-User-Id': userId || '' } });
      const j = await r.json().catch(() => ({} as any));
      setProjects(Array.isArray(j.projects) ? j.projects : []);
    } catch {
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }

  // Switch to a different project - ROBUST IMPLEMENTATION
  async function switchToProject(projectId: string, projectTitle: string) {
    try {
      console.log('🔄 SWITCHING TO PROJECT:', projectId, projectTitle);
      
      // Try enhanced projects API first (handles both chat and grid)
      let project = null;
      try {
        const r = await fetch(`/api/social-twin/enhanced-projects/${projectId}`, { 
          headers: { 'X-User-Id': userId || '' } 
        });
        if (r.ok) {
          project = await r.json();
          console.log('✅ Enhanced project loaded:', project);
        }
      } catch (enhancedError) {
        console.warn('Enhanced API failed, trying legacy:', enhancedError);
      }
      
      // Fallback to legacy API if enhanced fails
      if (!project) {
        const r = await fetch(`/api/social-twin/projects/${projectId}`, { 
          headers: { 'X-User-Id': userId || '' } 
        });
        if (!r.ok) {
          console.error('Failed to load project from both APIs');
          return;
        }
        project = await r.json();
        console.log('📦 Legacy project loaded:', project);
      }
      
      // Update current project info
      setCurrentProjectId(projectId);
      setCurrentProjectTitle(projectTitle);
      
      // Load chat data (enhanced format first, then legacy)
      if (project.chatData?.messages) {
        console.log('💬 Loading enhanced chat data:', project.chatData.messages.length, 'messages');
        setMessages(project.chatData.messages);
        
        // Restore topic if available
        if (project.chatData.topic) {
          setCurrentTopic(project.chatData.topic);
        }
      } else if (project.data?.messages) {
        console.log('💬 Loading legacy chat data:', project.data.messages.length, 'messages');
        setMessages(project.data.messages);
      } else {
        console.log('💬 No chat data found, starting fresh');
        setMessages([]);
      }
      
      // Load grid data (enhanced format first, then legacy)
      if (project.gridData?.items) {
        console.log('🎨 Loading enhanced grid data:', project.gridData.items.length, 'items');
        setCanvasItems(project.gridData.items);
        setEdges(project.gridData.edges || []);
      } else if (project.data?.canvasItems) {
        console.log('🎨 Loading legacy grid data:', project.data.canvasItems.length, 'items');
        setCanvasItems(project.data.canvasItems);
        setEdges(project.data.edges || []);
      } else if (project.data?.items) {
        console.log('🎨 Loading legacy items data:', project.data.items.length, 'items');
        setCanvasItems(project.data.items);
        setEdges(project.data.edges || []);
      } else {
        console.log('🎨 No grid data found, starting fresh');
        setCanvasItems([]);
        setEdges([]);
      }
      
      // Close dropdown
      setProjectDropdownOpen(false);
      
      // Add confirmation message to chat
      const chatMessagesCount = project.chatData?.messages?.length || project.data?.messages?.length || 0;
      const gridItemsCount = project.gridData?.items?.length || project.data?.canvasItems?.length || project.data?.items?.length || 0;
      
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `✅ **Project Loaded: "${projectTitle}"**\n\n🔄 **Restoration Complete:**\n• 💬 **${chatMessagesCount} chat messages** restored\n• 🎨 **${gridItemsCount} canvas items** restored\n• 🔗 **All connections** maintained\n\n*You're now working in the "${projectTitle}" project. All your previous work has been restored.*`,
        createdAt: new Date().toISOString()
      }]);
      
      console.log('🎉 Project switch completed successfully!');
      
    } catch (error) {
      console.error('❌ Error switching project:', error);
      
      // Show error to user
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'error',
        content: `❌ **Failed to Load Project**\n\nError loading "${projectTitle}": ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or contact support if the issue persists.`,
        createdAt: new Date().toISOString()
      }]);
    }
  }

  // Auto-save current project when messages change (to prevent data loss)
  async function autoSaveProject() {
    // Only auto-save if we're in an existing project with content
    if (!currentProjectId || !currentProjectTitle || messages.length === 0) return;
    
    try {
      console.log('🔄 Auto-saving project:', currentProjectTitle);
      
      const gridData = { items: canvasItems || [], edges: edges || [] };
      const filteredMessages = messages.filter(msg => 
        !(msg.content.includes('Project Saved Successfully') || 
          msg.content.includes('Auto-saved') ||
          msg.content.includes('Project') && msg.content.includes('Loaded'))
      );
      
      const chatData = { 
        messages: filteredMessages,
        topic: currentTopic ? { id: currentTopic.id, title: currentTopic.title } : null,
        messageCount: filteredMessages.length
      };
      
      // Update existing project silently
      await fetch(`/api/social-twin/enhanced-projects/${currentProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' },
        body: JSON.stringify({ 
          title: currentProjectTitle,
          gridData,
          chatData,
          topicId: currentTopic?.id || null
        })
      });
      
      console.log('✅ Auto-save completed');
    } catch (error) {
      console.warn('Auto-save failed:', error);
    }
  }

  // Refresh the Generated tab by fetching the latest history for this user.
  async function refreshGeneratedHistory(limit = 24) {
    try {
      if (!userId) return;
      const r = await fetch(`/api/social-twin/history?limit=${limit}`, { headers: { 'X-User-Id': userId || '' } });
      if (!r.ok) return;
      const j = await r.json().catch(() => ({} as any));
      const items = Array.isArray(j.items) ? j.items : (j.items || []);
      if (!items.length) return;
      setBinItems(prev => {
        // merge newest items while avoiding duplicates by id
        const existingIds = new Set(prev.map((it: any) => it.id));
        const newItems = items.filter((it: any) => !existingIds.has(it.id));
        // Prepend newest items
        const merged = [...newItems, ...prev];
        // Keep to reasonable length
        return merged.slice(0, Math.max(limit, merged.length));
      });
    } catch (e) {
      // ignore
    }
  }

  // Auto-load projects when opening the Dashboard -> Projects collapsible
  useEffect(() => {
    if (dashProjectsOpen && projects.length === 0) {
      loadProjects();
    }
  }, [dashProjectsOpen, userId]);

  useEffect(() => {
    if (activeTab === 'generated') {
      // Always load generated items when switching to Generated tab (to show latest data)
      fetch('/api/social-twin/history?limit=24', { headers: { 'X-User-Id': userId || '' } })
        .then(r => r.json())
        .then(j => {
          setBinItems(j.items || []);
          setBinCursor(j.nextCursor || null);
        })
        .catch(() => {});
    }
  }, [activeTab, userId]);

  // Close project dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (projectDropdownOpen) {
        const target = event.target as Element;
        const dropdown = target.closest('[data-project-dropdown]');
        if (!dropdown) {
          setProjectDropdownOpen(false);
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [projectDropdownOpen]);

  // Auto-save when messages change (debounced to avoid excessive API calls)
  useEffect(() => {
    if (messages.length === 0) return;
    
    const autoSaveTimer = setTimeout(() => {
      autoSaveProject();
    }, 3000); // Auto-save 3 seconds after last message
    
    return () => clearTimeout(autoSaveTimer);
  }, [messages, canvasItems, currentProjectId, currentProjectTitle]);

  // Load project from URL if projectId is provided
  useEffect(() => {
    const projectId = searchParams?.get('projectId');
    if (!projectId || !userId) return;
    
    (async () => {
      try {
        // Clear existing messages and canvas first to ensure clean slate
        setMessages([]);
        setCanvasItems([]);
        setEdges([]);
        setCurrentTopic(null);
        setCurrentTopicId(null);
        setCurrentProjectId(null);
        setCurrentProjectTitle(null);
        
        // Try enhanced projects API first
        try {
          const res = await fetch('/api/social-twin/enhanced-projects', {
            method: 'PATCH',
            headers: { 
              'Content-Type': 'application/json', 
              'X-User-Id': userId 
            },
            body: JSON.stringify({ projectId })
          });
          
          if (res.ok) {
            const data = await res.json();
            console.log('📂 LOADING PROJECT:');
            console.log('Full API response:', data);
            
            // Restore grid data - check both the API response format and stored format
            const gridData = data.gridData || data.project?.gridData;
            console.log('Grid data found:', gridData);
            if (gridData?.items) {
              console.log('Restoring grid items:', gridData.items.length, 'items');
              setCanvasItems(gridData.items);
              if (gridData.edges) setEdges(gridData.edges);
            }
            
            // Restore chat data - ONLY the messages saved with this project
            const chatData = data.chatData || data.project?.chatData;
            console.log('Chat data found:', chatData);
            console.log('Messages in chat data:', chatData?.messages?.length || 0);
            if (chatData?.messages && Array.isArray(chatData.messages)) {
              console.log('Restoring chat messages:', chatData.messages.length, 'messages');
              console.log('First few messages:', chatData.messages.slice(0, 3));
              setMessages(chatData.messages);
              // Set topic if available
              if (chatData.topic) {
                setCurrentTopic(chatData.topic);
                setCurrentTopicId(chatData.topic.id);
              }
            } else {
              console.log('No chat messages found or invalid format');
            }
            
            // Set project info
            if (data.project) {
              setCurrentProjectId(data.project.id);
              setCurrentProjectTitle(data.project.title);
            }
            
            // Switch to Pro mode if loading a project
            setSimpleMode(false);
            setGridEnabled(true);
            
            // Add success message to chat AFTER restoring messages
            const restoredMessageCount = chatData?.messages?.length || 0;
            const successMessage = {
              id: generateId(),
              role: 'assistant' as const,
              content: `${data.project?.title || 'Project'} is activated, let's create`,
              createdAt: new Date().toISOString()
            };
            
            // Use setTimeout to ensure messages are restored before adding success message
            setTimeout(() => {
              setMessages(prev => {
                console.log('Adding success message to', prev.length, 'existing messages');
                return [...prev, successMessage];
              });
            }, 100);
            
            return;
          }
        } catch (enhancedError) {
          console.warn('Enhanced project loading failed, trying legacy:', enhancedError);
        }
        
        // Fallback to legacy project loading
        const res = await fetch(`/api/social-twin/projects/${encodeURIComponent(projectId)}`, {
          headers: { 'X-User-Id': userId }
        });
        
        if (res.ok) {
          const data = await res.json();
          console.log('Loading legacy project:', data);
          
          // Restore grid items (legacy projects don't have chat data)
          if (data.data?.items) {
            setCanvasItems(data.data.items);
            if (data.data.edges) setEdges(data.data.edges);
          }
          
          // Set project info
          setCurrentProjectId(data.id);
          setCurrentProjectTitle(data.title);
          
          // Switch to Pro mode
          setSimpleMode(false);
          setGridEnabled(true);
          
          // Add activation message (no chat history for legacy projects)
          setMessages([{
            id: generateId(),
            role: 'assistant',
            content: `${data.title || 'Project'} is activated, let's create`,
            createdAt: new Date().toISOString()
          }]);
        }
        
      } catch (error) {
        console.error('Failed to load project:', error);
        setMessages([{
          id: generateId(),
          role: 'error',
          content: '❌ Failed to load project. Please try again.',
          createdAt: new Date().toISOString()
        }]);
      }
    })();
  }, [searchParams, userId]);

  // Show welcome modal on first visit (no projectId, no messages, authenticated)
  // Only show if user is not loading a project and has empty state
  useEffect(() => {
    const projectId = searchParams?.get('projectId');
    if (!projectId && userId && messages.length === 0 && canvasItems.length === 0) {
      // Small delay to let the page settle and ensure no project is being loaded
      const timer = setTimeout(() => {
        // Double-check that no project loading is in progress
        if (messages.length === 0 && canvasItems.length === 0) {
          setShowWelcomeModal(true);
        }
      }, 1500); // Increased delay to ensure project loading has time to complete
      return () => clearTimeout(timer);
    }
  }, [userId, messages.length, canvasItems.length, searchParams]);

  function getDisplayUrl(raw?: string | null): string | undefined {
    if (!raw) return undefined;
    try {
      // R2 URLs are already public and don't need proxying
      if (raw.includes('r2.cloudflarestorage.com') || raw.includes(process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '')) {
        return raw;
      }
      // Only proxy external URLs that are not from our domain
      if (typeof window !== 'undefined' && /^https?:\/\//i.test(raw) && !raw.startsWith(getLocationOrigin())) {
        return `/api/social-twin/proxy?url=${encodeURIComponent(raw)}`;
      }
    } catch {}
    return raw;
  }

  function getRawUrl(display?: string | null): string | undefined {
    try {
      const m = /^\/api\/social-twin\/proxy\?url=(.*)$/i.exec(display || '');
      if (m) return decodeURIComponent(m[1]);
    } catch {}
    return display || undefined;
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
    // Collect all connected images and text from orange string connections
    const connectedItems = getConnectedItemsForPDF(nodeId);
    
    if (connectedItems.length > 0) {
      // Go straight to the PDF layout editor
      const firstPage = {
        id: generateId(),
        items: connectedItems.map(item => ({
          id: generateId(),
          type: item.type as 'image' | 'text',
          url: item.url,
          text: item.text,
          // Scale down canvas coordinates to fit PDF (A4 is ~595x842 pts)
          x: Math.max(10, (item.x * 0.7) % 500),
          y: Math.max(10, (item.y * 0.7) % 700),
          w: Math.min(item.w * 0.7, 400),
          h: Math.min(item.h * 0.7, 300),
          fontSize: item.type === 'text' ? Math.max(12, (item.fontScale || 1) * 16) : undefined,
          fontFamily: 'Arial',
          fontColor: '#000000',
          fontWeight: 'normal' as const,
          textAlign: 'left' as const
        }))
      };
      
      setPdfPages([firstPage]);
      setCurrentPage(0);
      setPdfEditorOpen(true);
    } else {
      // No connected items found
      setMessages(prev=> [...prev, { 
        id: generateId(), 
        role:'assistant', 
        content:'No images or text connected. Connect items using the orange string (male port → female port) and try again.', 
        createdAt: new Date().toISOString() 
      }]);
    }
  }

  async function exportPdfFromCanvas(nodeId: string) {
    try {
      const r = await fetch('/api/social-twin/export-pdf-from-canvas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' },
        body: JSON.stringify({ 
          nodeId,
          canvasItems,
          edges,
          fileName: 'canvas_export.pdf' 
        })
      });
      
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      
      const url = j.url as string;
      setMessages(prev=> [...prev, { 
        id: generateId(), 
        role:'assistant', 
        content: j.message || `PDF exported with ${j.connectedItems || 0} connected items`, 
        pdfUrl: url, 
        createdAt: new Date().toISOString() 
      }]);
      
      // Note: This PDF export doesn't deduct credits, so no refresh needed
      
    } catch (e:any) {
      setMessages(prev=> [...prev, { 
        id: generateId(), 
        role:'error', 
        content:`Canvas PDF export failed: ${e?.message || 'Unknown error'}` 
      }]);
    }
  }

  async function runExportPDF() {
    if (!composePages.length) { setComposeOpen(false); return; }
    // Show in-chat loading bubble and close compose immediately for clearer UX
    const tempId = generateId();
    setMessages(prev => [
      ...prev,
      { id: tempId, role: 'assistant', content: 'Exporting PDF…', loading: true, createdAt: new Date().toISOString() }
    ]);
    setComposeOpen(false);
    try {
      const imgs = composePages.flatMap(p=> p.images.map(i=> i.url));
      const r = await fetch('/api/social-twin/export-pdf', { method:'POST', headers:{ 'Content-Type':'application/json', 'X-User-Id': userId || '' }, body: JSON.stringify({ images: imgs, topicId: currentTopicId || null, fileName: 'export.pdf' }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      const url = j.url as string | undefined;
      // Replace loading bubble with success + link/embed
      setMessages(prev => prev.map(m => m.id === tempId 
        ? { ...m, content: 'Exported PDF', pdfUrl: url, loading: false }
        : m
      ));
      // Note: This PDF export doesn't deduct credits, so no refresh needed
    } catch (e:any) {
      // Convert loading bubble into an error bubble
      setMessages(prev => prev.map(m => m.id === tempId 
        ? { id: m.id, role: 'error', content: `PDF export failed: ${e?.message || 'Unknown error'}`, createdAt: m.createdAt }
        : m
      ));
    }
  }

  async function exportPdfFromEditor() {
    // Show in-chat loading bubble and close the editor immediately for clearer UX
    const tempId = generateId();
    setMessages(prev => [
      ...prev,
      { id: tempId, role: 'assistant', content: 'Exporting PDF…', loading: true, createdAt: new Date().toISOString() }
    ]);
    setPdfEditorOpen(false);
    try {
      // Convert editor pages to export format
      const exportData = pdfPages.map(page => ({
        items: page.items.map(item => ({
          type: item.type,
          url: item.url,
          text: item.text,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          fontSize: item.fontSize || 16
        }))
      }));

      const r = await fetch('/api/social-twin/export-pdf-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' },
        body: JSON.stringify({ 
          pages: exportData, 
          topicId: currentTopicId || null, 
          fileName: 'layout_export.pdf' 
        })
      });
      
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      
      const url = j.url as string;
      // Replace loading bubble with success + link/embed
      setMessages(prev => prev.map(m => m.id === tempId 
        ? { ...m, content: 'PDF exported with custom layout', pdfUrl: url, loading: false }
        : m
      ));
      
      // Refresh credits display after successful export
      refreshCredits();
    } catch (e:any) {
      // Convert loading bubble into an error bubble
      setMessages(prev => prev.map(m => m.id === tempId 
        ? { id: m.id, role: 'error', content: `PDF export failed: ${e?.message || 'Unknown error'}`, createdAt: m.createdAt }
        : m
      ));
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
        body: JSON.stringify({ inputs: chain, fps: 24, topicId: currentTopicId || null, ar: compileAR })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ? `${j.error} ${j?.details?`- ${JSON.stringify(j.details)}`:''}` : `HTTP ${r.status}`);
      const url = j.url as string;
      setMessages(prev=> [...prev, { id: generateId(), role:'assistant', content:'Compiled video', videoUrl: url, createdAt: new Date().toISOString() }]);
      setCanvasItems(prev=> prev.map(it=> it.id===tempId ? { ...it, url, loading:false } : it));
      // credits have been deducted; refresh balance UI
      refreshCredits();
    } catch (e:any) {
      setCanvasItems(prev=> prev.filter(it=> !(it as any).loading));
      setMessages(prev=> [...prev, { id: generateId(), role:'error', content:`Compile failed: ${e?.message || 'Unknown error'}` }]);
    }
  }

  useEffect(() => {
    // Load RunPod endpoints from localStorage with environment variable fallbacks
    const DEFAULT_TEXT = process.env.NEXT_PUBLIC_RUNPOD_TEXT_URL || "/api/cloudflare-ai";
    const DEFAULT_IMAGE = process.env.NEXT_PUBLIC_RUNPOD_IMAGE_URL || "https://9wc6zqlr5p7i6a-3001.proxy.runpod.net/";
    const DEFAULT_IMAGE_MODIFY = process.env.NEXT_PUBLIC_RUNPOD_IMAGE_MODIFY_URL || DEFAULT_IMAGE;
    const DEFAULT_VIDEO = process.env.NEXT_PUBLIC_RUNPOD_VIDEO_URL || "";
    const DEFAULT_VIDEO_WAN = process.env.NEXT_PUBLIC_RUNPOD_VIDEO_WAN_URL || "";
    const DEFAULT_VIDEO_KLING = process.env.NEXT_PUBLIC_RUNPOD_VIDEO_KLING_URL || "";
    
    setTextUrl(localStorage.getItem(LOCAL_KEYS.text) || DEFAULT_TEXT);
    const lsImg = localStorage.getItem(LOCAL_KEYS.image);
    const lsImgMod = localStorage.getItem(LOCAL_KEYS.imageModify);
    setImageUrl(lsImg || DEFAULT_IMAGE);
    setImageModifyUrl(lsImgMod || DEFAULT_IMAGE_MODIFY);
    if (!lsImg && DEFAULT_IMAGE) localStorage.setItem(LOCAL_KEYS.image, DEFAULT_IMAGE);
    if (!lsImgMod && DEFAULT_IMAGE_MODIFY) localStorage.setItem(LOCAL_KEYS.imageModify, DEFAULT_IMAGE_MODIFY);
    setVideoUrl(localStorage.getItem(LOCAL_KEYS.video) || DEFAULT_VIDEO);
    setVideoWanUrl(localStorage.getItem(LOCAL_KEYS.videoWan) || DEFAULT_VIDEO_WAN);
    setVideoKlingUrl(localStorage.getItem(LOCAL_KEYS.videoKling) || DEFAULT_VIDEO_KLING);
    setLoraName(localStorage.getItem(LOCAL_KEYS.loraName) || "");
    const lsScale = localStorage.getItem(LOCAL_KEYS.loraScale);
  setLoraScale(lsScale ? Number(lsScale) : "");
  const lsEffect = localStorage.getItem(LOCAL_KEYS.effectLora);
  setEffectLora(lsEffect || "");
  const lsEffectScale = localStorage.getItem(LOCAL_KEYS.effectLoraScale);
  setEffectLoraScale(lsEffectScale ? Number(lsEffectScale) : "");
    const lsBatch = localStorage.getItem(LOCAL_KEYS.batchSize);
    setBatchSize(lsBatch ? Number(lsBatch) : "");
    setAspectRatio(localStorage.getItem(LOCAL_KEYS.aspectRatio) || "");
    const dm = localStorage.getItem('social_twin_dark') === '1';
    setDarkMode(dm);
    const ld = localStorage.getItem('social_twin_lowData');
    if (ld === '0') setLowDataMode(false);
    else if (ld === '1') setLowDataMode(true);
    // Boot into Pro mode if URL has ?pro=1|true|yes
    try {
      const pro = searchParams?.get('pro');
      console.log('URL pro parameter:', pro);
      if (pro && /^(1|true|yes)$/i.test(pro)) {
        console.log('Auto-enabling Pro mode from URL');
        setSimpleMode(false);
        setGridEnabled(true);
      }
    } catch {}
  }, [searchParams]);

  // Load available LoRAs
  useEffect(() => {
    const loadAvailableLoras = async () => {
      setLorasLoading(true);
      try {
        // Pass the active RunPod origin so server can query your storage even if config isn't set
        const pickOrigin = (u?: string) => {
          try { if (u && /^https?:\/\//i.test(u)) return new URL(u).origin; } catch {}
          return undefined;
        };
        const origin = pickOrigin(imageUrl) || pickOrigin(imageModifyUrl) || pickOrigin(process.env.NEXT_PUBLIC_RUNPOD_IMAGE_URL || '');
        const url = origin ? `/api/runpod/discover-loras?url=${encodeURIComponent(origin)}` : '/api/runpod/discover-loras';
        
        console.log('🔍 Loading LoRAs from:', url);
        console.log('RunPod origin detected:', origin);
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          console.log('📦 LoRA discovery response:', data);
          
          if (data.success && data.loras) {
            // Flatten all LoRA types into a single array
            const allLoras = [
              ...data.loras.character,
              ...data.loras.style,
              ...data.loras.concept,
              ...data.loras.other
            ];
            console.log('✅ Found LoRAs:', allLoras.length, allLoras);
            setAvailableLoras(allLoras);
          } else {
            console.log('❌ No LoRAs found in response');
            setAvailableLoras([]);
          }
        } else {
          console.error('❌ LoRA discovery failed:', response.status, response.statusText);
          setAvailableLoras([]);
        }
      } catch (error) {
        console.error('❌ Failed to load LoRAs:', error);
        setAvailableLoras([]);
      } finally {
        setLorasLoading(false);
      }
    };
    
    loadAvailableLoras();
  }, [imageUrl, imageModifyUrl]); // Re-load when URLs change

  useEffect(() => {
    try { localStorage.setItem('social_twin_lowData', lowDataMode ? '1' : '0'); } catch {}
  }, [lowDataMode]);

  // Credits are provided by the shared context; no local polling here

  useEffect(() => {
    // On initial load, jump to bottom without a long smooth scroll
    if ((messages.length || 0) > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [messages.length]);

  // Focus bottom textarea when composer becomes visible
  useEffect(() => {
    if (composerShown) {
      setTimeout(() => bottomInputRef.current?.focus(), 10);
    }
  }, [composerShown]);

  // Lock page scroll when settings modal is open (mobile usability)
  useEffect(() => {
    if (!settingsOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [settingsOpen]);

  // Auto-load unified chat feed ONLY if no project is being loaded (projectId in URL)
  // This ensures chat area starts empty by default until user chooses a project
  useEffect(() => {
    if (userId === undefined) return; // wait for auth to resolve
    
    // Don't auto-load chat if a project is being loaded from URL
    const projectId = searchParams?.get('projectId');
    if (projectId) return;
    
    // Only auto-load if user has no current project loaded and explicitly wants to continue previous chat
    // For now, we'll keep chat empty by default to match the requirement
    // If you want to restore auto-loading, uncomment the code below:
    
    /*
    (async () => {
      try {
        const r = await fetch('/api/social-twin/feed?limit=20', { headers: { 'X-User-Id': userId || '' } });
        if (!r.ok) return;
        const j = await r.json();
        const items = (j.items || []) as Array<{ id:string; role:ChatRole; content:string; imageUrl?:string; videoUrl?:string; createdAt?:string }>;
        setMessages(items.map((it) => ({ id: it.id, role: it.role, content: it.content, imageUrl: it.imageUrl, videoUrl: it.videoUrl, createdAt: it.createdAt })));
        setFeedCursor(j.nextCursor || null);
      } catch {}
    })();
    */
  }, [userId, searchParams]);

  // Infinite scroll: load older on scroll top
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = async () => {
      if (el.scrollTop <= 0 && !isLoadingMore && feedCursor) {
        setIsLoadingMore(true);
        try {
          const r = await fetch(`/api/social-twin/feed?limit=20&before=${encodeURIComponent(feedCursor)}`, { headers: { 'X-User-Id': userId || '' } });
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

  // Clean up any existing operators from the canvas (migration)
  useEffect(() => {
    setCanvasItems(prev => prev.filter(item => item.type !== 'operator'));
    setEdges(prev => prev.filter(edge => {
      const fromItem = canvasItems.find(i => i.id === edge.fromId);
      const toItem = canvasItems.find(i => i.id === edge.toId);
      return fromItem?.type !== 'operator' && toItem?.type !== 'operator';
    }));
  }, []);

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
  if (effectLora) localStorage.setItem(LOCAL_KEYS.effectLora, effectLora);
  if (effectLoraScale !== "") localStorage.setItem(LOCAL_KEYS.effectLoraScale, String(effectLoraScale));
    if (batchSize !== "") localStorage.setItem(LOCAL_KEYS.batchSize, String(batchSize));
    localStorage.setItem(LOCAL_KEYS.aspectRatio, aspectRatio);
  try { localStorage.setItem('social_twin_save_to_library', saveToLibrary ? '1' : '0'); } catch {}
  }

  async function handleSend() {
    console.log('🚀 HANDLE_SEND CALLED');
    console.log('Mode:', mode);
    console.log('Input:', JSON.stringify(input));
    console.log('Active endpoint:', activeEndpoint);
    console.log('User agent:', navigator.userAgent);
    console.log('Is mobile detected:', isMobile);
    console.log('Window width:', window.innerWidth);
    console.log('Credits info:', creditInfo);
    console.log('Can afford generation:', canAffordGeneration);
    console.log('Generation cost:', generationCost);
    console.log('LoRA name:', loraName);
    console.log('LoRA scale:', loraScale);
    console.log('Batch size:', batchSize);
    console.log('Aspect ratio:', aspectRatio);
    console.log('Effects preset:', effectsPreset);
    console.log('Effects on:', effectsOn);
    console.log('Video model:', videoModel);
    console.log('User ID:', userId);
    console.log('Call stack:', new Error().stack);
    
    const trimmed = input.trim();
    console.log('Trimmed input:', JSON.stringify(trimmed));
    
    if (!trimmed) {
      console.log('❌ Empty input, returning');
      return;
    }
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

    if (!activeEndpoint && mode !== 'text') {
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
        content: (mode==='text') ? getRandomThinkingPhrase() : ((mode==='image' || mode==='image-modify') ? 'Generating image…' : (mode==='video' ? 'Generating video…' : 'Working…')),
        loading: true,
        pendingType: ((mode==='image' || mode==='image-modify') ? 'image' : (mode==='video' ? 'video' : 'text')),
        createdAt: new Date().toISOString(),
      };
      setMessages((prev)=> [...prev, placeholder]);
      
      // Start thinking animation for text mode
      if (mode === 'text') {
        startThinkingAnimation(tempId);
      }
      
      // For text mode, use Cloudflare Workers AI
      if (mode === 'text') {
        try {
          // Check if user uploaded an image or PDF - if so, use vision mode
          if (attached && (attached.type.startsWith('image') || attached.type === 'application/pdf')) {
            // Add user message with both text and image to chat
            const userMessageWithImage = { 
              id: tempId, 
              role: 'user' as const, 
              content: trimmed,
              image: attached.dataUrl, // Store image data in message
              loading: false 
            };
            
            // Add AI loading message with thinking animation
            const aiLoadingMessage = { 
              id: generateId(), 
              role: 'assistant' as const, 
              content: getRandomThinkingPhrase(), 
              loading: true 
            };
            
            setMessages((prev) => [
              ...prev.filter(msg => msg.id !== tempId), // Remove temp message
              userMessageWithImage,
              aiLoadingMessage
            ]);

            // Start thinking animation
            startThinkingAnimation(aiLoadingMessage.id);

            // Convert current messages to format expected by Cloudflare AI
            const conversationHistory = messages
              .filter(msg => msg.role === 'user' || msg.role === 'assistant')
              .filter(msg => !msg.loading) // Exclude loading messages
              .map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content
              }));

            // Add personality-based system prompt for vision mode
            const personalityPrompts = {
              creative: "You are a creative AI assistant focused on artistic expression, innovation, and imaginative solutions. Analyze images/documents with a creative perspective, offering artistic insights and imaginative interpretations.",
              news: "You are a professional news analyst and journalist. Analyze images/documents with journalistic integrity, focusing on factual observations and news-worthy elements.",
              police: "You are a professional law enforcement expert. Analyze images/documents from a security and legal perspective, noting any relevant details for public safety or legal procedures.",
              lawyer: "You are a professional legal expert. Analyze images/documents for legal relevance, potential evidence, or legal implications. Always emphasize consulting qualified legal professionals.",
              accountant: "You are a professional financial and accounting expert. Analyze images/documents for financial data, accounting records, or business-related information.",
              teacher: "You are an experienced educator. Analyze images/documents from an educational perspective, explaining what you see and providing learning opportunities.",
              atom: "You are ATOM, an advanced AI assistant focused on providing intelligent, helpful, and innovative solutions. You combine creativity with analytical thinking to deliver comprehensive and insightful responses."
            };

            // Create enhanced message with personality context
            const enhancedMessage = `${personalityPrompts[aiPersonality]}\n\nUser's message: ${trimmed}`;

            const response = await handleCreditDeductingAPI(() => 
              cloudflareAI.sendMessageWithImage(
                enhancedMessage,
                attached.dataUrl, // Base64 image data
                conversationHistory,
                userId || 'anonymous'
              )
            );
            
            // Stop thinking animation
            stopThinkingAnimation();
            
            setMessages((prev) => prev.map(msg => 
              msg.id === aiLoadingMessage.id 
                ? { ...msg, content: response, loading: false }
                : msg
            ));
            
            // Clear the attachment after sending
            setAttached(null);
            return;
          } else {
            // Text-only conversation with AI personality
            const conversationHistory = messages
              .filter(msg => msg.role === 'user' || msg.role === 'assistant')
              .filter(msg => !msg.loading) // Exclude loading messages
              .map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content
              }));

            // Add personality-based system prompt
            const personalityPrompts = {
              creative: "You are a creative AI assistant focused on artistic expression, innovation, and imaginative solutions. Respond with creativity, inspiration, and out-of-the-box thinking.",
              news: "You are a professional news analyst and journalist. Provide factual, well-researched responses with journalistic integrity. Focus on current events, analysis, and objective reporting.",
              police: "You are a professional law enforcement expert. Provide responses related to legal procedures, public safety, criminal justice, and law enforcement best practices. Always emphasize legal and ethical conduct.",
              lawyer: "You are a professional legal expert. Provide responses about legal matters, procedures, and advice. Always emphasize the importance of consulting with qualified legal professionals for specific legal issues.",
              accountant: "You are a professional financial and accounting expert. Focus on financial planning, accounting principles, tax matters, and business finance. Always recommend consulting certified professionals for specific financial advice.",
              teacher: "You are an experienced educator. Provide clear, educational responses that help users learn and understand concepts. Break down complex topics into digestible parts and encourage learning.",
              atom: "You are ATOM, an advanced AI assistant focused on providing intelligent, helpful, and innovative solutions. You combine creativity with analytical thinking to deliver comprehensive and insightful responses."
            };

            // Prepend personality system message to conversation history
            const enhancedHistory = [
              { role: 'system' as const, content: personalityPrompts[aiPersonality] },
              ...conversationHistory
            ];

            const response = await handleCreditDeductingAPI(() => 
              cloudflareAI.sendMessage(
                trimmed,
                enhancedHistory as any,
                chatMode,
                userId || 'anonymous'
              )
            );
            
            // Stop thinking animation
            stopThinkingAnimation();
            
            setMessages((prev) => prev.map(msg => 
              msg.id === tempId 
                ? { ...msg, content: response, loading: false }
                : msg
            ));
            return;
          }
        } catch (error) {
          console.error('Cloudflare AI error:', error);
          // Stop thinking animation on error
          stopThinkingAnimation();
          setMessages((prev) => prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, content: 'Error: Failed to generate response. Please try again.', loading: false, role: 'error' }
              : msg
          ));
          return;
        }
      }
      
      // Use the new tracking API endpoint for image/video generation
  const res = await fetch("/api/generate-with-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": userId || "" },
        body: JSON.stringify({
          prompt: trimmed,
          mode,
          // Omit runpodUrl to use server-side DB-backed config unless user explicitly sets an override
          ...(activeEndpoint && activeEndpoint.trim() ? { runpodUrl: activeEndpoint } : {}),
          provider: textProvider,
          // Character & Effects LoRAs
          lora_character: loraName || undefined,
          lora_character_scale: typeof loraScale === 'number' ? loraScale : undefined,
          lora_effect: effectLora || undefined,
          lora_effect_scale: typeof effectLoraScale === 'number' ? effectLoraScale : undefined,
          batch_size: typeof batchSize === 'number' ? batchSize : undefined,
          seed: typeof seed === 'number' ? seed : undefined,
          denoise: typeof denoise === 'number' ? denoise : undefined,
          unet: unetName || undefined,
          aspect_ratio: aspectRatio || undefined,
              cfg: typeof cfgScale === 'number' ? cfgScale : undefined,
              guidance: typeof guidance === 'number' ? guidance : undefined,
              steps: typeof steps === 'number' ? steps : undefined,
              effects_preset: effectsPreset || undefined,
              effects_on: effectsOn || undefined,
              video_model: mode==='video' ? videoModel : undefined,
              video_type: mode==='video' ? (attached?.dataUrl ? 'image' : 'text') : undefined,
          userId: userId || undefined,
          attachment: attached || undefined,
          imageUrl: (mode==='image-modify' && attached?.dataUrl) ? attached.dataUrl : undefined,
          workflow_settings: showWorkflowPopoverFor ? {
            target: showWorkflowPopoverFor,
            use_flux_dev: useFluxDev,
            sampler,
            denoise: typeof denoise === 'number' ? denoise : undefined,
            unet: unetName || undefined,
          } : undefined,
          // Respect user's choice whether to save generated media into their personal library
          saveToLibrary: saveToLibrary === true,
        }),
      });

      console.log('🌐 API Response status:', res.status);
      console.log('🌐 API Response headers:', res.headers);

      if (!res.ok) {
        // Show a clear message when the workflow isn't available yet (501) or other errors
        let detail = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          console.log('❌ API Error response:', errJson);
          if (errJson?.error) {
            detail = errJson.workflow ? `${errJson.error} (${errJson.workflow})` : errJson.error;
          }
        } catch {}
        setMessages((prev) => [
          ...prev,
          { id: generateId(), role: "error", content: detail },
        ]);
        return;
      }

      const payload = await res.json().catch(() => ({} as any));
      console.log('✅ API Success payload:', payload);
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
      // Auto add generated media to canvas grid if present (when sendToCanvas is enabled)
      if (sendToCanvas) {
        const final = { imageUrl: aiImage, videoUrl: (aiVideo || firstVideo) };
        if (final.imageUrl || final.videoUrl) {
          const url = final.imageUrl || final.videoUrl!;
          const type = final.imageUrl ? 'image' : 'video';
          addToCanvas(url, type);
        }
      }
  // credits may have been deducted; refresh balance UI via shared provider
  refreshCredits();
  // Refresh generated history so new outputs appear in the Generated tab
  try { refreshGeneratedHistory(); } catch {}
  // Make sure Save Project button is available after generation
  setShowSaveProject(true);
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

  // New function to collect both images and text from orange string connections
  function getConnectedItemsForPDF(nodeId: string): Array<{ id:string; type:'image'|'text'; url?:string; text?:string; x:number; y:number; w:number; h:number; fontScale?:number }> {
    const visited = new Set<string>();
    const result: Array<{ id:string; type:'image'|'text'; url?:string; text?:string; x:number; y:number; w:number; h:number; fontScale?:number }> = [];
    
    function collectNode(currentNodeId: string) {
      if (visited.has(currentNodeId)) return;
      visited.add(currentNodeId);
      
      const node = canvasItems.find(i => i.id === currentNodeId);
      if (node) {
        // Add current node if it's an image or text
        if (node.type === 'image' && (node as any).url) {
          result.push({ 
            id: node.id, 
            type: 'image', 
            url: (node as any).url, 
            x: node.x || 0, 
            y: node.y || 0, 
            w: node.w || 360, 
            h: node.h || 240 
          });
        } else if (node.type === 'text' && (node as any).text) {
          result.push({ 
            id: node.id, 
            type: 'text', 
            text: (node as any).text, 
            x: node.x || 0, 
            y: node.y || 0, 
            w: node.w || 300, 
            h: node.h || 100,
            fontScale: (node as any).fontScale || 1
          });
        }
      }
      
      // Traverse both incoming and outgoing edges
      const connectedEdges = edges.filter(e => e.fromId === currentNodeId || e.toId === currentNodeId);
      
      for (const edge of connectedEdges) {
        const nextNodeId = edge.fromId === currentNodeId ? edge.toId : edge.fromId;
        collectNode(nextNodeId);
      }
    }
    
    collectNode(nodeId);
    return result;
  }

  // Function to add canvas image to storyboard
  function addCanvasImageToStoryboard(canvasItem: CanvasItem) {
    if (canvasItem.type !== 'image' && canvasItem.type !== 'video') return;
    
    const newFrame = {
      id: `frame-${Date.now()}`,
      imageUrl: canvasItem.url || '',
      title: `Shot ${storyboardFrames.length + 1}`,
      duration: 3,
      motionPreset: 'static',
      transition: 'fade',
      character: '',
      background: '',
      action: '',
      cameraStyle: 'medium shot',
      lookDirection: 'center',
      strength: 0.8,
      seed: Math.floor(Math.random() * 1000000),
      status: 'idle' as const
    };
    
    setStoryboardFrames([...storyboardFrames, newFrame]);
    
    // Also add to image gallery if not already there
    const galleryImage = {
      id: `img-${Date.now()}`,
      url: canvasItem.url || '',
      prompt: 'From canvas',
      createdAt: new Date().toISOString(),
      style: 'canvas'
    };
    
    setImageGallery([galleryImage, ...imageGallery]);
  }

  async function executeOperator(operator: CanvasItem, _manualInputs?: Array<{ url: string; type: 'image'|'video'; imageDurationSec?: number; transitionMs?: number }>) {
    if (operator.operatorKind === 'publish') {
      if (currentProjectId) {
        await updateExistingProject();
      } else {
        setProjectModalOpen(true);
      }
      return;
    }
    if (operator.operatorKind === 'compile') {
      // Improved chain collection: get all connected media in proper order
      const allMedia = getIncomingMedia(operator.id);
      const videoInputs = allMedia.filter(i=> i.type==='video');
      
      if (!videoInputs.length) {
        setMessages(prev=> [...prev, { id: generateId(), role:'assistant', content:'No videos connected to Compile operator. Connect videos using the orange string (male port → female port) to build a compilation chain.', createdAt: new Date().toISOString() }]);
        return;
      }
      
      // Convert to compilation format
      const chainInputs = videoInputs.map(v=> ({ 
        url: getRawUrl(v.url) || v.url, 
        type: 'video' as const,
        imageDurationSec: v.imageDurationSec,
        transitionMs: v.transitionMs
      }));
      
      setCompileChain(chainInputs);
      setCompileOriginId(operator.id);
      setCompileOpen(true);
      return;
    }
  }

  function executeOperatorKind(op: CanvasItem, kind: 'compile'|'publish', manualInputs?: Array<{ url: string; type: 'image'|'video'; imageDurationSec?: number; transitionMs?: number }>) {
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

  // Simplified mobile handling
  useEffect(() => {
    // Simple mobile detection
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  return (
  <main className={`relative w-screen overflow-hidden ${darkMode ? 'bg-neutral-900 text-neutral-100' : 'bg-white'} max-w-full`}
         style={{ height: isMobile ? '100vh' : '100vh' }}> 
      {/* Make header icons clickable on top in Normal mode */}
      {simpleMode ? <div className="pointer-events-none fixed inset-0 z-[10001]" /> : null}
      {/* Chat panel docked right (collapsible) */}
      <section
        className={`absolute ${simpleMode ? 'inset-0' : 'right-0 top-0'} z-[10010] pointer-events-auto flex flex-col overflow-hidden ${simpleMode ? '' : 'border-l transition-[width] duration-200'} ${darkMode ? (simpleMode ? 'bg-neutral-900' : 'bg-neutral-900 border-neutral-800') : (simpleMode ? 'bg-white' : 'bg-white border-neutral-300')} min-w-0`}
         style={{
           height: '100vh',
           ...(simpleMode ? { left: sidebarOpen ? 240 : 0, transition: 'left 150ms ease' } : { width: chatCollapsed ? 40 : 'min(30vw, 520px)', minWidth: chatCollapsed ? 40 : 'min(320px, 100vw)', maxWidth: chatCollapsed ? 40 : 'min(520px, 100vw)' })
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
        {/* Collapse handle - Hidden on mobile in simple mode to avoid interfering with mobile UX */}
        {!(simpleMode && isMobile) && (
        <button
          className="absolute md:left-[-40px] left-2 top-1/2 z-[10020] -translate-y-1/2 rounded-full p-3 shadow-lg bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 transition-all duration-200 border-2 border-white/20 hover:border-white/40 hover:scale-110 animate-pulse hover:animate-none"
          onClick={()=> setChatCollapsed(v=>!v)}
          title={chatCollapsed ? 'Expand chat panel' : 'Collapse chat panel'}
          aria-label={chatCollapsed ? 'Expand chat panel' : 'Collapse chat panel'}
        >
          {chatCollapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )}
        </button>
        )}
  <header className={`flex items-center justify-between gap-3 px-3 py-2 bg-gray-800`} style={{ display: (!simpleMode && chatCollapsed) ? 'none' : undefined }}>
          {/* Mobile: Hamburger menu on the left */}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
                darkMode 
                  ? 'text-white hover:bg-neutral-800' 
                  : 'text-black hover:bg-gray-100'
              }`}
              aria-label="Toggle menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M3 12H21M3 6H21M3 18H21" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          
          {/* Desktop: Empty div for spacing, Mobile: Hidden */}
          {!isMobile && <div></div>}
          
          {/* Center: Atom title for all tabs */}
          <h1 className="text-base md:text-lg font-semibold tracking-tight absolute left-1/2 transform -translate-x-1/2">
            Atom
          </h1>
          
          {/* Right side: Credits - removed duplicate display, using HamburgerMenu green bar */}
          <div className="flex items-center gap-2">
            {/* Credits display removed - now using HamburgerMenu green bar only */}
            
            {/* Dark mode text toggle removed (use icon-based Theme toggle below) */}
            
            {/* Pro toggle moved to Navbar */}
            
            {/* Settings and Theme toggles moved to Dashboard tab */}
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobile && mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/50" 
              onClick={() => setMobileMenuOpen(false)}
            />
            
            {/* Menu Panel */}
            <div className={`fixed left-0 top-0 h-full w-80 transform transition-transform duration-300 ease-in-out ${
              darkMode ? 'bg-neutral-900' : 'bg-white'
            } shadow-xl`}>
              {/* Menu Header */}
              <div className={`flex items-center justify-between p-4 border-b ${
                darkMode ? 'border-neutral-800' : 'border-gray-200'
              }`}>
                <div className="flex items-center gap-3">
                  <h2 className={`text-lg font-semibold ${
                    darkMode ? 'text-white' : 'text-black'
                  }`}>Menu</h2>
                  {/* Credits removed - using HamburgerMenu green bar only */}
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className={`p-2 rounded-md transition-colors ${
                    darkMode 
                      ? 'text-white hover:bg-neutral-800' 
                      : 'text-black hover:bg-gray-100'
                  }`}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path 
                      d="M18 6L6 18M6 6L18 18" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
              
              {/* Menu Items */}
              <div className="p-4 space-y-3">
                {/* Main Navigation */}
                <div className="space-y-1">
                  <h3 className={`text-xs font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Main Navigation</h3>
                  {[
                    { id: 'chat', label: 'Chat' },
                    { id: 'generated', label: 'Generated' },
                    { id: 'dashboard', label: 'Dashboard' },
                    { id: 'news', label: 'News' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? (darkMode
                              ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-700 border border-cyan-500/30')
                          : (darkMode
                              ? 'text-gray-300 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-teal-500/10 hover:text-cyan-200'
                              : 'text-gray-700 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-teal-500/10 hover:text-cyan-600')
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Account & Billing */}
                <div className="space-y-1">
                  <h3 className={`text-xs font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Account & Billing</h3>
                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      darkMode
                        ? 'text-gray-300 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-teal-500/10 hover:text-cyan-200'
                        : 'text-gray-700 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-teal-500/10 hover:text-cyan-600'
                    }`}
                  >
                    Home
                  </Link>
                  <Link
                    href="/subscription"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      darkMode
                        ? 'text-gray-300 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-teal-500/10 hover:text-cyan-200'
                        : 'text-gray-700 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-teal-500/10 hover:text-cyan-600'
                    }`}
                  >
                    Subscription
                  </Link>
                  <Link
                    href="/user"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      darkMode
                        ? 'text-gray-300 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-teal-500/10 hover:text-cyan-200'
                        : 'text-gray-700 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-teal-500/10 hover:text-cyan-600'
                    }`}
                  >
                    Profile
                  </Link>
                </div>

                {/* Quick Actions */}
                <div className="space-y-1">
                  <h3 className={`text-xs font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Quick Actions</h3>
                  <button
                    onClick={() => {
                      setProjectModalOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      darkMode
                        ? 'text-gray-300 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-teal-500/10 hover:text-cyan-200'
                        : 'text-gray-700 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-teal-500/10 hover:text-cyan-600'
                    }`}
                  >
                    Save Project
                  </button>
                  <button
                    onClick={() => {
                      setSettingsOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      darkMode
                        ? 'text-gray-300 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-teal-500/10 hover:text-cyan-200'
                        : 'text-gray-700 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-teal-500/10 hover:text-cyan-600'
                    }`}
                  >
                    Settings
                  </button>
                </div>

                {/* Appearance */}
                <div className="space-y-1">
                  <h3 className={`text-xs font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Appearance</h3>
                  <button
                    onClick={() => {
                      setDarkMode(!darkMode);
                      localStorage.setItem('social_twin_dark', !darkMode ? '1' : '0');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      darkMode
                        ? 'text-gray-300 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-teal-500/10 hover:text-cyan-200'
                        : 'text-gray-700 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-teal-500/10 hover:text-cyan-600'
                    }`}
                  >
                    {darkMode ? 'Light Mode' : 'Dark Mode'}
                  </button>
                </div>

                {/* Recent Projects */}
                {projects.length > 0 && (
                  <div className="space-y-2">
                    <h3 className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Recent Projects</h3>
                    {projects.slice(0, 3).map((project) => (
                      <button
                        key={project.id}
                        onClick={() => {
                          switchToProject(project.id, project.title);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          darkMode
                            ? 'text-gray-300 hover:bg-neutral-800 hover:text-white'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-black'
                        }`}
                      >
                        <span className="text-lg">📁</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{project.title}</div>
                          <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                            {formatRelativeTime(project.updatedAt)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

  {/* Settings panel removed from global area; available in Dashboard tab */}

        {/* Top Navigation - REMOVED - Chat moved to hamburger menu */}        <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${simpleMode ? 'items-stretch' : ''}`} style={{ display: (!simpleMode && chatCollapsed) ? 'none' : undefined, paddingBottom: isMobile ? '80px' : '80px' }}>
          {/* Tab Content */}
          {activeTab === 'chat' && (
            <>
        <div ref={listRef} className={`flex-1 overflow-y-auto overflow-x-hidden p-3 ${simpleMode ? 'max-w-2xl mx-auto w-full' : ''}`}
          style={{ paddingBottom: '8px' }}>
                {messages.length === 0 ? (
                  <div className={`text-sm text-gray-500 ${simpleMode ? 'flex h-full items-center justify-center' : ''}`}>
                    {simpleMode ? (
                      // Remove middle prompt box completely
                      null
                    ) : 'Start by entering a prompt below.'}
                  </div>
                ) : (
                  messages.map((m, _index) => {
                    const isUser = m.role === 'user';
                    const isAssistantPlain = !isUser && simpleMode; // Normal mode: render assistant without bubble

                    return (
                      <div key={m.id} className="mb-1">
                        <div id={`msg-${m.id}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={
                              isAssistantPlain
                                ? 'max-w-[75%] text-sm'
                                : `max-w-[75%] rounded-2xl border px-3 py-2 break-words overflow-wrap-anywhere ${
                                    isUser
                                      ? (darkMode ? 'bg-gradient-to-r from-cyan-600/80 to-teal-600/80 text-white border-cyan-500/60' : 'bg-gradient-to-r from-cyan-500/80 to-teal-500/80 text-white border-cyan-500/60')
                                      : (darkMode ? 'bg-neutral-900 text-neutral-100 border-neutral-800' : 'bg-white text-black border-neutral-400')
                                  }`
                            }
                            style={isAssistantPlain ? undefined : { borderTopLeftRadius: isUser ? 16 : 4, borderTopRightRadius: isUser ? 4 : 16 }}
                          >
                            {!isAssistantPlain && (
                              <div className={`mb-1 flex items-center gap-2 text-[11px] ${isUser ? 'opacity-90' : (darkMode ? 'text-neutral-400' : 'text-gray-500')}`}>
                                <span className="font-semibold">
                                  {isUser ? (user?.fullName || 'You') : 
                                    `${aiPersonality.charAt(0).toUpperCase() + aiPersonality.slice(1)} AI`
                                  }
                                </span>
                                {!isUser && (
                                  <span className="text-[10px] opacity-75">
                                    {aiPersonality === 'creative' && '🎨'} 
                                    {aiPersonality === 'news' && '📰'}
                                    {aiPersonality === 'police' && '👮'}
                                    {aiPersonality === 'lawyer' && '⚖️'}
                                    {aiPersonality === 'accountant' && '📊'}
                                    {aiPersonality === 'teacher' && '🎓'}
                                    {aiPersonality === 'atom' && '⚛️'}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className={`whitespace-pre-wrap text-sm break-words overflow-wrap-anywhere ${isAssistantPlain ? '' : ''}`}>
                              {/* Display image if present */}
                              {m.image && m.image.startsWith('data:image') && (
                                <div className="mb-2">
                                  <img 
                                    src={m.image} 
                                    alt="User uploaded image" 
                                    className="max-w-full max-h-64 rounded-lg border object-contain"
                                    style={{ maxWidth: '250px' }}
                                  />
                                </div>
                              )}
                              {/* Display PDF document if present */}
                              {m.image && m.image.startsWith('data:application/pdf') && (
                                <div className="mb-2 p-2 border rounded-lg bg-gray-50 dark:bg-gray-800">
                                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-sm font-medium">📄 PDF Document</span>
                                  </div>
                                </div>
                              )}
                              {m.content}
                            </div>
                            {m.loading && m.pendingType==='image' ? (
                              <div className="mt-2 h-40 w-full animate-pulse rounded-lg border bg-gradient-to-r from-white/5 to-white/0" />
                            ) : null}
                            {m.loading && m.pendingType==='video' ? (
                              <div className="mt-2 h-40 w-full animate-pulse rounded-lg border bg-gradient-to-r from-white/5 to-white/0" />
                            ) : null}
                            {!isAssistantPlain && (
                              <div className={`mt-1 text-[10px] opacity-60 ${isUser ? 'text-white' : (darkMode ? 'text-neutral-400' : 'text-gray-500')}`}>
                                {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </div>
                            )}
                            {m.imageUrl && !/\.(mp4|webm)(\?|$)/i.test(m.imageUrl) ? (
                              <div className="mt-2 group">
                                {!lowDataMode || mediaAllowed.has(m.id) ? (
                                  <img
                                  alt="generated"
                                  src={getDisplayUrl(m.imageUrl) || m.imageUrl}
                                  className="max-h-80 w-full rounded-lg border"
                                  loading="lazy"
                                  draggable
                                  onDragStart={(e)=>{
                                    try { e.dataTransfer.setData('application/x-chat-item', JSON.stringify({ url: m.imageUrl, type: 'image' })); } catch {}
                                    e.dataTransfer.setData('text/uri-list', m.imageUrl!);
                                    e.dataTransfer.setData('text/plain', m.imageUrl!);
                                    e.dataTransfer.effectAllowed = 'copyMove';
                                  }}
                                  />
                                ) : (
                                  <button className={`rounded border px-2 py-1 text-xs ${darkMode ? 'border-neutral-700' : ''}`} onClick={(e)=>{
                                    e.preventDefault();
                                    setMediaAllowed(prev=>{ const n = new Set(prev); n.add(m.id); return n; });
                                  }}>Load image</button>
                                )}
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
                                {!lowDataMode || mediaAllowed.has(m.id) ? (
                                  (m as any).images.map((u: string, i: number) => (
                                    <a key={i} href={u} target="_blank" rel="noreferrer">
                                      <img
                                        src={getDisplayUrl(u) || u}
                                        className="h-20 w-auto rounded border object-cover"
                                        loading="lazy"
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
                                  ))
                                ) : (
                                  <button className={`rounded border px-2 py-1 text-xs ${darkMode ? 'border-neutral-700' : ''}`} onClick={()=> setMediaAllowed(prev=>{ const n = new Set(prev); n.add(m.id); return n; })}>
                                    Load {String((m as any).images.length)} images
                                  </button>
                                )}
                              </div>
                            ) : null}
                            {m.videoUrl ? (
                              (!lowDataMode || mediaAllowed.has(m.id)) ? (
                                <video
                                  src={getDisplayUrl(m.videoUrl) || m.videoUrl}
                                  className="mt-2 max-h-80 w-full rounded-lg border"
                                  controls
                                  preload="metadata"
                                  draggable
                                  onDragStart={(e)=>{
                                    try { e.dataTransfer.setData('application/x-chat-item', JSON.stringify({ url: m.videoUrl, type: 'video' })); } catch {}
                                    e.dataTransfer.setData('text/uri-list', m.videoUrl!);
                                    e.dataTransfer.setData('text/plain', m.videoUrl!);
                                    e.dataTransfer.effectAllowed = 'copyMove';
                                  }}
                                />
                              ) : (
                                <button className={`mt-2 rounded border px-2 py-1 text-xs ${darkMode ? 'border-neutral-700' : ''}`} onClick={(e)=>{
                                  e.preventDefault();
                                  setMediaAllowed(prev=>{ const n = new Set(prev); n.add(m.id); return n; });
                                }}>Load video</button>
                              )
                            ) : null}
                            {m.pdfUrl ? (
                              <div className="mt-2 group">
                                <div className={`p-3 rounded-lg border ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-gray-50 border-gray-300'}`}>
                                  <div className="flex items-center gap-2 mb-3">
                                    <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                    </svg>
                                    <span className="font-medium text-sm">PDF Document</span>
                                  </div>
                                  
                                  {/* Embedded PDF Viewer */}
                                  <div className="mb-3">
                                    <iframe
                                      src={m.pdfUrl}
                                      className={`w-full h-96 rounded border ${darkMode ? 'border-neutral-600' : 'border-gray-300'}`}
                                      title="PDF Viewer"
                                    />
                                  </div>

                                  <div className="flex gap-2">
                                    <a
                                      href={m.pdfUrl}
                                      download="exported-layout.pdf"
                                      className={`px-3 py-1 rounded text-sm border ${darkMode ? 'border-neutral-600 hover:bg-neutral-800 text-gray-400' : 'border-gray-400 hover:bg-gray-100 text-gray-600'} transition-colors`}
                                    >
                                      📄 Download PDF
                                    </a>
                                    <a
                                      href={m.pdfUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`px-3 py-1 rounded text-sm border ${darkMode ? 'border-neutral-600 hover:bg-neutral-800 text-green-400' : 'border-gray-400 hover:bg-gray-100 text-green-600'} transition-colors`}
                                    >
                                      Open in New Tab
                                    </a>
                                  </div>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  <button
                                    className="rounded border px-2 py-0.5 text-xs"
                                    onClick={()=>{ folderModalPayload.current = { url: m.pdfUrl!, type: 'pdf', prompt: m.content }; setFolderModalOpen(true); }}
                                  >Add to project</button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        {simpleMode ? (
                          <div className={`my-2 border-t ${darkMode ? 'border-neutral-800' : 'border-neutral-400'}`} />
                        ) : null}
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Silent cost compute (no visible bar) */}
              <GenerationCostDisplay
                mode={mode}
                batchSize={typeof batchSize === 'number' ? batchSize : 1}
                darkMode={darkMode}
                hideUI
                onCostCalculated={(cost, canAfford) => {
                  setGenerationCost(cost);
                  // Mobile-safe: handle undefined credits gracefully
                  const hasCredits = creditInfo?.credits !== undefined && creditInfo?.credits !== null;
                  const actualCanAfford = hasCredits ? canAfford : true; // Allow generation if credits are loading
                  setCanAffordGeneration(actualCanAfford);
                }}
              />

  {/* Composer container - removed dark grey background/border, transparent */}
  <div ref={composerRef} className={`${isMobile ? 'fixed bottom-0 left-0 right-0 p-2' : 'absolute bottom-0 left-0 right-0 p-2'} ${simpleMode && !isMobile ? 'max-w-2xl mx-auto w-full' : ''} z-[10015] ${activeTab !== 'chat' ? 'hidden' : ''} ${darkMode ? 'bg-neutral-900' : 'bg-white'} border-t ${darkMode ? 'border-neutral-700' : 'border-gray-200'}`}
          style={{ 
            bottom: '0px'
          }}>
                
                {/* Character input row (only when needed) - same for mobile and desktop */}
                {(mode === 'image-modify' || (mode === 'image' && loraName && !isPresetLoRa(loraName))) && (
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="character.safetensors"
                      value={loraName}
                      onChange={(e) => setLoraName(e.target.value)}
                      className={`flex-1 rounded border px-2 py-1 text-xs font-mono ${darkMode ? 'bg-neutral-900 border-neutral-700 text-neutral-100 placeholder-neutral-500' : 'bg-white border-neutral-300 placeholder-gray-400'}`}
                    />
                  </div>
                )}

                {/* Advanced Options - Comprehensive Creator Studio Integration */}
                {advancedOpen && (
                  <div className={`mb-0 rounded-xl border p-4 space-y-4 ${darkMode ? 'border-neutral-700 bg-neutral-900/50 backdrop-blur-sm' : 'border-neutral-400 bg-white/80 backdrop-blur-sm'} max-h-[60vh] overflow-y-auto`}>
                    
                    {/* Workflow & Model Selection */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold opacity-90">Workflow</label>
                        <div className={`px-2 py-1 rounded text-[10px] font-mono ${darkMode ? 'bg-neutral-800 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                          {mode === 'text' ? 'LLM Provider' : 
                           mode === 'image' ? 'Socialtwin-Image.json' : 
                           mode === 'image-modify' ? 'SocialTwin-Modify.json' : 
                           attached?.type.startsWith('image') 
                             ? (videoModel === 'wan' ? 'Wan-Image-video.json' : 'LTXIMAGETOVIDEO.json')
                             : (videoModel === 'wan' ? 'Wan-text-video.json' : 'LTXV-TEXT_VIDEO.json')}
                        </div>
                      </div>

                      {/* Text Providers */}
                      {mode === 'text' && (
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'social', name: 'Social AI', desc: 'Fast & creative', cost: '1' },
                            { id: 'openai', name: 'OpenAI', desc: 'Advanced reasoning', cost: '3' },
                            { id: 'deepseek', name: 'DeepSeek', desc: 'Code & analysis', cost: '2' },
                          ].map((provider) => (
                            <button
                              key={provider.id}
                              onClick={() => setTextProvider(provider.id as any)}
                              className={`rounded-lg p-3 text-xs transition-all relative ${
                                textProvider === provider.id
                                  ? (darkMode ? 'bg-gray-600 text-white' : 'bg-gray-500 text-white')
                                  : (darkMode ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-gray-100 hover:bg-gray-200')
                              }`}
                            >
                              <div className="font-medium">{provider.name}</div>
                              <div className="opacity-75 text-[10px]">{provider.desc}</div>
                              <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-[9px] flex items-center justify-center ${darkMode ? 'bg-white text-black' : 'bg-black text-white'}`}>
                                {provider.cost}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* Image Generation Models */}
                      {mode === 'image' && (
                        <div className="space-y-2">
                          <div className="rounded-lg border p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border-neutral-300">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-xs font-medium mb-1">Flux Dev (Primary)</div>
                                <div className="text-xs opacity-75">SD3 • High-res • Creative compositions</div>
                              </div>
                              <div className="text-xs font-mono bg-black/10 px-2 py-1 rounded">flux1-dev</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="bg-neutral-100 dark:bg-neutral-800 p-2 rounded">
                              <div className="font-medium">CLIP L+T5</div>
                              <div className="opacity-60">Text encoding</div>
                            </div>
                            <div className="bg-neutral-100 dark:bg-neutral-800 p-2 rounded">
                              <div className="font-medium">Euler</div>
                              <div className="opacity-60">Sampler</div>
                            </div>
                            <div className="bg-neutral-100 dark:bg-neutral-800 p-2 rounded">
                              <div className="font-medium">BF16 VAE</div>
                              <div className="opacity-60">Decoder</div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Image Modification Models */}
                      {mode === 'image-modify' && (
                        <div className="space-y-2">
                          <div className="rounded-lg border p-3 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/30 dark:to-yellow-900/30 border-neutral-300">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-xs font-medium mb-1">Flux Kontext (Image2Image)</div>
                                <div className="text-xs opacity-75">Reference-guided • Style transfer • Image transformation</div>
                              </div>
                              <div className="text-xs font-mono bg-black/10 px-2 py-1 rounded">kontext-dev</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div className="bg-neutral-100 dark:bg-neutral-800 p-2 rounded">
                              <div className="font-medium">Reference</div>
                              <div className="opacity-60">Latent guide</div>
                            </div>
                            <div className="bg-neutral-100 dark:bg-neutral-800 p-2 rounded">
                              <div className="font-medium">ImageStitch</div>
                              <div className="opacity-60">Preprocessing</div>
                            </div>
                            <div className="bg-neutral-100 dark:bg-neutral-800 p-2 rounded">
                              <div className="font-medium">KSampler</div>
                              <div className="opacity-60">Denoising</div>
                            </div>
                            <div className="bg-neutral-100 dark:bg-neutral-800 p-2 rounded">
                              <div className="font-medium">VAE</div>
                              <div className="opacity-60">Encoding</div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Video Generation Models */}
                      {mode === 'video' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { 
                                id: 'ltxv', 
                                name: 'LTXV', 
                                desc: 'Lightning fast', 
                                workflows: 'LTXV-TEXT/IMAGE',
                                model: 'ltxv-13b-0.9.7-dev',
                                features: ['25fps', '97 frames', 'T5XXL', 'Custom sampler']
                              },
                              { 
                                id: 'wan', 
                                name: 'WAN', 
                                desc: 'Smooth motion', 
                                workflows: 'Wan-text/image',
                                model: 'wan-video-model',
                                features: ['24fps', 'Motion aware', 'Stable output', 'High quality']
                              },
                            ].map((model) => (
                              <button
                                key={model.id}
                                onClick={() => setVideoModel(model.id as any)}
                                className={`rounded-lg p-3 text-xs transition-all text-left ${
                                  videoModel === model.id
                                    ? (darkMode ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white')
                                    : (darkMode ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-gray-100 hover:bg-gray-200')
                                }`}
                              >
                                <div className="font-medium">{model.name}</div>
                                <div className="opacity-75 text-[10px] mb-1">{model.desc}</div>
                                <div className="font-mono text-[9px] opacity-60">{model.model}</div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {model.features.map((feature, i) => (
                                    <span key={i} className="bg-black/20 dark:bg-white/20 px-1 py-0.5 rounded text-[8px]">
                                      {feature}
                                    </span>
                                  ))}
                                </div>
                              </button>
                            ))}
                          </div>
                          <div className={`text-xs p-2 rounded border ${darkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-gray-50 border-neutral-300'}`}>
                            <div className="flex items-center justify-between">
                              <span className="opacity-60">Active workflow:</span>
                              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                {attached?.type.startsWith('image')
                                  ? (videoModel === 'wan' ? 'Wan-Image-video.json' : 'LTXIMAGETOVIDEO.json')
                                  : (videoModel === 'wan' ? 'Wan-text-video.json' : 'LTXV-TEXT_VIDEO.json')}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Core Parameters */}
                    <div className="space-y-3">
                      <label className="text-xs font-semibold opacity-90">Core Parameters</label>
                      
                      {/* Essential Controls - Batch and Aspect moved to main view for image-modify/video */}
                      {mode === 'image' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs font-medium opacity-80">Batch Size</label>
                            <select
                              value={batchSize === '' ? '' : String(batchSize)}
                              onChange={(e) => setBatchSize(e.target.value === '' ? '' : Number(e.target.value))}
                              className={`w-full rounded-md border px-2 py-1 text-xs ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-400'}`}
                            >
                              <option value="">Auto (1)</option>
                              {BATCH_CHOICES.map((n) => (
                                <option key={n} value={n}>{n} {n > 1 ? 'items' : 'item'} ({n * 5} credits)</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium opacity-80">Aspect Ratio</label>
                            <select
                              value={aspectRatio}
                              onChange={(e) => setAspectRatio(e.target.value)}
                              className={`w-full rounded-md border px-2 py-1 text-xs ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-400'}`}
                            >
                              <option value="">Auto (1:1)</option>
                              {AR_CHOICES.map((ar) => (
                                <option key={ar} value={ar}>{ar}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Advanced Generation Parameters */}
                      {(mode === 'image' || mode === 'image-modify' || mode === 'video') && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className="text-xs font-medium opacity-80 flex items-center gap-1">
                                CFG Scale
                                <div className="group relative">
                                  <svg className="w-3 h-3 opacity-60 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                  </svg>
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                    Prompt adherence (1-20)
                                  </div>
                                </div>
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                min="1"
                                max="20"
                                placeholder={mode === 'video' ? '3.0' : '1.0'}
                                value={cfgScale}
                                onChange={(e) => setCfgScale(e.target.value === '' ? '' : Number(e.target.value))}
                                className={`w-full rounded-md border px-2 py-1 text-xs ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-400'}`}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium opacity-80 flex items-center gap-1">
                                Guidance
                                <div className="group relative">
                                  <svg className="w-3 h-3 opacity-60 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                  </svg>
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                    Flux guidance (2-5)
                                  </div>
                                </div>
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                min="1"
                                max="10"
                                placeholder={mode === 'image-modify' ? '2.5' : '3.5'}
                                value={guidance}
                                onChange={(e) => setGuidance(e.target.value === '' ? '' : Number(e.target.value))}
                                className={`w-full rounded-md border px-2 py-1 text-xs ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-400'}`}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium opacity-80 flex items-center gap-1">
                                Steps
                                <div className="group relative">
                                  <svg className="w-3 h-3 opacity-60 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                  </svg>
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                    Denoising steps (10-50)
                                  </div>
                                </div>
                              </label>
                              <input
                                type="number"
                                min="10"
                                max="50"
                                placeholder={mode === 'image' ? '23' : mode === 'video' ? '30' : '20'}
                                value={steps}
                                onChange={(e) => setSteps(e.target.value === '' ? '' : Number(e.target.value))}
                                className={`w-full rounded-md border px-2 py-1 text-xs ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-400'}`}
                              />
                            </div>
                          </div>

                          {/* Video-specific parameters */}
                          {mode === 'video' && (
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <label className="text-xs font-medium opacity-80">Frame Rate</label>
                                <select
                                  value="25"
                                  className={`w-full rounded-md border px-2 py-1 text-xs ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-400'}`}
                                >
                                  <option value="24">24 FPS (Cinema)</option>
                                  <option value="25">25 FPS (PAL)</option>
                                  <option value="30">30 FPS (NTSC)</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium opacity-80">Length</label>
                                <select
                                  value="97"
                                  className={`w-full rounded-md border px-2 py-1 text-xs ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-400'}`}
                                >
                                  <option value="49">2s (49 frames)</option>
                                  <option value="73">3s (73 frames)</option>
                                  <option value="97">4s (97 frames)</option>
                                  <option value="121">5s (121 frames)</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium opacity-80">Resolution</label>
                                <select
                                  value="768x512"
                                  className={`w-full rounded-md border px-2 py-1 text-xs ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-400'}`}
                                >
                                  <option value="768x512">768×512 (HD)</option>
                                  <option value="1024x576">1024×576 (FHD)</option>
                                  <option value="512x768">512×768 (Portrait)</option>
                                </select>
                              </div>
                            </div>
                          )}

                          {/* Image-specific advanced options */}
                          {(mode === 'image' || mode === 'image-modify') && (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-xs font-medium opacity-80">Sampler</label>
                                <select
                                  value="euler"
                                  className={`w-full rounded-md border px-2 py-1 text-xs ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-400'}`}
                                >
                                  <option value="euler">Euler (Default)</option>
                                  <option value="euler_ancestral">Euler Ancestral</option>
                                  <option value="heun">Heun</option>
                                  <option value="dpm_2">DPM++ 2M</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium opacity-80">Scheduler</label>
                                <select
                                  value="simple"
                                  className={`w-full rounded-md border px-2 py-1 text-xs ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-400'}`}
                                >
                                  <option value="simple">Simple</option>
                                  <option value="normal">Normal</option>
                                  <option value="karras">Karras</option>
                                  <option value="exponential">Exponential</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Character & Style Control */}
                    {(mode === 'image' || mode === 'image-modify' || mode === 'video') && (
                      <div className="space-y-3">
                        <label className="text-xs font-semibold opacity-90">Character & Style</label>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className="text-xs font-medium opacity-80">Character LoRA {lorasLoading && '(loading...)'}</label>
                            <select
                              value={isPresetLoRa(loraName) ? loraName : (loraName ? 'Custom...' : 'None')}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === 'None') setLoraName('');
                                else if (v === 'Custom...') setLoraName(loraName || '');
                                else setLoraName(v);
                              }}
                              className={`w-full rounded-md border px-2 py-1 text-xs ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-400'}`}
                              disabled={lorasLoading}
                            >
                              {LORA_CHOICES.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                              {availableLoras.map((lora) => (
                                <option key={lora.filename} value={lora.filename}>
                                  {lora.name} ({lora.type})
                                </option>
                              ))}
                            </select>
                            
                            {loraName && !isPresetLoRa(loraName) && (
                              <input
                                type="text"
                                placeholder="custom-character.safetensors"
                                value={loraName}
                                onChange={(e) => setLoraName(e.target.value)}
                                className={`w-full rounded-md border px-2 py-1 text-xs font-mono ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-400'}`}
                              />
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-xs font-medium opacity-80">Character Strength</label>
                            <div className="space-y-1">
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={loraScale || 0.8}
                                onChange={(e) => setLoraScale(Number(e.target.value))}
                                className="w-full"
                              />
                              <div className="flex justify-between text-xs opacity-60">
                                <span>0.0</span>
                                <span className="font-medium">{(loraScale || 0.8).toFixed(2)}</span>
                                <span>1.0</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Effects LoRA */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className="text-xs font-medium opacity-80">Effects LoRA {lorasLoading && '(loading...)'}</label>
                            <select
                              value={isPresetLoRa(effectLora) ? effectLora : (effectLora ? 'Custom...' : 'None')}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === 'None') setEffectLora('');
                                else if (v === 'Custom...') setEffectLora(effectLora || '');
                                else setEffectLora(v);
                              }}
                              className={`w-full rounded-md border px-2 py-1 text-xs ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-400'}`}
                              disabled={lorasLoading}
                            >
                              {LORA_CHOICES.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                              {availableLoras.map((lora) => (
                                <option key={lora.filename} value={lora.filename}>
                                  {lora.name} ({lora.type})
                                </option>
                              ))}
                            </select>
                            {effectLora && !isPresetLoRa(effectLora) && (
                              <input
                                type="text"
                                placeholder="effects-style.safetensors"
                                value={effectLora}
                                onChange={(e) => setEffectLora(e.target.value)}
                                className={`w-full rounded-md border px-2 py-1 text-xs font-mono ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-400'}`}
                              />
                            )}
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium opacity-80">Effects Strength</label>
                            <div className="space-y-1">
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={effectLoraScale || 0.6}
                                onChange={(e) => setEffectLoraScale(Number(e.target.value))}
                                className="w-full"
                              />
                              <div className="flex justify-between text-xs opacity-60">
                                <span>0.0</span>
                                <span className="font-medium">{(effectLoraScale || 0.6).toFixed(2)}</span>
                                <span>1.0</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Style Presets */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium opacity-80">Style Enhance</label>
                          <div className="grid grid-cols-4 gap-1">
                            {[
                              { id: 'off', name: 'None', desc: '' },
                              { id: 'subtle', name: 'Subtle', desc: 'Light enhancement' },
                              { id: 'cinematic', name: 'Cinema', desc: 'Film look' },
                              { id: 'stylized', name: 'Artistic', desc: 'Creative style' }
                            ].map((preset) => (
                              <button
                                key={preset.id}
                                onClick={() => {
                                  setEffectsPreset(preset.id as any);
                                  setEffectsOn(preset.id !== 'off');
                                }}
                                className={`rounded p-2 text-xs transition-all ${
                                  effectsPreset === preset.id
                                    ? (darkMode ? 'bg-purple-600 text-white' : 'bg-purple-500 text-white')
                                    : (darkMode ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-gray-100 hover:bg-gray-200')
                                }`}
                              >
                                <div className="font-medium">{preset.name}</div>
                                {preset.desc && <div className="opacity-75 text-[10px]">{preset.desc}</div>}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Seed & Advanced */}
                    <div className="space-y-3">
                      <label className="text-xs font-semibold opacity-90">Advanced Control</label>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs font-medium opacity-80">Seed</label>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              placeholder="Random"
                              className={`flex-1 rounded-md border px-2 py-1 text-xs font-mono ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-400'}`}
                            />
                            <button
                              onClick={() => {
                                // Generate random seed
                                const randomSeed = Math.floor(Math.random() * 1000000000000);
                                // You'd need to add a seed state variable
                              }}
                              className={`px-2 rounded border text-xs ${darkMode ? 'border-neutral-700 hover:bg-neutral-800' : 'border-neutral-400 hover:bg-gray-50'}`}
                            >
                              🎲
                            </button>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-xs font-medium opacity-80">Denoise</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            placeholder={mode === 'image-modify' ? '1.0' : '0.8'}
                            className={`w-full rounded-md border px-2 py-1 text-xs ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-400'}`}
                          />
                        </div>
                      </div>

                      {/* Negative Prompt */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium opacity-80">Negative Prompt</label>
                        <textarea
                          placeholder={mode === 'video' ? "low quality, worst quality, deformed, distorted, disfigured, motion smear, motion artifacts, fused fingers, bad anatomy, weird hand, ugly" : "low quality, bad anatomy, worst quality, low resolution"}
                          rows={2}
                          className={`w-full rounded-md border px-2 py-1 text-xs resize-none ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-400'}`}
                        />
                      </div>
                    </div>

                    {/* Cost Summary */}
                    <div className={`rounded-lg border p-3 ${darkMode ? 'border-emerald-700 bg-emerald-900/20' : 'border-emerald-300 bg-emerald-50'}`}>
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium">Generation Cost</div>
                        <div className="text-xs font-mono">
                          ~{generationCost} credits
                          {batchSize && batchSize > 1 && ` × ${batchSize} = ${generationCost * batchSize}`}
                        </div>
                      </div>
                      <div className="text-xs opacity-70 mt-1">
                        {mode === 'text' ? 'Text generation' : 
                         mode === 'image' ? 'Image generation' : 
                         mode === 'image-modify' ? 'Image modification' : 
                         'Video generation'} • 
                        {mode === 'text' ? textProvider.toUpperCase() : 
                         mode === 'video' ? videoModel.toUpperCase() : 'FLUX'} model
                      </div>
                    </div>
                  </div>
                )}
                {/* Collapsible Mode buttons row with Save Project on right - DIFFERENT FOR MOBILE AND DESKTOP */}
                {modeRowExpanded && (
                  <div className={`mb-2 flex items-center ${isMobile ? 'gap-1 justify-between overflow-x-auto' : 'gap-2 justify-between'} transition-all duration-300 animate-in slide-in-from-top-2`}>
                  <div className={`flex items-center ${isMobile ? 'gap-1 flex-nowrap min-w-0' : 'gap-1 flex-wrap'}`}>
                    {/* Mode buttons - SVG icons for mobile, text for desktop */}
                    {isMobile ? (
                      <>
                        {/* Mobile: SVG icon buttons (no background) */}
                        <button 
                          title="Text mode" 
                          onClick={() => setMode('text')}
                          className={`p-2 transition-all ${
                            mode === 'text'
                              ? 'opacity-100 scale-110'
                              : 'opacity-60 hover:opacity-90 hover:scale-105'
                          }`}
                        > 
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" className={`transition-colors ${mode === 'text' ? 'stroke-gray-500' : 'stroke-current'}`}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <polyline points="14,2 14,8 20,8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <line x1="16" y1="13" x2="8" y2="13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <line x1="16" y1="17" x2="8" y2="17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <button 
                          title="Image mode" 
                          onClick={() => setMode('image')}
                          className={`p-2 transition-all ${
                            mode === 'image'
                              ? 'opacity-100 scale-110'
                              : 'opacity-60 hover:opacity-90 hover:scale-105'
                          }`}
                        > 
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" className={`transition-colors ${mode === 'image' ? 'stroke-green-500' : 'stroke-current'}`}>
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <polyline points="21,15 16,10 5,21" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <button 
                          title="Modify image" 
                          onClick={() => setMode('image-modify')}
                          className={`p-2 transition-all ${
                            mode === 'image-modify'
                              ? 'opacity-100 scale-110'
                              : 'opacity-60 hover:opacity-90 hover:scale-105'
                          }`}
                        > 
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" className={`transition-colors ${mode === 'image-modify' ? 'stroke-purple-500' : 'stroke-current'}`}>
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <button 
                          title="Video mode" 
                          onClick={() => setMode('video')}
                          className={`p-2 transition-all ${
                            mode === 'video'
                              ? 'opacity-100 scale-110'
                              : 'opacity-60 hover:opacity-90 hover:scale-105'
                          }`}
                        > 
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" className={`transition-colors ${mode === 'video' ? 'stroke-red-500' : 'stroke-current'}`}>
                            <polygon points="23 7 16 12 23 17 23 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Desktop: SVG icon buttons (same as mobile) */}
                        <button 
                          title="Text mode" 
                          onClick={() => setMode('text')}
                          className={`p-2 rounded-lg transition-all ${
                            mode === 'text'
                              ? 'bg-gray-500/20 scale-110'
                              : 'hover:bg-neutral-800/50 hover:scale-105'
                          }`}
                        > 
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" className={`transition-colors ${mode === 'text' ? 'stroke-gray-500' : 'stroke-current'}`}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <polyline points="14,2 14,8 20,8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <line x1="16" y1="13" x2="8" y2="13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <line x1="16" y1="17" x2="8" y2="17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <button 
                          title="Image mode" 
                          onClick={() => setMode('image')}
                          className={`p-2 rounded-lg transition-all ${
                            mode === 'image'
                              ? 'bg-green-500/20 scale-110'
                              : 'hover:bg-neutral-800/50 hover:scale-105'
                          }`}
                        > 
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" className={`transition-colors ${mode === 'image' ? 'stroke-green-500' : 'stroke-current'}`}>
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <polyline points="21,15 16,10 5,21" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <button 
                          title="Modify image" 
                          onClick={() => setMode('image-modify')}
                          className={`p-2 rounded-lg transition-all ${
                            mode === 'image-modify'
                              ? 'bg-purple-500/20 scale-110'
                              : 'hover:bg-neutral-800/50 hover:scale-105'
                          }`}
                        > 
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" className={`transition-colors ${mode === 'image-modify' ? 'stroke-purple-500' : 'stroke-current'}`}>
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <button 
                          title="Video mode" 
                          onClick={() => setMode('video')}
                          className={`p-2 rounded-lg transition-all ${
                            mode === 'video'
                              ? 'bg-red-500/20 scale-110'
                              : 'hover:bg-neutral-800/50 hover:scale-105'
                          }`}
                        > 
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" className={`transition-colors ${mode === 'video' ? 'stroke-red-500' : 'stroke-current'}`}>
                            <polygon points="23 7 16 12 23 17 23 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </>
                    )}
                    
                    {/* Mode-specific controls - same layout for both */}
                    {mode === 'text' && (
                      <div className="flex items-center gap-1">
                        <select
                          value={chatMode}
                          onChange={(e)=> setChatMode(e.target.value as any)}
                          className={`${isMobile ? 'px-1 py-1.5 text-xs min-w-0 max-w-[80px]' : 'px-2 py-1 text-sm'} border rounded ${darkMode ? 'bg-neutral-800 border-neutral-600 text-neutral-100' : 'bg-white border-neutral-300'} touch-manipulation`}
                          title="AI Mode"
                        >
                          <option value="normal">General</option>
                          <option value="prompt">Prompt</option>
                          <option value="creative">Creative</option>
                          <option value="think">Think</option>
                        </select>
                      </div>
                    )}
                    
                    {(mode === 'image' || mode === 'image-modify') && (
                      <>
                        {/* Advanced Controls Toggle */}
                        <button
                          onClick={() => setShowAdvancedControls(!showAdvancedControls)}
                          className={`${isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-1 text-sm'} border rounded transition-all ${showAdvancedControls ? (darkMode ? 'bg-gray-600 border-gray-500 text-white' : 'bg-gray-500 border-gray-400 text-white') : (darkMode ? 'bg-neutral-800 border-neutral-600 text-neutral-100 hover:bg-neutral-700' : 'bg-white border-neutral-300 hover:bg-neutral-50')} touch-manipulation`}
                          title="Advanced Controls"
                        >
                          <div className="flex items-center gap-1">
                            <svg width={isMobile ? "12" : "14"} height={isMobile ? "12" : "14"} viewBox="0 0 24 24" fill="none" className="transition-transform duration-200" style={{ transform: showAdvancedControls ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            {!isMobile && <span>Style</span>}
                          </div>
                        </button>

                        {showAdvancedControls && (
                          <>
                            {/* Effects LoRA (Power Loader) */}
                            <select
                              value={isPresetLoRa(effectLora) ? effectLora : (effectLora ? 'Custom...' : 'None')}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === 'None') setEffectLora('');
                                else if (v === 'Custom...') setEffectLora(effectLora || '');
                                else setEffectLora(v);
                              }}
                              className={`${isMobile ? 'px-1 py-1.5 text-xs min-w-0 max-w-[110px]' : 'px-2 py-1 text-sm'} border rounded ${darkMode ? 'bg-neutral-800 border-neutral-600 text-neutral-100' : 'bg-white border-neutral-300'} touch-manipulation`}
                              title="Effects LoRA"
                            >
                              {(['None','Custom...'] as const).map((opt) => (
                                <option key={opt} value={opt}>{isMobile ? (opt === 'Custom...' ? 'Custom' : opt) : opt}</option>
                              ))}
                              {availableLoras.map((lora) => (
                                <option key={lora.filename} value={lora.filename}>
                                  {isMobile ? (lora.name || lora.filename).slice(0, 10) : `${lora.name} (${lora.type})`}
                                </option>
                              ))}
                            </select>

                            {/* Character LoRA */}
                            <select
                              value={isPresetLoRa(loraName) ? loraName : (loraName ? 'Custom...' : 'None')}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === 'None') setLoraName('');
                                else if (v === 'Custom...') setLoraName(loraName || '');
                                else setLoraName(v);
                              }}
                              className={`${isMobile ? 'px-1 py-1.5 text-xs min-w-0 max-w-[110px]' : 'px-2 py-1 text-sm'} border rounded ${darkMode ? 'bg-neutral-800 border-neutral-600 text-neutral-100' : 'bg-white border-neutral-300'} touch-manipulation`}
                              title="Character LoRA"
                            >
                              {(['None','Custom...'] as const).map((opt) => (
                                <option key={opt} value={opt}>{isMobile ? (opt === 'Custom...' ? 'Custom' : opt) : opt}</option>
                              ))}
                              {availableLoras.map((lora) => (
                                <option key={lora.filename} value={lora.filename}>
                                  {isMobile ? (lora.name || lora.filename).slice(0, 10) : `${lora.name} (${lora.type})`}
                                </option>
                              ))}
                            </select>
                          </>
                        )}

                        {/* Batch size */}
                        <select
                          value={batchSize === '' ? '1' : String(batchSize)}
                          onChange={(e) => setBatchSize(e.target.value === '1' ? '' : Number(e.target.value))}
                          className={`${isMobile ? 'px-1 py-1.5 text-xs min-w-0 max-w-[60px]' : 'px-2 py-1 text-sm'} border rounded ${darkMode ? 'bg-neutral-800 border-neutral-600 text-neutral-100' : 'bg-white border-neutral-300'} touch-manipulation`}
                          title="Quantity"
                        >
                          {BATCH_CHOICES.map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>

                        {/* Aspect ratio */}
                        <select
                          value={aspectRatio}
                          onChange={(e) => setAspectRatio(e.target.value)}
                          className={`${isMobile ? 'px-1 py-1.5 text-xs min-w-0 max-w-[60px]' : 'px-2 py-1 text-sm'} border rounded ${darkMode ? 'bg-neutral-800 border-neutral-600 text-neutral-100' : 'bg-white border-neutral-300'} touch-manipulation`}
                          title="Aspect Ratio"
                        >
                          <option value="">{mode === 'image' ? '1:1' : '1:1'}</option>
                          {AR_CHOICES.map((ar) => (
                            <option key={ar} value={ar}>{ar}</option>
                          ))}
                        </select>
                      </>
                    )}

                    {mode === 'video' && (
                      <>
                        <select
                          value={videoModel}
                          onChange={(e) => setVideoModel(e.target.value as any)}
                          className={`${isMobile ? 'px-1 py-1.5 text-xs min-w-0 max-w-[70px]' : 'px-2 py-1 text-sm'} border rounded ${darkMode ? 'bg-neutral-800 border-neutral-600 text-neutral-100' : 'bg-white border-neutral-300'} touch-manipulation`}
                          title="Video model"
                        >
                          <option value="ltxv">{isMobile ? 'LTXV' : 'LTXV Model'}</option>
                          <option value="wan">{isMobile ? 'WAN' : 'WAN Model'}</option>
                        </select>

                        <select
                          value={batchSize === '' ? '1' : String(batchSize)}
                          onChange={(e) => setBatchSize(e.target.value === '1' ? '' : Number(e.target.value))}
                          className={`${isMobile ? 'px-1 py-1.5 text-xs min-w-0 max-w-[60px]' : 'px-2 py-1 text-sm'} border rounded ${darkMode ? 'bg-neutral-800 border-neutral-600 text-neutral-100' : 'bg-white border-neutral-300'} touch-manipulation`}
                          title="Quantity"
                        >
                          {BATCH_CHOICES.map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>

                        <select
                          value={aspectRatio}
                          onChange={(e) => setAspectRatio(e.target.value)}
                          className={`${isMobile ? 'px-1 py-1.5 text-xs min-w-0 max-w-[60px]' : 'px-2 py-1 text-sm'} border rounded ${darkMode ? 'bg-neutral-800 border-neutral-600 text-neutral-100' : 'bg-white border-neutral-300'} touch-manipulation`}
                          title="Aspect Ratio"
                        >
                          <option value="">16:9</option>
                          {AR_CHOICES.map((ar) => (
                            <option key={ar} value={ar}>{ar}</option>
                          ))}
                        </select>
                      </>
                    )}

                    {mode === 'image' && (
                      <>
                        <button
                          onClick={() => setImgTab('character')}
                          className={`${isMobile ? 'px-2 py-1.5 text-xs min-w-0 max-w-[80px]' : 'px-2 py-1 text-sm'} border rounded transition-colors ${darkMode ? 'bg-neutral-800 border-neutral-600 text-neutral-100 hover:bg-neutral-700' : 'bg-white border-neutral-300 hover:bg-neutral-50'} touch-manipulation`}
                        >
                          {isMobile ? 'Char' : 'Character'}
                        </button>
                        {loraName && (
                          <span className={`${isMobile ? 'px-1 py-1 text-xs max-w-[60px] truncate' : 'px-2 py-1 text-xs'} rounded font-mono ${darkMode ? 'bg-neutral-700 text-neutral-300' : 'bg-neutral-100 text-neutral-600'}`}>
                            {isMobile ? loraName.slice(0, 8) : loraName}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Project Management - Always visible */}
                    <div className="relative flex items-center gap-2" data-project-dropdown>
                      {/* Save Project Icon */}
                      <button
                        className={`rounded-lg p-1.5 shadow-lg transition-all duration-200 hover:scale-105 ${darkMode ? 'bg-gray-600 hover:bg-gray-700 border border-gray-500 text-white' : 'bg-gray-500 hover:bg-gray-600 text-white shadow-gray-200'}`}
                        onClick={()=> setProjectModalOpen(true)}
                        title="Save Project"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" className="shrink-0">
                          <path d="M4 7a2 2 0 012-2h8l4 4v8a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.6" fill="none"/>
                          <path d="M8 7h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                          <rect x="8" y="12" width="8" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6"/>
                        </svg>
                      </button>

                      {/* Project Dropdown - Always visible on desktop */}
                      {!isMobile && (
                        <>
                          <button
                            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs shadow-lg transition-all duration-200 hover:scale-105 min-w-[120px] ${darkMode ? 'bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-white' : 'bg-white hover:bg-neutral-50 text-neutral-800 shadow-neutral-200 border border-neutral-200'}`}
                            onClick={() => {
                              setProjectDropdownOpen(!projectDropdownOpen);
                              if (!projectDropdownOpen) loadProjects();
                            }}
                            title="Switch Project"
                          >
                            <span className="truncate flex-1 text-left">
                              {currentProjectTitle || 'New Project'}
                            </span>
                            <svg 
                              xmlns="http://www.w3.org/2000/svg" 
                              viewBox="0 0 24 24" 
                              width="12" 
                              height="12" 
                              fill="none"
                              className={`shrink-0 transition-transform duration-200 ${projectDropdownOpen ? 'rotate-180' : ''}`}
                            >
                              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>

                          {/* Dropdown Menu */}
                          {projectDropdownOpen && (
                            <div className={`absolute top-full right-0 mt-1 w-72 rounded-xl border shadow-xl z-[10002] max-h-80 overflow-y-auto ${darkMode ? 'bg-neutral-800 border-neutral-600 text-white' : 'bg-white border-neutral-200'}`}>
                              {/* New Project Option */}
                              <button
                                className={`w-full px-4 py-3 text-left text-sm transition-colors border-b ${darkMode ? 'hover:bg-neutral-700 border-neutral-600' : 'hover:bg-neutral-50 border-neutral-200'}`}
                                onClick={() => {
                                  setCurrentProjectId(null);
                                  setCurrentProjectTitle(null);
                                  setMessages([]);
                                  setCanvasItems([]);
                                  setProjectDropdownOpen(false);
                                }}
                              >
                                <div className="font-medium">✨ New Project</div>
                                <div className={`text-xs mt-1 ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                  Start fresh with empty chat and canvas
                                </div>
                              </button>

                              {/* Existing Projects */}
                              {projectsLoading ? (
                                <div className={`px-4 py-6 text-center text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                  Loading projects...
                                </div>
                              ) : projects.length > 0 ? (
                                projects.map((project) => (
                                  <button
                                    key={project.id}
                                    className={`w-full px-4 py-3 text-left text-sm transition-colors ${currentProjectId === project.id ? (darkMode ? 'bg-gray-900/50' : 'bg-gray-50') : (darkMode ? 'hover:bg-neutral-700' : 'hover:bg-neutral-50')}`}
                                    onClick={() => switchToProject(project.id, project.title)}
                                  >
                                    <div className="font-medium truncate">{project.title}</div>
                                    <div className={`text-xs mt-1 ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                      {new Date(project.updated_at).toLocaleDateString()}
                                    </div>
                                  </button>
                                ))
                              ) : (
                                <div className={`px-4 py-6 text-center text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                  No saved projects yet
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                )}

                {/* Prompt input area with underglow effect */}
                <div className={`flex gap-2 items-end ${isMobile ? 'p-2' : 'p-2'} ${isMobile ? 'relative' : ''} transition-all duration-300 ${input.trim() ? 'drop-shadow-[0_8px_16px_rgba(6,182,212,0.15)]' : 'drop-shadow-[0_4px_8px_rgba(6,182,212,0.05)]'}`}>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e)=>{ if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder=""
                    className={`${isMobile ? 'min-h-[32px] max-h-[80px] text-sm' : 'min-h-[40px] max-h-[120px]'} flex-1 resize-none rounded-lg p-3 pr-10 transition-all duration-300 focus:outline-none border-0 ${input.trim() ? 'focus:ring-2 focus:ring-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.2)]' : 'focus:ring-2 focus:ring-cyan-400/30 shadow-[0_0_8px_rgba(6,182,212,0.08)]'} ${darkMode ? 'bg-neutral-800 text-neutral-100 placeholder-neutral-400' : 'bg-gray-50 text-neutral-900 placeholder-neutral-500'} ${isMobile ? 'touch-manipulation' : ''}`}
                    ref={bottomInputRef}
                    style={{ 
                      fontSize: isMobile ? '16px' : '14px'  // Prevent zoom on iOS
                    }}
                    disabled={isGeneratingBatch}
                  />
                    {/* Action buttons in 2x2 grid for more text box space */}
                  <div className="grid grid-cols-2 gap-1.5 mt-3" style={{ marginTop: '22px' }}>
                    {/* Top row: Send + Atom AI Toggle */}
                    <button
                      onClick={handleSend}
                      disabled={isGeneratingBatch || !input.trim() || !canAffordGeneration}
                      className={`group relative ${isMobile ? 'h-9 w-9' : 'h-8 w-8'} cursor-pointer rounded-lg flex items-center justify-center transition-all hover:scale-105 ${
                        darkMode ? 'hover:bg-neutral-800/30' : 'hover:bg-gray-100/50'
                      } ${!canAffordGeneration || !input.trim() ? 'cursor-not-allowed opacity-50' : ''}`}
                      title={canAffordGeneration ? `Send to Atom AI` : `Need ${generationCost} credits`}
                      aria-label="Send to Atom AI"
                    >
                      {/* Clean Send Arrow SVG Icon */}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={isMobile ? "18" : "16"} height={isMobile ? "18" : "16"} fill="none" className="transition-all">
                        <path
                          d="M22 2L11 13"
                          stroke={canAffordGeneration && input.trim() ? "rgb(6,182,212)" : (darkMode ? "#94a3b8" : "#64748b")}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="transition-colors"
                        />
                        <path
                          d="M22 2L15 22L11 13L2 9L22 2Z"
                          stroke={canAffordGeneration && input.trim() ? "rgb(6,182,212)" : (darkMode ? "#94a3b8" : "#64748b")}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="transition-colors"
                        />
                      </svg>
                    </button>

                    {/* Atom AI Toggle button - moved to top row */}
                    <button
                      title="Toggle AI Controls"
                      onClick={() => setModeRowExpanded(!modeRowExpanded)}
                      className={`${isMobile ? 'h-8 w-8' : 'h-8 w-8'} rounded-lg transition-all duration-300 flex items-center justify-center hover:scale-105 ${
                        darkMode ? 'hover:bg-neutral-800/30' : 'hover:bg-gray-100/50'
                      }`}
                    >
                      {/* Enhanced Atom SVG Icon - More Descriptive */}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" className="transition-colors">
                        {/* Central nucleus with gradient effect */}
                        <circle cx="12" cy="12" r="2.5" fill={modeRowExpanded ? 'rgb(6,182,212)' : 'currentColor'} className="transition-colors"/>
                        <circle cx="12" cy="12" r="1.5" fill={modeRowExpanded ? 'rgb(6,182,212)' : 'currentColor'} opacity="0.6" className="transition-colors"/>

                        {/* Electron orbits - more visible and descriptive */}
                        <ellipse cx="12" cy="12" rx="8" ry="3" stroke={modeRowExpanded ? 'rgb(6,182,212)' : 'currentColor'} strokeWidth="1.5" fill="none" className="transition-colors" opacity="0.8"/>
                        <ellipse cx="12" cy="12" rx="3" ry="8" stroke={modeRowExpanded ? 'rgb(6,182,212)' : 'currentColor'} strokeWidth="1.5" fill="none" className="transition-colors" opacity="0.8"/>
                        <ellipse cx="12" cy="12" rx="5.5" ry="5.5" stroke={modeRowExpanded ? 'rgb(6,182,212)' : 'currentColor'} strokeWidth="1.5" fill="none" transform="rotate(45 12 12)" className="transition-colors" opacity="0.8"/>

                        {/* Electrons with enhanced visibility */}
                        <circle cx="20" cy="12" r="1.5" fill={modeRowExpanded ? 'rgb(6,182,212)' : 'currentColor'} className="transition-colors"/>
                        <circle cx="4" cy="12" r="1.5" fill={modeRowExpanded ? 'rgb(6,182,212)' : 'currentColor'} className="transition-colors"/>
                        <circle cx="12" cy="4" r="1.5" fill={modeRowExpanded ? 'rgb(6,182,212)' : 'currentColor'} className="transition-colors"/>
                        <circle cx="12" cy="20" r="1.5" fill={modeRowExpanded ? 'rgb(6,182,212)' : 'currentColor'} className="transition-colors"/>

                        {/* Atomic symbol "A" hint in center */}
                        <text x="12" y="12.5" textAnchor="middle" fontSize="3" fill={modeRowExpanded ? 'white' : 'currentColor'} className="transition-colors" opacity="0.7">A</text>
                      </svg>
                    </button>

                    {/* Bottom row: Upload + Library */}
                    <label className={`group cursor-pointer rounded-lg p-1.5 flex items-center justify-center transition-all hover:scale-105 hover:bg-gray-500/10`} title="Attach image/video/pdf">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={isMobile ? "18" : "16"} height={isMobile ? "18" : "16"} fill="none" className="transition-colors group-hover:stroke-gray-400">
                        <path d="M21.44 11.05L12.25 20.24a7 7 0 11-9.9-9.9L11.54 1.15a5 5 0 017.07 7.07L9.42 17.41a3 3 0 01-4.24-4.24L13.4 4.95" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <input
                        type="file"
                        accept="image/*,video/*,application/pdf"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;

                          // Process image files for better AI compatibility
                          if (f.type.startsWith('image/')) {
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            const img = new Image();

                            img.onload = () => {
                              // Resize if too large (max 1024px on longest side for efficiency)
                              const maxSize = 1024;
                              let { width, height } = img;

                              if (width > maxSize || height > maxSize) {
                                if (width > height) {
                                  height = (height * maxSize) / width;
                                  width = maxSize;
                                } else {
                                  width = (width * maxSize) / height;
                                  height = maxSize;
                                }
                              }

                              canvas.width = width;
                              canvas.height = height;
                              ctx?.drawImage(img, 0, 0, width, height);

                              // Convert to JPEG for better compatibility and smaller size
                              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                              setAttached({ name: f.name, type: 'image/jpeg', dataUrl });
                            };

                            const reader = new FileReader();
                            reader.onload = () => {
                              img.src = String(reader.result || '');
                            };
                            reader.readAsDataURL(f);
                          } else if (f.type === 'application/pdf') {
                            // For PDF files, convert first page to image for vision processing
                            const reader = new FileReader();
                            reader.onload = async () => {
                              try {
                                // For now, store PDF as-is and we'll handle conversion in the API
                                // In the future, we can implement client-side PDF-to-image conversion
                                const dataUrl = String(reader.result || '');
                                setAttached({ name: f.name, type: 'application/pdf', dataUrl });
                              } catch (error) {
                                console.error('PDF processing error:', error);
                                // Fallback: just store the PDF
                                const dataUrl = String(reader.result || '');
                                setAttached({ name: f.name, type: 'application/pdf', dataUrl });
                              }
                            };
                            reader.readAsDataURL(f);
                          } else {
                            // For other files, use direct FileReader
                            const reader = new FileReader();
                            reader.onload = () => {
                              const dataUrl = String(reader.result || '');
                              setAttached({ name: f.name, type: f.type, dataUrl });
                            };
                            reader.readAsDataURL(f);
                          }
                        }}
                      />
                    </label>

                    {/* Library button - moved to bottom row */}
                    <button
                      onClick={() => setShowLibraryModal(true)}
                      className={`${isMobile ? 'h-8 w-8' : 'h-8 w-8'} rounded-lg transition-all flex items-center justify-center ${darkMode ? 'hover:bg-neutral-800/50 hover:scale-105' : 'hover:bg-gray-100 hover:scale-105'}`}
                      title="View Library"
                      aria-label="Open Library"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" className="transition-colors">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2" stroke="currentColor"/>
                        <path d="M7 7h10M7 12h8M7 17h6" strokeWidth="2" stroke="currentColor"/>
                        <circle cx="16" cy="16" r="3" strokeWidth="2" stroke="currentColor"/>
                      </svg>
                    </button>
                  </div>
                </div>
                {attached ? (
                  <div className={`${isMobile ? 'mx-3 mb-2' : 'mt-2'} flex items-center gap-2 ${isMobile ? '' : ''}`}>
                    <div className={`flex items-center gap-2 rounded-lg border ${isMobile ? 'p-2 flex-1' : 'p-3 w-full'} ${darkMode ? 'border-neutral-700 bg-neutral-800/50' : 'border-gray-200 bg-gray-50'}`}>
                      {attached && attached.type.startsWith('image') ? (
                        <img src={attached.dataUrl} alt={attached.name || 'attachment'} className={`${isMobile ? 'h-10 w-10' : 'h-16 w-16'} object-cover rounded-lg`} />
                      ) : attached && attached.type.startsWith('video') ? (
                        <div className={`${isMobile ? 'h-10 w-10' : 'h-16 w-16'} overflow-hidden rounded-lg border`}>
                          <video src={attached.dataUrl} className="h-full w-full object-cover" />
                        </div>
                      ) : attached && attached.type === 'application/pdf' ? (
                        <div className={`flex ${isMobile ? 'h-10 w-10' : 'h-16 w-16'} items-center justify-center rounded-lg border ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-600'}`}>
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                          </svg>
                        </div>
                      ) : (
                        <div className={`flex ${isMobile ? 'h-10 w-10' : 'h-16 w-16'} items-center justify-center rounded-lg border ${darkMode ? 'bg-neutral-900 border-neutral-700 text-neutral-300' : 'bg-white text-black'}`}>
                          📄
                        </div>
                      )}
                      <div className={`${isMobile ? 'text-xs' : 'text-sm'} flex-1 min-w-0`}>
                        <div className={`font-medium truncate`} title={attached?.name || ''}>{attached?.name || ''}</div>
                        <div className={`opacity-70 ${darkMode ? 'text-neutral-400' : 'text-gray-500'}`}>{attached?.type || ''}</div>
                      </div>
                    </div>
                    <button
                      className={`rounded-lg border ${isMobile ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} font-medium transition-all hover:scale-105 ${darkMode ? 'border-neutral-700 hover:bg-neutral-800 text-neutral-300' : 'border-gray-300 hover:bg-gray-100 text-gray-700'}`}
                      onClick={() => setAttached(null)}
                    >
                      {isMobile ? '✕' : 'Remove'}
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          )}

          {/* Projects tab removed - now accessible via Dashboard */}

          {activeTab === 'generated' && (
            <div className="flex-1 overflow-hidden bg-black">
              {/* Full screen infinite gallery - within tab content area */}
              <div className="h-full w-full relative">
                {/* Floating controls overlay */}
                <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
                  <div className={`text-sm px-3 py-2 rounded-full backdrop-blur-md ${darkMode ? 'bg-black/50 text-white' : 'bg-white/80 text-black'}`}>
                    {binItems.length} generations
                  </div>
                  <button
                    className={`rounded-full px-4 py-2 text-sm backdrop-blur-md transition-colors ${darkMode ? 'bg-black/50 hover:bg-black/70 text-white border border-white/20' : 'bg-white/80 hover:bg-white text-black border border-black/20'}`}
                    onClick={async () => {
                      const r = await fetch('/api/social-twin/history?limit=48', { headers: { 'X-User-Id': userId || '' } });
                      const j = await r.json();
                      setBinItems(j.items || []);
                      setBinCursor(j.nextCursor || null);
                    }}
                  >
                    Refresh
                  </button>
                </div>
                
                {/* Vertical scroll grid with even small thumbnails */}
                <div className="h-full w-full overflow-y-auto p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
                    {[...binItems].sort((a,b)=> new Date(b.created_at||b.createdAt||0).getTime() - new Date(a.created_at||a.createdAt||0).getTime()).map((it, index) => {
                      const url = it.display_url || it.result_url;
                      const isVideo = it.type === 'video';
                      
                      return (
                        <div 
                          key={it.id} 
                          className={`aspect-square relative group cursor-pointer rounded-lg overflow-hidden ${darkMode ? 'bg-neutral-900' : 'bg-white'} transition-all duration-300 hover:scale-105 hover:shadow-xl hover:z-10`}
                          onClick={() => {
                            setViewerItem(it);
                            setViewerOpen(true);
                          }}
                          onMouseEnter={() => {
                            if (isVideo) setHoverVideoIds(prev => { const n = new Set(prev); n.add(it.id); return n; });
                          }}
                          onMouseLeave={() => {
                            if (isVideo) setHoverVideoIds(prev => { const n = new Set(prev); n.delete(it.id); return n; });
                          }}
                        >
                          {/* Content - even square size */}
                          <div className="w-full h-full">
                            {isVideo ? (
                              (url ? (
                                (!lowDataMode || mediaAllowed.has(it.id)) ? (
                                  <video 
                                    src={(typeof url==='string' && url.startsWith('http') && !url.startsWith(getLocationOrigin())) ? (`/api/social-twin/proxy?url=${encodeURIComponent(url)}`) : (url as string)} 
                                    className="h-full w-full object-cover" 
                                    preload="metadata" 
                                    muted
                                    playsInline
                                    controls={hoverVideoIds.has(it.id)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <div 
                                    className={`w-full h-full flex items-center justify-center text-2xl ${darkMode ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMediaAllowed(prev=>{ const n = new Set(prev); n.add(it.id); return n; });
                                    }}
                                  >
                                    📹
                                  </div>
                                )
                              ) : (
                                <div className={`h-full w-full ${darkMode?'bg-neutral-800':'bg-gray-100'} flex items-center justify-center text-2xl opacity-70`}>
                                  ⏳
                                </div>
                              ))
                            ) : (
                              url ? (
                                <img 
                                  src={(typeof url==='string' && url.startsWith('http') && !url.startsWith(getLocationOrigin())) ? (`/api/social-twin/proxy?url=${encodeURIComponent(url)}`) : (url as string)} 
                                  className="h-full w-full object-cover" 
                                  loading="lazy" 
                                  alt="Generated content"
                                  onError={(e) => {
                                    // Replace broken image with status-based placeholder
                                    const status = it.status || 'completed';
                                    const statusEmoji = status === 'completed' ? '🎨' : status === 'pending' ? '⏳' : status === 'processing' ? '⚙️' : '❌';
                                    const statusText = status === 'completed' ? 'Generated' : status.charAt(0).toUpperCase() + status.slice(1);
                                    
                                    e.currentTarget.style.display = 'none';
                                    const parent = e.currentTarget.parentElement;
                                    if (parent && !parent.querySelector('.fallback-placeholder')) {
                                      const placeholder = document.createElement('div');
                                      placeholder.className = `fallback-placeholder h-full w-full flex flex-col items-center justify-center text-center ${darkMode ? 'bg-neutral-800 text-white' : 'bg-gray-100 text-gray-600'}`;
                                      placeholder.innerHTML = `
                                        <div class="text-2xl mb-1">${statusEmoji}</div>
                                        <div class="text-xs opacity-70">${statusText}</div>
                                        ${status === 'completed' ? '<div class="text-xs opacity-50 mt-1">URL expired</div>' : ''}
                                      `;
                                      parent.appendChild(placeholder);
                                    }
                                  }}
                                />
                              ) : (
                                <div className={`h-full w-full flex flex-col items-center justify-center text-center ${darkMode ? 'bg-neutral-800 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                  <div className="text-2xl mb-1">{it.status === 'pending' ? '⏳' : it.status === 'processing' ? '⚙️' : it.status === 'failed' ? '❌' : '🎨'}</div>
                                  <div className="text-xs opacity-70">{it.status ? it.status.charAt(0).toUpperCase() + it.status.slice(1) : 'Generated'}</div>
                                  {it.status === 'completed' && <div className="text-xs opacity-50 mt-1">No preview</div>}
                                </div>
                              )
                            )}
                          </div>
                          
                          {/* Hover overlay with info */}
                          <div className={`absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-end`}>
                            <div className={`p-2 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-xs`}>
                              {isVideo ? '🎥' : '🖼️'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Load more button */}
                  {binCursor && binItems.length > 0 && (
                    <div className="flex justify-center mt-6">
                      <button
                        className={`rounded-full px-6 py-3 text-sm font-medium backdrop-blur-md transition-all hover:scale-105 ${darkMode ? 'bg-black/50 hover:bg-black/70 text-white border border-white/20' : 'bg-white/80 hover:bg-white text-black border border-black/20'}`}
                        onClick={async () => {
                          const r = await fetch(`/api/social-twin/history?limit=24&cursor=${encodeURIComponent(binCursor)}`, { headers: { 'X-User-Id': userId || '' } });
                          const j = await r.json();
                          setBinItems(prev => [...prev, ...(j.items || [])]);
                          setBinCursor(j.nextCursor || null);
                        }}
                      >
                        Load More
                      </button>
                    </div>
                  )}
                  
                  {binItems.length === 0 && (
                    <div className="h-full w-full flex flex-col items-center justify-center text-center">
                      <div className="text-6xl mb-4 opacity-50">🎨</div>
                      <div className={`text-xl mb-3 ${darkMode ? 'text-white' : 'text-black'}`}>No generations yet</div>
                      <div className={`text-sm opacity-60 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Create images or videos in chat to see them here</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className={`flex-1 overflow-y-auto p-4 ${simpleMode ? 'max-w-3xl mx-auto w-full' : ''}`}>
              <div className="mb-3 flex items-center justify-end gap-2">
                <button
                  className={`rounded-full px-3 py-1 text-xs border ${darkMode ? 'border-neutral-700 hover:bg-neutral-800' : 'border-neutral-200 hover:bg-gray-50'}`}
                  onClick={() => { const v = !darkMode; setDarkMode(v); localStorage.setItem('social_twin_dark', v ? '1' : '0'); }}
                  title={darkMode ? 'Light mode' : 'Dark mode'}
                >
                  {darkMode ? 'Light' : 'Dark'}
                </button>
                <button
                  className={`rounded-full p-2 border ${darkMode ? 'border-neutral-700 hover:bg-neutral-800' : 'border-neutral-200 hover:bg-gray-50'} ${!darkMode ? 'bg-black' : ''}`}
                  onClick={() => setSettingsOpen(true)}
                  title="Settings"
                >
                  {/* simple white gear svg */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="#fff" strokeWidth="1.6"/>
                    <path d="M19.4 13.5a7.43 7.43 0 0 0 .06-1.5c0-.5-.02-1-.06-1.5l2.03-1.59a.7.7 0 0 0 .16-.9l-1.93-3.34a.7.7 0 0 0-.86-.31l-2.39.96A7.69 7.69 0 0 0 14.4 3l-.36-2.5a.7.7 0 0 0-.69-.58h-3.7a.7.7 0 0 0-.69.58L8.6 3a7.69 7.69 0 0 0-1.99.82l-2.39-.96a.7.7 0 0 0-.86.31L1.43 6.5a.7.7 0 0 0 .16.9L3.62 9c-.04.5-.06 1-.06 1.5s.02 1 .06 1.5l-2.03 1.59a.7.7 0 0 0-.16.9l1.93 3.34c.18.32.57.45.9.31l2.39-.96c.62.36 1.29.64 1.99.82l.36 2.5c.06.34.35.58.69.58h3.7c.34 0 .63-.24.69-.58l.36-2.5c.7-.18 1.37-.46 1.99-.82l2.39.96c.33.14.72.01.9-.31l1.93-3.34a.7.7 0 0 0-.16-.9L19.4 13.5Z" stroke="#fff" strokeWidth="1.6"/>
                  </svg>
                </button>
              </div>

              {/* Overview (collapsible) */}
              <div className={`rounded-2xl border ${darkMode ? 'bg-neutral-950/60 border-neutral-800' : 'bg-white/70 backdrop-blur-md border-neutral-200'}`}>
                <button
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm ${darkMode ? 'hover:bg-neutral-900' : 'hover:bg-neutral-50'}`}
                  onClick={() => setDashOverviewOpen(v => !v)}
                >
                  <span className="font-medium">Overview</span>
                  <span className={`text-xs ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>{dashOverviewOpen ? 'Hide' : 'Show'}</span>
                </button>
                {dashOverviewOpen && (
                  <div className="px-4 pb-4">
                    <div className="flex items-center gap-3">
                      <img src={user?.imageUrl || '/readme/hero.png'} alt="avatar" className={`h-12 w-12 rounded-full object-cover ${darkMode ? 'border border-neutral-800' : 'border border-neutral-200'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-base font-semibold">{user?.fullName || 'Your Profile'}</div>
                        <div className={`truncate text-xs ${darkMode ? 'text-neutral-400' : 'text-gray-600'}`}>{(user as any)?.primaryEmailAddress?.emailAddress || (user as any)?.username || ''}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${darkMode ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-800'}`}>
                          {creditInfo?.subscription_active && creditInfo?.subscription_plan ? (()=>{ const plan = (creditInfo?.subscription_plan || '').toLowerCase().trim(); if (plan === 'one t') return 'ONE T'; if (plan === 'one z') return 'ONE Z'; if (plan === 'one pro') return 'ONE PRO'; return creditInfo?.subscription_plan; })() : 'Free'}
                        </span>
                        <Link href="/user" className={`text-xs rounded-full px-3 py-1 border transition-colors ${darkMode ? 'border-neutral-700 hover:bg-neutral-800' : 'border-neutral-200 hover:bg-gray-50'}`}>Manage</Link>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <div className={`text-[11px] uppercase tracking-wide ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Credits</div>
                        <div className="text-base font-semibold">—</div>
                      </div>
                      <div>
                        <div className={`text-[11px] uppercase tracking-wide ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Plan</div>
                        <div className="text-base font-semibold">—</div>
                      </div>
                      <div>
                        <div className={`text-[11px] uppercase tracking-wide ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Status</div>
                        <div className="text-base font-semibold">—</div>
                      </div>
                      <div>
                        <div className={`text-[11px] uppercase tracking-wide ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Last Active</div>
                        <div className="text-base font-semibold">{formatRelativeTime((user as any)?.lastSignInAt || (user as any)?.updatedAt || null)}</div>
                      </div>
                    </div>
                    {/* Inline details (merged) */}
                    <div className="mt-4 grid gap-2 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <div className={`${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Name</div>
                        <div className="font-medium truncate">{user?.fullName || '—'}</div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className={`${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Email</div>
                        <div className="font-medium truncate">{(user as any)?.primaryEmailAddress?.emailAddress || '—'}</div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className={`${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Username</div>
                        <div className="font-medium truncate">{(user as any)?.username || '—'}</div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className={`${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>User ID</div>
                        <div className="font-medium truncate">{(user as any)?.id || '—'}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Settings moved to modal opened by top-right icon */}

              {/* Projects (collapsible) */}
              <div className={`mt-4 rounded-2xl border ${darkMode ? 'bg-neutral-950/60 border-neutral-800' : 'bg-white/70 backdrop-blur-md border-neutral-200'}`}>
                <button
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm ${darkMode ? 'hover:bg-neutral-900' : 'hover:bg-neutral-50'}`}
                  onClick={() => setDashProjectsOpen(v => !v)}
                >
                  <span className="font-medium">Projects</span>
                  <span className={`text-xs ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>{dashProjectsOpen ? 'Hide' : 'Show'}</span>
                </button>
                {dashProjectsOpen && (
                  <div className="px-4 pb-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm opacity-70">Your projects</div>
                      <button
                        className={`rounded border px-3 py-1 text-sm ${darkMode ? 'border-neutral-700 hover:bg-neutral-800' : 'border-neutral-300 hover:bg-black/5'}`}
                        onClick={async () => {
                          const title = prompt('New Project name');
                          if (!title) return;
                          try {
                            const r = await fetch('/api/social-twin/projects', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' }, body: JSON.stringify({ title, data: {} }) });
                            await r.json().catch(() => null);
                            loadProjects();
                          } catch {}
                        }}
                      >New Project</button>
                    </div>
                    {projectsLoading ? (
                      <div className="text-sm opacity-70">Loading…</div>
                    ) : (
                      <div className="space-y-2">
                        {projects.map((p) => (
                          <a
                            key={p.id}
                            href={`/social-twin?projectId=${encodeURIComponent(p.id)}`}
                            className={`group flex items-center gap-3 rounded-xl border p-2 transition-colors cursor-pointer ${darkMode ? 'bg-neutral-950/60 border-neutral-800 hover:bg-neutral-900' : 'bg-white/70 backdrop-blur-sm border-neutral-200 hover:bg-black/5'}`}
                          >
                            <div className={`relative w-40 sm:w-56 aspect-video overflow-hidden rounded-lg border ${darkMode ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-neutral-50'}`}>
                              <img
                                src={(p.thumbnail_url && p.thumbnail_url.startsWith('http')) ? p.thumbnail_url : (p.thumbnail_url || '/placeholder.png')}
                                alt={p.title}
                                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="truncate text-sm font-medium" title={p.title}>{p.title || 'Untitled Project'}</div>
                                <div className={`text-[11px] whitespace-nowrap ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                  {new Date(p.updated_at || p.created_at).toLocaleString()} · {formatRelativeTime(p.updated_at || p.created_at)}
                                </div>
                              </div>
                              <div className={`mt-1 flex flex-wrap items-center gap-2 text-[11px] ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                <span className={`rounded border px-1.5 py-0.5 ${darkMode ? 'border-neutral-800' : 'border-neutral-300'}`}>ID: {(p.id || '').slice(0, 8)}</span>
                                {p.thumbnail_url ? (
                                  <span className={`rounded border px-1.5 py-0.5 ${darkMode ? 'border-neutral-800' : 'border-neutral-300'}`}>Preview</span>
                                ) : (
                                  <span className={`rounded border px-1.5 py-0.5 opacity-70 ${darkMode ? 'border-neutral-800' : 'border-neutral-300'}`}>No preview</span>
                                )}
                              </div>
                            </div>
                            <div className={`ml-1 opacity-60 ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>›</div>
                          </a>
                        ))}
                        {projects.length === 0 ? (
                          <div className={`opacity-60 text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>No projects yet. After arranging items on the grid, click Save Project (or type "save project" in chat), then refresh this panel.</div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Details merged into Overview below */}
            </div>
          )}

          {activeTab === 'news' && (
            <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
              {/* News Header */}
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-400 via-gray-400 to-gray-400 bg-clip-text text-transparent flex items-center gap-3">
                    <span className="text-3xl">📰</span>
                    <span>Live News Feed</span>
                  </h2>
                  <p className="text-sm text-gray-400 mt-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Real-time news from trusted sources • Updates every 20 minutes
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {/* Category Selector */}
                  <select
                    value={newsCategory}
                    onChange={(e) => setNewsCategory(e.target.value)}
                    className="bg-neutral-800/80 backdrop-blur-sm border border-neutral-700/50 text-white px-4 py-2 rounded-xl text-sm hover:bg-neutral-700/80 hover:border-cyan-500/50 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                  >
                    <option value="technology" className="bg-neutral-800">Technology</option>
                    <option value="business" className="bg-neutral-800">Business</option>
                    <option value="science" className="bg-neutral-800">Science</option>
                    <option value="health" className="bg-neutral-800">Health</option>
                    <option value="sports" className="bg-neutral-800">Sports</option>
                    <option value="entertainment" className="bg-neutral-800">Entertainment</option>
                  </select>
                  {/* Refresh Button */}
                  <button
                    onClick={() => fetchNews(newsCategory)}
                    disabled={newsLoading}
                    className="bg-neutral-800/80 backdrop-blur-sm hover:bg-neutral-700/80 border border-neutral-700/50 hover:border-cyan-500/50 text-white p-3 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    title="Refresh News"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-cyan-400">
                      <path d="M4 4V9H4.582M4.582 9C5.1506 7.56584 6.3534 6.56584 7.8284 6.19248M4.582 9H9M20 20V15H19.418M19.418 15C18.8494 16.4342 17.6466 17.4342 16.1716 17.8075M19.418 15H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* News Content */}
              {newsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="flex items-center gap-6 bg-neutral-900/60 backdrop-blur-sm rounded-2xl p-8 border border-neutral-800/50 shadow-2xl">
                    <div className="animate-spin rounded-full h-10 w-10 border-3 border-cyan-500 border-t-transparent"></div>
                    <div>
                      <div className="text-white font-semibold text-lg">Fetching Latest News...</div>
                      <div className="text-gray-400 text-sm mt-1">Connecting to news sources...</div>
                    </div>
                  </div>
                </div>
              ) : newsError ? (
                <div className="bg-red-950/30 backdrop-blur-sm border border-red-800/50 rounded-2xl p-8 text-center shadow-2xl">
                  <div className="text-red-400 text-5xl mb-4">⚠️</div>
                  <div className="text-red-300 font-semibold text-xl mb-3">News Feed Unavailable</div>
                  <div className="text-red-400/80 text-sm mb-6">{newsError}</div>
                  <button
                    onClick={() => fetchNews(newsCategory)}
                    className="bg-red-900/50 hover:bg-red-900/70 text-red-300 border border-red-800 hover:border-red-700 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  >
                    Retry Connection
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {newsArticles.length === 0 ? (
                    <div className="bg-neutral-900/60 backdrop-blur-sm border border-neutral-800/50 rounded-2xl p-12 text-center shadow-2xl">
                      <div className="text-5xl mb-4">📰</div>
                      <div className="text-white font-semibold text-xl mb-3">No News Available</div>
                      <div className="text-gray-400 text-sm">
                        Unable to load news for this category. Please try a different category or check back later.
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Breaking News - Large Featured Article */}
                      {newsArticles[0] && (
                        <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900/80 to-neutral-800/80 backdrop-blur-sm border border-neutral-700/50 shadow-2xl hover:shadow-cyan-500/10 transition-all duration-500">
                          <div className="absolute inset-0 bg-gradient-to-r from-gray-500/5 to-gray-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                          <div className="relative p-8">
                            <div className="flex flex-col lg:flex-row gap-8 items-center">
                              {/* Breaking News Badge */}
                              <div className="flex-shrink-0">
                                <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                                  BREAKING NEWS
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1 text-center lg:text-left">
                                <h3 className="font-bold text-white text-2xl lg:text-3xl leading-tight mb-4 group-hover:text-cyan-300 transition-colors duration-300">
                                  <button
                                    onClick={() => {
                                      setSelectedArticle(newsArticles[0]);
                                      setArticleModalOpen(true);
                                    }}
                                    className="hover:underline decoration-cyan-400/50 text-left"
                                  >
                                    {newsArticles[0].title}
                                  </button>
                                </h3>

                                {newsArticles[0].description && (
                                  <p className="text-gray-300 text-lg leading-relaxed mb-6 line-clamp-3">
                                    {newsArticles[0].description}
                                  </p>
                                )}

                                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm text-gray-400">
                                  <span className="bg-neutral-800/80 px-3 py-1 rounded-lg font-medium">
                                    {newsArticles[0].source?.name || 'Unknown'}
                                  </span>
                                  {newsArticles[0].publishedAt && (
                                    <span className="bg-neutral-800/80 px-3 py-1 rounded-lg">
                                      {new Date(newsArticles[0].publishedAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  )}
                                  {newsArticles[0].apiSource && (
                                    <span className="bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-lg">
                                      {newsArticles[0].apiSource}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Image */}
                              {newsArticles[0].urlToImage && (
                                <div className="flex-shrink-0">
                                  <div className="relative overflow-hidden rounded-2xl shadow-2xl group-hover:shadow-cyan-500/20 transition-shadow duration-500">
                                    <img
                                      src={getDisplayUrl(newsArticles[0].urlToImage)}
                                      alt={newsArticles[0].title}
                                      className="w-48 h-32 lg:w-64 lg:h-40 object-cover group-hover:scale-105 transition-transform duration-500"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Two Column News Cards */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {newsArticles.slice(1, 3).map((article, index) => (
                          <div
                            key={index}
                            className="group relative overflow-hidden rounded-2xl bg-neutral-900/60 backdrop-blur-sm border border-neutral-700/50 shadow-xl hover:shadow-cyan-500/10 hover:border-cyan-500/30 transition-all duration-300"
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="relative p-6">
                              <div className="flex gap-4">
                                {/* Article Image */}
                                {article.urlToImage && (
                                  <div className="flex-shrink-0">
                                    <img
                                      src={getDisplayUrl(article.urlToImage)}
                                      alt={article.title}
                                      className="w-20 h-20 object-cover rounded-xl border border-neutral-700/50 group-hover:border-cyan-500/50 transition-colors duration-300"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  </div>
                                )}

                                {/* Article Content */}
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-white text-base leading-tight mb-3 line-clamp-2 group-hover:text-cyan-300 transition-colors duration-300">
                                    <button
                                      onClick={() => {
                                        setSelectedArticle(article);
                                        setArticleModalOpen(true);
                                      }}
                                      className="hover:underline decoration-cyan-400/50 text-left"
                                    >
                                      {article.title}
                                    </button>
                                  </h4>

                                  {article.description && (
                                    <p className="text-gray-300 text-sm leading-relaxed mb-4 line-clamp-2">
                                      {article.description}
                                    </p>
                                  )}

                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                      <span className="bg-neutral-800/60 px-2 py-1 rounded-md font-medium">
                                        {article.source?.name || 'Unknown'}
                                      </span>
                                      {article.publishedAt && (
                                        <span>{new Date(article.publishedAt).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric'
                                        })}</span>
                                      )}
                                    </div>

                                    <button
                                      onClick={() => {
                                        setSelectedArticle(article);
                                        setArticleModalOpen(true);
                                      }}
                                      className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 border border-cyan-500/20 hover:border-cyan-500/40 rounded-lg text-xs font-medium transition-all duration-200"
                                    >
                                      <span>Read</span>
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                                        <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Featured Article - Large Card */}
                      {newsArticles[3] && (
                        <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900/80 to-neutral-800/80 backdrop-blur-sm border border-neutral-700/50 shadow-2xl hover:shadow-teal-500/10 transition-all duration-500">
                          <div className="absolute inset-0 bg-gradient-to-r from-gray-500/5 to-gray-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                          <div className="relative p-8">
                            <div className="flex flex-col lg:flex-row gap-8 items-start">
                              {/* Featured Badge */}
                              <div className="flex-shrink-0">
                                <div className="bg-gradient-to-r from-gray-500 to-gray-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                                  FEATURED
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1">
                                <h4 className="font-bold text-white text-xl lg:text-2xl leading-tight mb-4 group-hover:text-teal-300 transition-colors duration-300">
                                  <button
                                    onClick={() => {
                                      setSelectedArticle(newsArticles[3]);
                                      setArticleModalOpen(true);
                                    }}
                                    className="hover:underline decoration-teal-400/50 text-left"
                                  >
                                    {newsArticles[3].title}
                                  </button>
                                </h4>

                                {newsArticles[3].description && (
                                  <p className="text-gray-300 text-base leading-relaxed mb-6 line-clamp-4">
                                    {newsArticles[3].description}
                                  </p>
                                )}

                                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-6">
                                  <span className="bg-neutral-800/80 px-3 py-1 rounded-lg font-medium">
                                    {newsArticles[3].source?.name || 'Unknown'}
                                  </span>
                                  {newsArticles[3].publishedAt && (
                                    <span className="bg-neutral-800/80 px-3 py-1 rounded-lg">
                                      {new Date(newsArticles[3].publishedAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  )}
                                  {newsArticles[3].apiSource && (
                                    <span className="bg-teal-500/20 text-teal-400 px-3 py-1 rounded-lg">
                                      {newsArticles[3].apiSource}
                                    </span>
                                  )}
                                </div>

                                <button
                                  onClick={() => {
                                    setSelectedArticle(newsArticles[3]);
                                    setArticleModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 hover:text-teal-300 border border-teal-500/20 hover:border-teal-500/40 rounded-xl text-sm font-medium transition-all duration-300 group-hover:shadow-lg group-hover:shadow-teal-500/20"
                                >
                                  <span>Read Full Article</span>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                    <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </button>
                              </div>

                              {/* Image */}
                              {newsArticles[3].urlToImage && (
                                <div className="flex-shrink-0">
                                  <div className="relative overflow-hidden rounded-2xl shadow-2xl group-hover:shadow-teal-500/20 transition-shadow duration-500">
                                    <img
                                      src={getDisplayUrl(newsArticles[3].urlToImage)}
                                      alt={newsArticles[3].title}
                                      className="w-56 h-40 object-cover group-hover:scale-105 transition-transform duration-500"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Remaining Articles - Compact List */}
                      {newsArticles.length > 4 && (
                        <div className="space-y-3">
                          <h5 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <span className="w-1 h-6 bg-gradient-to-b from-cyan-400 to-teal-400 rounded-full"></span>
                            More Stories
                          </h5>
                          {newsArticles.slice(4).map((article, index) => (
                            <article
                              key={index + 4}
                              className="group bg-neutral-900/40 backdrop-blur-sm border border-neutral-700/30 rounded-xl transition-all duration-300 hover:bg-neutral-900/60 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/5"
                            >
                              <div className="p-4">
                                <div className="flex gap-4">
                                  {/* Article Image */}
                                  {article.urlToImage && (
                                    <div className="flex-shrink-0">
                                      <img
                                        src={getDisplayUrl(article.urlToImage)}
                                        alt={article.title}
                                        className="w-16 h-16 object-cover rounded-lg border border-neutral-700/50"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                    </div>
                                  )}

                                  {/* Article Content */}
                                  <div className="flex-1 min-w-0">
                                    <h6 className="font-semibold text-white text-sm leading-tight mb-2 line-clamp-2 group-hover:text-cyan-400 transition-colors">
                                      <button
                                        onClick={() => {
                                          setSelectedArticle(article);
                                          setArticleModalOpen(true);
                                        }}
                                        className="hover:underline decoration-cyan-400/50 text-left"
                                      >
                                        {article.title}
                                      </button>
                                    </h6>

                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <span className="bg-neutral-800/60 px-2 py-1 rounded-md font-medium">
                                          {article.source?.name || 'Unknown'}
                                        </span>
                                        {article.publishedAt && (
                                          <span>{new Date(article.publishedAt).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric'
                                          })}</span>
                                        )}
                                      </div>

                                      <button
                                        onClick={() => {
                                          setSelectedArticle(article);
                                          setArticleModalOpen(true);
                                        }}
                                        className="flex items-center gap-1 px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 border border-cyan-500/20 hover:border-cyan-500/40 rounded text-xs font-medium transition-all duration-200"
                                      >
                                        <span>Read</span>
                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                                          <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* News Status Footer */}
              <div className="mt-12 bg-neutral-900/40 backdrop-blur-sm border border-neutral-700/30 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center gap-6">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Live Updates Active
                    </span>
                    <span>•</span>
                    <span>{newsArticles.length} articles loaded</span>
                    <span>•</span>
                    <span>Category: {newsCategory}</span>
                  </div>
                  <div className="text-cyan-400/70 font-medium">
                    Powered by NewsAPI • GNews • NewsData
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Article Preview Modal */}
      {articleModalOpen && selectedArticle && (
        <div className="fixed inset-0 z-[10001] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setArticleModalOpen(false)}>
          <div className={`w-full max-w-4xl max-h-[90vh] rounded-2xl border shadow-2xl ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'} overflow-hidden`} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-6 border-b ${darkMode ? 'border-neutral-700 bg-neutral-800' : 'border-neutral-200 bg-neutral-50'}`}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Article Preview</h2>
                  <p className="text-sm text-neutral-400">Quick preview without leaving the page</p>
                </div>
              </div>
              <button
                onClick={() => setArticleModalOpen(false)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg ${darkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'} transition-all`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Article Header */}
                <div className="space-y-4">
                  <h1 className="text-2xl lg:text-3xl font-bold text-white leading-tight">
                    {selectedArticle.title}
                  </h1>

                  {/* Article Meta */}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-400">
                    <span className="bg-neutral-800/80 px-3 py-1 rounded-lg font-medium">
                      {selectedArticle.source?.name || 'Unknown Source'}
                    </span>
                    {selectedArticle.publishedAt && (
                      <span className="bg-neutral-800/80 px-3 py-1 rounded-lg">
                        {new Date(selectedArticle.publishedAt).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    )}
                    {selectedArticle.apiSource && (
                      <span className="bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-lg">
                        {selectedArticle.apiSource}
                      </span>
                    )}
                  </div>
                </div>

                {/* Article Image */}
                {selectedArticle.urlToImage && (
                  <div className="relative overflow-hidden rounded-2xl shadow-2xl">
                    <img
                      src={getDisplayUrl(selectedArticle.urlToImage)}
                      alt={selectedArticle.title}
                      className="w-full h-64 lg:h-80 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                  </div>
                )}

                {/* Article Content */}
                <div className="space-y-4">
                  {selectedArticle.description && (
                    <div className="bg-neutral-800/40 backdrop-blur-sm border border-neutral-700/50 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-3">Summary</h3>
                      <p className="text-neutral-300 leading-relaxed text-base">
                        {selectedArticle.description}
                      </p>
                    </div>
                  )}

                  {/* Read Full Article Button */}
                  <div className="flex justify-center pt-4">
                    <a
                      href={selectedArticle.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-cyan-500/25 transform hover:scale-105"
                    >
                      <span>Read Full Article</span>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 17L17 7M17 7H7M17 7V17"/>
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div className={`fixed inset-0 z-[20000] flex items-center justify-center ${darkMode ? 'bg-black/60' : 'bg-black/40'} overscroll-contain`} onClick={() => setSettingsOpen(false)}>
          <div className={`w-[94vw] max-w-xl max-h-[85vh] rounded-2xl border shadow-xl ${darkMode ? 'bg-neutral-950 border-neutral-800' : 'bg-white border-neutral-200'} ios-smooth-scroll overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
            <div className={`sticky top-0 z-10 flex items-center justify-between px-4 py-3 ${darkMode ? 'bg-neutral-950/95 border-b border-neutral-800' : 'bg-white/95 border-b border-neutral-200'} backdrop-blur supports-[backdrop-filter]:bg-opacity-90`}>
              <div className="text-sm font-medium">Settings</div>
              <button className={`rounded p-1 ${darkMode ? 'hover:bg-neutral-900' : 'hover:bg-gray-50'}`} onClick={() => setSettingsOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="p-4 grid gap-3">
              <div className="grid gap-1">
                <label className="text-sm font-medium">Text RunPod URL</label>
                <input className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400' : ''}`} placeholder="https://..." value={textUrl} onChange={(e) => setTextUrl(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium">Ratio</label>
                <select className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`} value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                  <option value="">Select</option>
                  {AR_CHOICES.map((ar) => (<option key={ar} value={ar}>{ar}</option>))}
                </select>
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium">Image RunPod URL</label>
                <input className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400' : ''}`} placeholder="https://..." value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium">Image Modify RunPod URL</label>
                <input className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400' : ''}`} placeholder="https://..." value={imageModifyUrl} onChange={(e) => setImageModifyUrl(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium">Video RunPod URL</label>
                <input className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400' : ''}`} placeholder="https://..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium">WAN Video RunPod URL</label>
                <input className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400' : ''}`} placeholder="https://..." value={videoWanUrl} onChange={(e) => setVideoWanUrl(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium">Kling Video RunPod URL</label>
                <input className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400' : ''}`} placeholder="https://..." value={videoKlingUrl} onChange={(e) => setVideoKlingUrl(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium">Character (LoRA)</label>
                <select className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`} value={isPresetLoRa(loraName) ? loraName : 'Custom...'} onChange={(e) => { const v = e.target.value; if (v === 'None') setLoraName(''); else if (v === 'Custom...') setLoraName(loraName || ''); else setLoraName(v); }}>
                  {LORA_CHOICES.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                </select>
                <input className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400' : ''}`} placeholder="custom lora filename (optional)" value={loraName} onChange={(e) => setLoraName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <label className="text-sm font-medium">LoRA Scale</label>
                  <input className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400' : ''}`} placeholder="0.0 - 1.0" type="number" step="0.01" value={loraScale} onChange={(e) => setLoraScale(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div className="grid gap-1">
                  <label className="text-sm font-medium">Batch Size</label>
                  <select className={`rounded border p-2 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : ''}`} value={batchSize === '' ? '' : String(batchSize)} onChange={(e) => setBatchSize(e.target.value === '' ? '' : Number(e.target.value))}>
                    <option value="">Select</option>
                    {BATCH_CHOICES.map((n) => (<option key={n} value={n}>{n}</option>))}
                  </select>
                </div>
              </div>
              <div className={`sticky bottom-0 mt-2 px-4 py-3 -mx-4 ${darkMode ? 'bg-neutral-950/95 border-t border-neutral-800' : 'bg-white/95 border-t border-neutral-200'} backdrop-blur supports-[backdrop-filter]:bg-opacity-90`}>
                <div className="flex gap-2 justify-end">
                  <button className={`cursor-pointer rounded px-3 py-2 ${darkMode ? 'bg-neutral-50 text-black' : 'bg-black text-white'}`} onClick={() => { saveSettings(); setSettingsOpen(false); }}>Save</button>
                  <button className={`cursor-pointer rounded border px-3 py-2 ${darkMode ? 'border-neutral-700 hover:bg-neutral-800' : ''}`} onClick={() => { setTextUrl(''); setImageUrl(''); setImageModifyUrl(''); setVideoUrl(''); saveSettings(); setSettingsOpen(false); }}>Clear</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Canvas grid background */}
      {!simpleMode && (
  <section
    ref={gridSectionRef as any}
  className={`absolute inset-0 z-0 grid-canvas ${darkMode ? 'bg-neutral-950' : 'bg-white'}`}
        style={{
          cursor: gridEnabled ? 'grab' : undefined,
          overflow: 'hidden',
          // Dynamic height for mobile keyboard responsiveness
          height: '100vh',
          // Ensure background stays responsive during keyboard transitions
          transition: undefined
        }}
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
                  : 'linear-gradient(to right, rgba(0,0,0,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.10) 1px, transparent 1px)',
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
          {canvasItems.filter(item => item.type !== 'operator').map((it, _idx) => (
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
          {/* Edges layer (overlayed above items) */}
          <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
            {edges.map((edge)=>{
              const from = canvasItems.find(i=>i.id===edge.fromId);
              const to = canvasItems.find(i=>i.id===edge.toId);
              if (!from || !to) return null;
              // Fixed port positioning: male on right, female on left
              const fromX = edge.fromPort==='male' ? from.x + from.w : from.x;
              const fromY = from.y + from.h/2;
              const toX = edge.toPort==='female' ? to.x : to.x + to.w;
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M4 7h16M9 7v10m6-10v10" stroke={darkMode ? '#fff' : '#111111'} strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
          <label className="rounded-full p-3 shadow cursor-pointer" title="Upload">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" stroke={darkMode ? '#fff' : '#111111'} strokeWidth="1.8" strokeLinecap="round"/></svg>
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
              <path d="M4 12h10M9 7l5 5-5 5" stroke={darkMode ? '#fff' : '#111111'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="16" y="6" width="4" height="12" rx="1.2" stroke={darkMode ? '#fff' : '#111111'} strokeWidth="1.4"/>
            </svg>
          </button>
          <button className="rounded-full p-3 shadow" title="Create"
            onClick={()=> setQuickCreateOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 5v14m-7-7h14" stroke={darkMode ? '#fff' : '#111111'} strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
          
          {/* Storyboard to Video */}
          <button 
            className="rounded-full p-3 shadow bg-gradient-to-r from-purple-500 to-pink-500 text-white" 
            title="Storyboard to Video"
            onClick={() => setStoryboardOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none">
              <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M7 7h10M7 10h7M7 13h4" stroke="currentColor" strokeWidth="1.4"/>
              <circle cx="17" cy="9" r="2" fill="currentColor"/>
            </svg>
          </button>
        </div>
        )}
          {/* Context menu for grid items */}
          {/* Inline simple menu (no external component) */}
          {menu.open ? (
          <div className="fixed z-[10000]" style={{ left: menu.x, top: menu.y }}
               onClick={()=> setMenu({ open:false, x:0, y:0, targetId:null })}
          >
            <div className={`min-w-[160px] overflow-hidden rounded-lg border shadow relative ${darkMode ? 'bg-neutral-900 border-neutral-700 text-neutral-100' : 'bg-white'}`} onClick={(e)=> e.stopPropagation()}>
              {/* Minimal red close button */}
              <button 
                className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center hover:bg-red-500/20 rounded-full transition-colors"
                onClick={()=> setMenu({ open:false, x:0, y:0, targetId:null })}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" className="text-red-500">
                  <path d="M1 1l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
              
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
                if (menu.targetId) {
                  const canvasItem = canvasItems.find(i=> i.id===menu.targetId);
                  if (canvasItem && (canvasItem.type === 'image' || canvasItem.type === 'video')) {
                    addCanvasImageToStoryboard(canvasItem);
                  }
                }
                setMenu({ open:false, x:0, y:0, targetId:null });
              }}>Send to Storyboard</button>
                {/* Export submenu */}
                <div className="border-t my-1" />
                <div className="px-3 py-1 text-xs opacity-70">Export</div>
                <button className={`block w-full text-left px-3 py-2 text-sm ${darkMode? 'hover:bg-white/10' : 'hover:bg-black/5'}`} onClick={()=>{
                  if (!menu.targetId) return;
                  openCompileModalFromNode(menu.targetId);
                  setMenu({ open:false, x:0, y:0, targetId:null });
                }}>Create Video</button>
                <button className={`block w-full text-left px-3 py-2 text-sm ${darkMode? 'hover:bg-white/10' : 'hover:bg-black/5'}`} onClick={()=>{
                  if (!menu.targetId) return;
                  openComposeModalFromNode(menu.targetId);
                  setMenu({ open:false, x:0, y:0, targetId:null });
                }}>Compose PDF/PPT</button>
                <button className={`block w-full text-left px-3 py-2 text-sm ${darkMode? 'hover:bg-white/10' : 'hover:bg-black/5'}`} onClick={()=>{
                  if (!menu.targetId) return;
                  {
                    const target = canvasItems.find(i => i.id === menu.targetId);
                    const t = target && (target.type === 'image' || target.type === 'video') ? (target.type as 'image'|'video') : 'image';
                    folderModalPayload.current = {
                      url: target?.url || '',
                      type: t,
                      prompt: target?.text || 'Saved from canvas'
                    };
                  }
                  setFolderModalOpen(true);
                  setMenu({ open:false, x:0, y:0, targetId:null });
                }}>Save to Project</button>
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
                  
                  <img src={getDisplayUrl(viewer.ref)} alt="original" className="max-h-[70vh] w-full rounded border object-contain" />
                </div>
              ) : null}
              <div>
                <div className="mb-1 text-xs opacity-70">Result</div>
                
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
            <div className="mt-4 flex justify-between gap-2">
              <button type="button" className={`rounded border px-3 py-1 text-sm ${darkMode?'border-neutral-700 hover:bg-neutral-800 text-gray-400':'border-gray-400 hover:bg-gray-100 text-gray-600'}`} onClick={()=> {
                // Switch to layout editor mode
                const allMedia = getIncomingMedia(composeOriginId || '');
                const imageInputs = allMedia.filter(i=> i.type==='image');
                
                if (imageInputs.length > 0) {
                  const firstPage = {
                    id: generateId(),
                    items: imageInputs.map((img, idx) => ({
                      id: generateId(),
                      type: 'image' as const,
                      url: img.url,
                      x: 50 + (idx % 2) * 300,
                      y: 50 + Math.floor(idx / 2) * 200,
                      w: 250,
                      h: 180
                    }))
                  };
                  
                  setPdfPages([firstPage]);
                  setCurrentPage(0);
                  setComposeOpen(false);
                  setPdfEditorOpen(true);
                } else {
                  setMessages(prev=> [...prev, { id: generateId(), role:'assistant', content:'No images connected. Connect images using the orange string to use the layout editor.', createdAt: new Date().toISOString() }]);
                }
              }}>Layout editor</button>
              <div className="flex gap-2">
                <button type="button" className={`rounded border px-3 py-1 text-sm ${darkMode?'border-neutral-700':''}`} onClick={()=> setComposeOpen(false)}>Cancel</button>
                <button type="button" className={`rounded border px-3 py-1 text-sm ${darkMode?'border-neutral-700':''}`} onClick={()=> runExportPDF()}>Export PDF</button>
                <button type="button" className={`rounded bg-black px-3 py-1 text-sm text-white`} onClick={()=> runExportPPT()}>Export PPTX</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      
      {/* Generated Content Lightbox Viewer */}
      {viewerOpen && viewerItem && (
  <div className="fixed inset-0 z-[10050] bg-black/70 backdrop-blur-sm" onClick={() => setViewerOpen(false)}>
          <div className="absolute inset-0 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setViewerOpen(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/5 text-white hover:bg-white/10 border border-white/10 transition-colors flex items-center justify-center"
            >
              ✕
            </button>
            
            {/* Main content area */}
            <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center">
              {/* Content display */}
              <div className="relative mb-4">
                {viewerItem.type === 'video' ? (
                  <video
                    src={(typeof viewerItem.display_url === 'string' && viewerItem.display_url.startsWith('http') && !viewerItem.display_url.startsWith(getLocationOrigin())) 
                      ? `/api/social-twin/proxy?url=${encodeURIComponent(viewerItem.display_url)}` 
                      : (viewerItem.display_url || viewerItem.result_url)}
                    className="max-w-[76vw] max-h-[68vh] rounded-xl border border-neutral-800 bg-neutral-950 object-contain shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
                    controls
                    autoPlay
                    loop
                  />
                ) : (
                  <img
                    src={(typeof viewerItem.display_url === 'string' && viewerItem.display_url.startsWith('http') && !viewerItem.display_url.startsWith(getLocationOrigin())) 
                      ? `/api/social-twin/proxy?url=${encodeURIComponent(viewerItem.display_url)}` 
                      : (viewerItem.display_url || viewerItem.result_url)}
        className="max-w-[76vw] max-h-[68vh] rounded-xl border border-neutral-800 bg-neutral-950 object-contain shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
                    alt="Generated content"
                  />
                )}
              </div>
  {/* Bottom action bar */}
  <div className="flex flex-wrap gap-2 justify-center border-t border-white/10 pt-3">
                <button
                  onClick={() => {
                    if (viewerItem.topic_id) {
                      fetch(`/api/social-twin/topics/${viewerItem.topic_id}/feed`, { headers: { 'X-User-Id': userId || '' } })
                        .then(r => r.json())
                        .then(j => {
                          const items = (j.items || []) as any[];
                          const msgs = items.map((x: any) => ({ id: x.id, role: x.role, content: x.content, imageUrl: x.imageUrl, videoUrl: x.videoUrl, createdAt: x.createdAt }));
                          setMessages(msgs);
                          const ts = viewerItem.created_at || viewerItem.createdAt || null;
                          if (ts) setTargetScrollTs(ts);
                          setActiveTab('chat');
                          setViewerOpen(false);
                        });
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-700 text-neutral-100 bg-transparent hover:bg-white/5 transition-colors"
                >
                  💬 Show in chat
                </button>
                
                <button
                  onClick={() => {
                    const url = viewerItem.display_url || viewerItem.result_url;
                    folderModalPayload.current = { url: String(url), type: viewerItem.type, prompt: viewerItem.prompt } as any;
                    setFolderModalOpen(true);
                    setViewerOpen(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-700 text-neutral-100 bg-transparent hover:bg-white/5 transition-colors"
                >
                  📁 Add to project
                </button>
                
                <button
                  onClick={() => {
                    const url = viewerItem.display_url || viewerItem.result_url;
                    if (typeof url === 'string') {
                      setAttached({ name: 'generated-item', type: viewerItem.type === 'video' ? 'video/mp4' : 'image/png', dataUrl: url });
                      setActiveTab('chat');
                      setViewerOpen(false);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-700 text-neutral-100 bg-transparent hover:bg-white/5 transition-colors"
                >
                  💭 Send to chat
                </button>
                
                <button
                  onClick={() => {
                    const url = viewerItem.display_url || viewerItem.result_url;
                    if (typeof url === 'string') {
                      addToCanvas(url, viewerItem.type === 'video' ? 'video' : 'image');
                      setViewerOpen(false);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-700 text-neutral-100 bg-transparent hover:bg-white/5 transition-colors"
                >
                  🎨 Send to canvas
                </button>
                
                {/* Save to Library - one-click server action */}
                {(() => {
                  const isSaved = (viewerItem?.result_url && typeof viewerItem.result_url === 'string' && viewerItem.result_url.startsWith('storage:')) || (viewerItem?.generation_params && (viewerItem.generation_params.saved_to_library === true || viewerItem.generation_params.savedToLibrary === true));
                  return (
                    <button
                      onClick={async () => {
                        if (isSaved) return;
                        try {
                          const res = await fetch('/api/social-twin/save-to-library', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' },
                            body: JSON.stringify({ id: viewerItem.id })
                          });
                          const j = await res.json().catch(() => null);
                          if (res.ok) {
                            // optimistic UI update for viewer and grid
                            setViewerItem((prev: any) => prev ? { ...prev, generation_params: { ...(prev.generation_params || {}), saved_to_library: true, savedToLibrary: true }, result_url: (j?.result_url || prev.result_url) } : prev);
                            setBinItems((prev: any[]) => prev.map((it: any) => it.id === viewerItem.id ? { ...it, generation_params: { ...(it.generation_params || {}), saved_to_library: true, savedToLibrary: true }, result_url: (j?.result_url || it.result_url) } : it));
                          } else {
                            alert((j && (j.error || j.message)) || 'Save failed');
                          }
                        } catch (e) {
                          console.error(e);
                          alert('Save failed');
                        }
                      }}
                      disabled={isSaved}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-700 text-neutral-100 bg-transparent hover:bg-white/5 transition-colors ${isSaved ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isSaved ? '💾 Saved' : '💾 Save to Library'}
                    </button>
                  );
                })()}
              </div>
              
              {/* Details toggle and metadata */}
              {viewerItem.prompt ? (
                <div className="mt-3 max-w-[60vw] text-center">
                  <button
                    onClick={() => setViewerDetailsOpen(v => !v)}
                    className="mx-auto mb-2 inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-100 hover:bg-white/5"
                  >
                    {viewerDetailsOpen ? 'Hide details' : 'Show details'}
                  </button>
                  {viewerDetailsOpen && (
                    <div className="text-neutral-400 text-xs bg-black/30 rounded-lg p-3 border border-neutral-800 text-left">
                      <div className="opacity-70 mb-1">Prompt</div>
                      <div className="whitespace-pre-wrap break-words">{viewerItem.prompt}</div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
      
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
      <ProjectModal
        isOpen={projectModalOpen}
        onClose={()=> setProjectModalOpen(false)}
        onConfirmNew={(title)=> saveCurrentProject(title)}
        onConfirmExisting={currentProjectId ? updateExistingProject : undefined}
        hasExisting={Boolean(currentProjectId)}
        existingTitle={currentProjectTitle || undefined}
        dark={darkMode}
      />
      
      {/* Welcome Modal */}
      {showWelcomeModal && (
        <div className="fixed inset-0 z-[10100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowWelcomeModal(false)} />
          <div className={`relative rounded-2xl border p-8 max-w-md w-full mx-4 ${darkMode ? 'bg-neutral-900 border-neutral-700 text-neutral-100' : 'bg-white border-neutral-200'}`}>
            <h2 className="text-2xl font-bold mb-4">Welcome to Social Twin! 🎨</h2>
            <p className={`mb-6 text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
              Start creating with AI-powered content generation and visual project organization. 
              Would you like to begin a new project or continue with an existing one?
            </p>
            
            <div className="space-y-3">
              <button
                className={`w-full rounded-lg border-2 border-dashed p-4 text-left transition-colors ${darkMode ? 'border-neutral-600 hover:border-neutral-500 hover:bg-neutral-800' : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'}`}
                onClick={() => {
                  setShowWelcomeModal(false);
                  // Stay on current page - user can start chatting immediately
                }}
              >
                <div className="font-semibold">✨ Start New Project</div>
                <div className={`text-xs mt-1 ${darkMode ? 'text-neutral-500' : 'text-neutral-500'}`}>
                  Begin fresh with AI chat and visual canvas
                </div>
              </button>
              
              <button
                className={`w-full rounded-lg border p-4 text-left transition-colors ${darkMode ? 'border-neutral-600 hover:border-neutral-500 hover:bg-neutral-800' : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'}`}
                onClick={() => {
                  setShowWelcomeModal(false);
                  setActiveTab('dashboard');
                  setDashProjectsOpen(true);
                }}
              >
                <div className="font-semibold">📁 Open Existing Project</div>
                <div className={`text-xs mt-1 ${darkMode ? 'text-neutral-500' : 'text-neutral-500'}`}>
                  Continue with saved chat history and layouts
                </div>
              </button>
            </div>
            
            <button
              className={`mt-6 text-xs ${darkMode ? 'text-neutral-500 hover:text-neutral-400' : 'text-neutral-400 hover:text-neutral-600'}`}
              onClick={() => setShowWelcomeModal(false)}
            >
              Skip - I'll decide later
            </button>
          </div>
        </div>
      )}
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
        const c1x = sx + dx * 0.33 + nx * n1 + ux * j1;
        const c1y = sy + dy * 0.33 + ny * n1 + uy * j1;
        const c2x = sx + dx * 0.66 + nx * n2 + ux * j2;
        const c2y = sy + dy * 0.66 + ny * n2 + uy * j2;
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
            className={`absolute w-[520px] rounded-2xl border p-4 shadow-2xl max-h-[80vh] overflow-y-auto bg-white border-neutral-200 text-black`}
            style={{ left: quickCreatePos.x, top: quickCreatePos.y }}
            onClick={(e)=> e.stopPropagation()}
          >
            <div
              className="mb-3 flex cursor-move items-center justify-between"
              onMouseDown={(e)=>{
                e.preventDefault();
                const startX = e.clientX; const startY = e.clientY;
                const offX = startX - quickCreatePos.x; const offY = startY - quickCreatePos.y;
                quickCreateDragRef.current = { dragging: true, offX, offY };
                const move = (ev: MouseEvent)=>{
                  if (!quickCreateDragRef.current?.dragging) return;
                  const panelW = 520; // matches w-[520px]
                  const panelH = 520; // approximate height
                  const vw = window.innerWidth;
                  const vh = window.innerHeight;
                  const nextX = Math.min(Math.max(8, ev.clientX - offX), Math.max(8, vw - panelW - 8));
                  const nextY = Math.min(Math.max(8, ev.clientY - offY), Math.max(8, vh - panelH - 8));
                  setQuickCreatePos({ x: nextX, y: nextY });
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
              <div className="flex items-center gap-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-black/90">
                  <rect x="3" y="3" width="18" height="18" rx="6" fill="#ffffff" stroke="#e6e6e6" strokeWidth="1" />
                  <path d="M7 12h10M7 8h10M7 16h6" stroke="#111827" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <div className="text-sm font-semibold text-black">Creator Studio</div>
                  <div className="text-xs text-neutral-500">Create images, video & documents — fast</div>
                </div>
              </div>
              <button className="rounded-md p-1 hover:bg-neutral-100" onClick={()=> setQuickCreateOpen(false)} aria-label="Close Creator Studio">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 6l12 12M6 18L18 6" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* Mode Selection (enhanced with fade/transition behavior) */}
            <div className="mb-3">
              <div className="text-xs font-medium mb-1 opacity-80">Mode</div>
              <div className="relative">
                {/* Mode Selection Buttons */}
                <div className="inline-flex items-center gap-1 rounded-lg border p-1 border-neutral-200 relative overflow-hidden">
                  {/* Text Mode */}
                  <button
                    className={`rounded-md px-2 py-1 text-xs flex items-center gap-1 transition-all duration-300 ${
                      modeSelected && selectedMode !== 'text' 
                        ? 'opacity-0 scale-95 pointer-events-none' 
                        : modeSelected && selectedMode === 'text'
                        ? 'bg-neutral-100 scale-105'
                        : mode === 'text' && !modeSelected
                        ? (darkMode ? 'bg-neutral-800' : 'bg-neutral-100')
                        : ''
                    }`}
                    onClick={() => {
                      if (modeSelected && selectedMode === 'text') {
                        handleModeBack();
                      } else {
                        handleModeSelect('text');
                      }
                    }}
                    title={modeSelected && selectedMode === 'text' ? "Back to mode selection" : "Text"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M6 6h12M6 12h10M6 18h8" stroke="#111" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Text</span>
                  </button>

                  {/* Image Mode */}
                  <button
                    className={`rounded-md px-2 py-1 text-xs flex items-center gap-1 transition-all duration-300 ${
                      modeSelected && selectedMode !== 'image' 
                        ? 'opacity-0 scale-95 pointer-events-none' 
                        : modeSelected && selectedMode === 'image'
                        ? 'bg-neutral-100 scale-105'
                        : mode === 'image' && !modeSelected
                        ? (darkMode ? 'bg-neutral-800' : 'bg-neutral-100')
                        : ''
                    }`}
                    onClick={() => {
                      if (modeSelected && selectedMode === 'image') {
                        handleModeBack();
                      } else {
                        handleModeSelect('image');
                      }
                    }}
                    title={modeSelected && selectedMode === 'image' ? "Back to mode selection" : "Image"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="5" width="18" height="14" rx="2" stroke="#111" strokeWidth="1.4"/>
                      <path d="M7 13l3-3 5 5" stroke="#111" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Image</span>
                  </button>

                  {/* Modify Mode */}
                  <button
                    className={`rounded-md px-2 py-1 text-xs flex items-center gap-1 transition-all duration-300 ${
                      modeSelected && selectedMode !== 'image-modify' 
                        ? 'opacity-0 scale-95 pointer-events-none' 
                        : modeSelected && selectedMode === 'image-modify'
                        ? 'bg-neutral-100 scale-105'
                        : mode === 'image-modify' && !modeSelected
                        ? (darkMode ? 'bg-neutral-800' : 'bg-neutral-100')
                        : ''
                    }`}
                    onClick={() => {
                      if (modeSelected && selectedMode === 'image-modify') {
                        handleModeBack();
                      } else {
                        handleModeSelect('image-modify');
                      }
                    }}
                    title={modeSelected && selectedMode === 'image-modify' ? "Back to mode selection" : "Modify"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M3 21l3-1 10-10a2.5 2.5 0 013.5 0l1.5 1.5a2.5 2.5 0 010 3.5L17.5 21 3 21z" stroke="#111" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Modify</span>
                  </button>

                  {/* Video Mode */}
                  <button
                    className={`rounded-md px-2 py-1 text-xs flex items-center gap-1 transition-all duration-300 ${
                      modeSelected && selectedMode !== 'video' 
                        ? 'opacity-0 scale-95 pointer-events-none' 
                        : modeSelected && selectedMode === 'video'
                        ? 'bg-neutral-100 scale-105'
                        : mode === 'video' && !modeSelected
                        ? (darkMode ? 'bg-neutral-800' : 'bg-neutral-100')
                        : ''
                    }`}
                    onClick={() => {
                      if (modeSelected && selectedMode === 'video') {
                        handleModeBack();
                      } else {
                        handleModeSelect('video');
                      }
                    }}
                    title={modeSelected && selectedMode === 'video' ? "Back to mode selection" : "Video"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <rect x="2" y="6" width="14" height="12" rx="2" stroke="#111" strokeWidth="1.4"/>
                      <path d="M22 8v8l-4-4 4-4z" stroke="#111" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Video</span>
                  </button>
                </div>

                {/* Back Button Overlay (appears when mode is selected) */}
                {modeSelected && (
                  <div className="absolute left-0 top-0 flex items-center transition-all duration-300">
                    <button
                      onClick={handleModeBack}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-600 hover:text-neutral-800 transition-colors"
                      title="Back to mode selection"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="rotate-180">
                        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Back</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Saved Templates (dropdown) */}
            {(() => {
              if (typeof window === 'undefined') return null;
              const templates = JSON.parse(localStorage.getItem('creatorTemplates') || '{}');
              const templateNames = Object.keys(templates);
              if (templateNames.length === 0) return null;
              return (
                <div className="mb-3 space-y-1">
                  <label className="text-xs font-semibold">Content templates</label>
                  <div className="flex gap-2 items-center">
                    <select
                      value={quickTemplateSel}
                      onChange={(e)=>{
                        const name = e.target.value; setQuickTemplateSel(name);
                        if (name && templates[name]) {
                          const t = templates[name];
                          setInput(t.prompt || '');
                          if (t.mode) setMode(t.mode);
                          if (t.aspectRatio) setAspectRatio(t.aspectRatio);
                          if (t.batchSize!=null) setBatchSize(t.batchSize);
                        }
                      }}
                      className={`flex-1 rounded border px-2 py-1 text-xs ${darkMode ? 'bg-neutral-900 border-neutral-700 text-neutral-100' : 'bg-white border-neutral-200'}`}
                    >
                      <option value="">Select template…</option>
                      {templateNames.map((n)=> (<option key={n} value={n}>{n}</option>))}
                    </select>
                    {quickTemplateSel && (
                      <button
                        onClick={()=>{
                          const t = JSON.parse(localStorage.getItem('creatorTemplates') || '{}');
                          delete t[quickTemplateSel];
                          localStorage.setItem('creatorTemplates', JSON.stringify(t));
                          setQuickTemplateSel('');
                          // quick refresh by toggling
                          setQuickCreateOpen(false); setTimeout(()=> setQuickCreateOpen(true), 80);
                        }}
                        className={`rounded border px-2 py-1 text-xs ${darkMode ? 'border-neutral-700 hover:bg-neutral-800' : 'hover:bg-gray-50'}`}
                        title="Delete template"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Basic Controls */}
            <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: (mode === 'image' || mode === 'image-modify') ? '1fr 1fr 1fr' : '1fr 1fr' }}>
              {(mode === 'image' || mode === 'image-modify') ? (
                <>
                  <div>
                    <label className="text-xs font-medium opacity-80">Aspect Ratio</label>
                    <select value={aspectRatio} onChange={(e)=> setAspectRatio(e.target.value)} className={`w-full rounded border px-2 py-1 h-8 text-xs bg-white border-neutral-200 text-black`}>
                      <option value="">Auto</option>
                      {AR_CHOICES.map((ar)=> (<option key={ar} value={ar}>{ar}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium opacity-80">Quantity</label>
                    <select value={batchSize===''?'':String(batchSize)} onChange={(e)=> setBatchSize(e.target.value===''?'':Number(e.target.value))} className={`w-full rounded border px-2 py-1 h-8 text-xs bg-white border-neutral-200 text-black`}>
                      <option value="">1</option>
                      {BATCH_CHOICES.map((n)=> (<option key={n} value={n}>{n}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium opacity-80">Character</label>
                    <select
                      value={isPresetLoRa(loraName) ? loraName : 'Custom...'}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === 'None') setLoraName('');
                        else if (v === 'Custom...') setLoraName(loraName || '');
                        else setLoraName(v);
                      }}
                      className={`w-full rounded border px-2 py-1 h-8 text-xs bg-white border-neutral-200 text-black`}
                    >
                      {LORA_CHOICES.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : null}
              {mode === 'text' ? (
                <div className="col-span-2">
                  <label className="text-xs font-medium opacity-80">Content type</label>
                  <select
                    value={quickTextCategory}
                    onChange={(e)=> setQuickTextCategory(e.target.value as any)}
                    className="w-full rounded border px-2 py-1 h-8 text-xs bg-white border-neutral-200 text-black"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="twitter">Twitter/X</option>
                    <option value="email">Email</option>
                    <option value="youtube">YouTube</option>
                  </select>
                </div>
              ) : null}
              {(mode === 'image') && (
                <div className="col-span-2">
                  <div className="text-xs font-medium opacity-80 mb-1">Style</div>
                  <div className="inline-flex rounded-md overflow-hidden border">
                    {([
                      {id:'cinematic', label:'Cinematic'},
                      {id:'ultra', label:'Ultra realistic'},
                      {id:'cool', label:'Cool'},
                    ] as const).map((t)=> (
                      <button
                        key={t.id}
                        onClick={()=> setQuickImageStyle(t.id)}
                        className={`px-2 py-1 text-xs ${quickImageStyle===t.id ? (darkMode?'bg-neutral-800 text-white':'bg-neutral-100') : (darkMode?'bg-neutral-900 text-neutral-200':'bg-white text-neutral-700')} border-r last:border-r-0 ${darkMode ? 'border-neutral-700' : 'border-neutral-200'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {/* Per-style quick presets: 6 equal-size buttons */}
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(quickImageStyle === 'cinematic' ? [
                      'cinematic portrait, dramatic lighting',
                      'cinematic landscape, golden hour',
                      'cinematic product shot, studio grade',
                      'cinematic street scene, moody tones',
                      'cinematic wide shot, shallow depth of field',
                      'cinematic close-up, film grain',
                    ] : quickImageStyle === 'ultra' ? [
                      'ultra realistic portrait, detailed skin texture',
                      'ultra realistic product photo, crisp reflections',
                      'ultra realistic food photo, natural lighting',
                      'ultra realistic architectural exterior, sharp lines',
                      'ultra realistic macro detail, complex textures',
                      'ultra realistic fashion editorial, natural fabric',
                    ] : quickImageStyle === 'cool' ? [
                      'cool neon cyberpunk scene, teal/purple',
                      'cool minimal poster, bold geometry',
                      'cool editorial portrait, high key',
                      'cool abstract gradients, soft glow',
                      'cool tech product hero, gray accents',
                      'cool street fashion, crisp tones',
                    ] : []).map((txt, idx) => (
                      <button
                        key={idx}
                        onClick={()=> setInput(txt)}
                        className={`h-9 rounded border text-xs px-2 ${darkMode ? 'border-neutral-700 hover:bg-neutral-900' : 'border-neutral-200 hover:bg-neutral-50'}`}
                        title={txt}
                      >
                        <div className="truncate">{txt}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {mode === 'text' ? (
                <div className="col-span-2">
                  <label className="text-xs font-medium opacity-80">Provider</label>
                  <select value={textProvider} onChange={(e)=> setTextProvider(e.target.value as any)} className="w-full rounded border px-2 py-1 text-sm">
                    <option value="social">Social</option>
                    <option value="openai">OpenAI</option>
                    <option value="deepseek">DeepSeek</option>
                  </select>
                </div>
              ) : null}
            </div>

            {/* Advanced toggles moved to bottom (after input/buttons) */}
            {/* Advanced Controls placeholder - moved below */}
            {/* (content removed here) */}
            

            {/* Attachment Preview */}
            {attached && (
              <div className="mb-3 rounded border p-2 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-700">{attached.name}</span>
                  <button onClick={() => setAttached(null)} className="text-xs text-red-600 hover:underline">Remove</button>
                </div>
              </div>
            )}

            {/* Built-in text templates removed in favor of dropdowns */}

            {/* Quick presets (dropdown by mode) - hidden for image (uses style presets). Text mode presets are category-driven. */}
            {mode !== 'image' && (
            <div className="mb-3 space-y-1">
              <label className="text-xs font-semibold">Quick presets</label>
              <select
                value={quickPresetSel}
                onChange={(e)=>{
                  const v = e.target.value; setQuickPresetSel(v);
                  if (!v) return;
                  const byText: Record<string, Record<string,string>> = {
                    instagram: {
                      caption_short: 'Write a short Instagram caption about [topic]. Include 3-5 relevant hashtags and a subtle CTA.',
                      caption_story: 'Write an engaging Instagram Story caption for [topic], with a hook and a clear swipe-up CTA.',
                      carousel_outline: 'Create a 5-slide Instagram carousel outline for [topic], each slide title and 1-2 bullets.',
                      reel_script: 'Write a 20-second Instagram Reel script about [topic] with 3 beats and a final CTA.',
                      hooks_list: 'List 10 strong hooks for an Instagram post about [topic].',
                      hashtags: 'Suggest 20 niche and relevant hashtags for [topic].',
                    },
                    linkedin: {
                      post: 'Write a LinkedIn post about [topic] that is professional, insightful, and actionable.',
                      thought_leadership: 'Write a thought-leadership LinkedIn post on [topic] with data points and a question to drive comments.',
                      carousel_outline: 'Create a 6-slide LinkedIn carousel outline about [topic], slide titles + bullets.',
                      headline_variations: 'Generate 10 LinkedIn post headlines for [topic] with different angles.',
                      poll: 'Draft a LinkedIn poll for [topic] with 4 answer options and a short intro.',
                      dm_template: 'Write a short LinkedIn DM template to reach out about [topic].',
                    },
                    twitter: {
                      thread5: 'Write a 5-tweet Twitter/X thread on [topic]. Start with a strong hook and end with a CTA.',
                      hooks: 'List 10 tweet hooks for [topic].',
                      summary: 'Summarize [topic] into 7 concise tweets with emojis removed.',
                      reply: 'Draft a thoughtful reply to a tweet about [topic] adding value and a question.',
                      announcement: 'Write a product announcement tweet about [topic] with benefits and a short CTA.',
                      call_to_action: 'Write 10 short CTAs suitable for Twitter/X to promote [topic].',
                    },
                    email: {
                      subject_lines: 'Write 20 email subject lines for [topic] optimized for opens.',
                      preview_texts: 'Write 10 email preheader/preview texts for [topic].',
                      short_email: 'Write a short announcement email about [topic], 120-160 words.',
                      nurture_email: 'Write a nurture email about [topic] with 3 sections and a soft CTA.',
                      promo_email: 'Write a promotional email for [topic] with clear benefits and urgency.',
                      cta_variations: 'Write 15 concise email CTA variations for [topic].',
                    },
                    youtube: {
                      description: 'Write a YouTube description for [topic], include timestamps, keywords, and subscribe CTA.',
                      title_ideas: 'Generate 15 YouTube title ideas for [topic], clickable and clear.',
                      tags: 'Provide 25 SEO-friendly tags for a YouTube video about [topic].',
                      outline: 'Create a YouTube video outline for [topic] with segments and key talking points.',
                      shorts_script: 'Write a 30-second YouTube Shorts script for [topic] with a hook and punchy ending.',
                      thumbnail_text: 'Suggest 10 short thumbnail text options for [topic] (max 4 words each).',
                    },
                  };
                  const byMode: Record<string, Record<string, string>> = {
                    text: byText[quickTextCategory] || {},
                    'image-modify': {
                      restore: 'Restore and enhance this image: improve clarity, remove noise, fix colors',
                      stylize: 'Apply a cinematic color grade and modern art style to this image',
                    },
                    video: {
                      close: 'Close shot, subject centered, rich details, smooth motion',
                      wide: 'Wide shot, expansive scene, balanced composition, smooth motion',
                      side: 'Side profile shot, clean background, subtle parallax',
                      profile: 'Profile shot, neutral background, cinematic lighting',
                      cinematic: 'Cinematic composition, shallow depth of field, filmic look',
                      ultra: 'Ultra realistic, detailed textures, natural motion and lighting',
                    }
                  };
                  const table = (byMode as any)[mode] || {};
                  const text = table[v] || '';
                  if (text) setInput(text);
                }}
                className={`w-full rounded border px-2 py-1 text-xs bg-white border-neutral-200 text-black`}
              >
                <option value="">Select preset…</option>
                {(() => {
                  if (mode === 'text') {
                    const labels: Record<string, Record<string,string>> = {
                      instagram: { caption_short:'caption (short)', caption_story:'caption (story)', carousel_outline:'carousel outline', reel_script:'reel script', hooks_list:'hooks list', hashtags:'hashtags' },
                      linkedin: { post:'post', thought_leadership:'thought leadership', carousel_outline:'carousel outline', headline_variations:'headline ideas', poll:'poll', dm_template:'DM template' },
                      twitter: { thread5:'thread (5)', hooks:'hooks list', summary:'summary', reply:'reply', announcement:'announcement', call_to_action:'CTAs' },
                      email: { subject_lines:'subject lines', preview_texts:'preview texts', short_email:'short email', nurture_email:'nurture email', promo_email:'promo email', cta_variations:'CTA variations' },
                      youtube: { description:'description', title_ideas:'title ideas', tags:'tags', outline:'outline', shorts_script:'shorts script', thumbnail_text:'thumbnail text' },
                    };
                    return Object.entries(labels[quickTextCategory] || {}).map(([k,v]) => (
                      <option key={k} value={k}>{v}</option>
                    ));
                  }
                  const labelsOther: Record<string, Record<string,string>> = {
                    'image-modify': { restore: 'restore', stylize: 'stylize' },
                    video: { close: 'close shot', wide: 'wide shot', side: 'side profile', profile: 'profile', cinematic: 'cinematic', ultra: 'ultra realistic' },
                  };
                  return Object.entries(labelsOther[mode as 'image-modify'|'video'] || {}).map(([k,v]) => (
                    <option key={k} value={k}>{v}</option>
                  ));
                })()}
              </select>
            </div>
            )}

            {/* Main Input */}
            <textarea 
              value={input} 
              onChange={(e)=> setInput(e.target.value)} 
              className="mb-3 h-32 w-full resize-none rounded border p-3 text-sm" 
            />

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* File Attachment */}
                <label className="cursor-pointer rounded-md px-3 py-1 text-sm border border-neutral-200 bg-white hover:bg-neutral-50 flex items-center gap-2" title="Attach file">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" stroke="#111827" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M17 3l4 4M21 3l-4 4" stroke="#111827" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-xs text-neutral-700">Attach</span>
                  <input
                    type="file"
                    accept="image/*,video/*,application/pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const dataUrl = String(reader.result || '');
                        setAttached({ name: f.name, type: f.type, dataUrl });
                      };
                      reader.readAsDataURL(f);
                    }}
                  />
                </label>

                {/* Send to Canvas Toggle */}
                <button 
                  onClick={() => setSendToCanvas(!sendToCanvas)}
                  className={`rounded-md px-3 py-1 text-sm border ${sendToCanvas ? 'bg-neutral-100 border-neutral-300 text-black' : 'border-neutral-200 hover:bg-neutral-50'}`}
                  title="Send result to canvas"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="inline mr-1">
                    <path d="M12 5v14M5 12h14" stroke={sendToCanvas ? '#2563EB' : '#374151'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-xs">Canvas</span>
                </button>

                {/* Save to Library Toggle (opt-in) */}
                <button
                  onClick={() => { setSaveToLibrary(!saveToLibrary); try { localStorage.setItem('social_twin_save_to_library', !saveToLibrary ? '1' : '0'); } catch {} }}
                  className={`rounded-md px-3 py-1 text-sm border ${saveToLibrary ? 'bg-amber-100 border-amber-300 text-black' : 'border-neutral-200 hover:bg-neutral-50'}`}
                  title="Save generated media to your Library"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="inline mr-1">
                    <path d="M3 7h18M7 3v4M17 3v4" stroke={saveToLibrary ? '#92400E' : '#374151'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-xs">Save</span>
                </button>

                {/* Batch Generate for Creators */}
                <button 
                  onClick={async () => {
                    if (!canAffordGeneration) return;
                    // Generate 3 variations with slight prompt modifications
                    const basePrompt = input.trim();
                    if (!basePrompt) return;
                    
                    const variations = [
                      basePrompt,
                      basePrompt + ", style variation 1",
                      basePrompt + ", style variation 2"
                    ];
                    
                    for (const prompt of variations) {
                      setInput(prompt);
                      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
                      handleSend();
                      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait between generations
                    }
                    setInput(basePrompt); // Reset to original
                  }}
                  className={`rounded border px-3 py-1 text-xs ${canAffordGeneration ? 'hover:bg-neutral-50 border-neutral-300' : 'opacity-50 cursor-not-allowed'}`}
                  title="Generate 3 variations"
                  disabled={!canAffordGeneration}
                >
                  3x batch
                </button>
              </div>

              <div className="flex gap-2">
                <button className="rounded border px-3 py-1 text-xs hover:bg-neutral-50" onClick={()=> setQuickCreateOpen(false)}>Cancel</button>
                
                {/* Template Save */}
                <button 
                  onClick={() => {
                    if (typeof window === 'undefined') return;
                    const templateName = prompt('Save as template:');
                    if (templateName && input.trim()) {
                      const templates = JSON.parse(localStorage.getItem('creatorTemplates') || '{}');
                      templates[templateName] = {
                        prompt: input,
                        mode,
                        aspectRatio,
                        batchSize,
                        timestamp: Date.now()
                      };
                      localStorage.setItem('creatorTemplates', JSON.stringify(templates));
                    }
                  }}
                  className="rounded border px-3 py-1 text-xs hover:bg-neutral-50 border-neutral-300"
                  title="Save current settings as template"
                >
                  Save template
                </button>

                <button 
                  className={`rounded px-4 py-1 text-xs text-white ${canAffordGeneration ? 'bg-black hover:bg-gray-800' : 'bg-gray-400 cursor-not-allowed'} ${(mode === 'image-modify' && !attached) ? 'opacity-50 cursor-not-allowed' : ''}`} 
                  onClick={()=>{ 
                    if (!canAffordGeneration) return; 
                    if (mode === 'image-modify' && !attached) { setMessages(prev => [...prev, { id: generateId(), role: 'error', content: 'Image Modify requires an image attachment.' }]); return; }
                    // Apply quick image style if any
                    if ((mode==='image') && quickImageStyle && input.trim()) {
                      const styleMap: Record<string,string> = {
                        cinematic: 'cinematic, shallow depth of field, dramatic lighting',
                        ultra: 'ultra realistic, detailed textures, photorealistic',
                        cool: 'cool tone, modern aesthetic, crisp lighting',
                      } as const;
                      const s = (styleMap as any)[quickImageStyle];
                      if (s) setInput(prev => prev.includes(s) ? prev : `${prev}, ${s}`);
                    }
                    handleSend(); setQuickCreateOpen(false); 
                  }}
                  disabled={!canAffordGeneration || (mode === 'image-modify' && !attached)}
                  title={(!canAffordGeneration) ? `Need ${generationCost} credits` : (mode === 'image-modify' && !attached) ? 'Attach an image to modify' : 'Generate'}
                >
                  Generate (~{generationCost})
                </button>
              </div>
            </div>

            {/* Advanced Settings Toggle (now last) */}
            <button
              onClick={() => setShowQuickAdvanced(!showQuickAdvanced)}
              className={`mt-3 mb-2 flex w-full items-center justify-between rounded border px-2 py-1 text-xs ${darkMode ? 'border-neutral-700 hover:bg-neutral-900' : 'hover:bg-gray-50'}`}
            >
              <span>Advanced settings</span>
              <span>{showQuickAdvanced ? '▼' : '▶'}</span>
            </button>

            {/* Advanced Controls */}
            {showQuickAdvanced && (
              <div className={`mb-1 space-y-3 rounded border p-3 ${darkMode ? 'bg-neutral-900/60 border-neutral-700' : 'bg-gray-50 border-neutral-200'}`}>
                {/* Advanced Parameters for Image/Video */}
                {(mode === 'image' || mode === 'image-modify' || mode === 'video') && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-medium opacity-80">CFG Scale</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Auto"
                        value={cfgScale}
                        onChange={(e) => setCfgScale(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full rounded border px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium opacity-80">Guidance</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Auto"
                        value={guidance}
                        onChange={(e) => setGuidance(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full rounded border px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium opacity-80">Steps</label>
                      <input
                        type="number"
                        placeholder="Auto"
                        value={steps}
                        onChange={(e) => setSteps(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full rounded border px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* LoRA Character Controls */}
                {(mode === 'image' || mode === 'image-modify' || mode === 'video') && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Character (LoRA)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium opacity-80">Character {lorasLoading && '(loading...)'}</label>
                        <select
                          value={isPresetLoRa(loraName) ? loraName : 'Custom...'}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === 'None') setLoraName('');
                            else if (v === 'Custom...') setLoraName(loraName || '');
                            else setLoraName(v);
                          }}
                          className="w-full rounded border px-2 py-1 text-xs"
                          disabled={lorasLoading}
                        >
                          {LORA_CHOICES.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                          {availableLoras.map((lora) => (
                            <option key={lora.filename} value={lora.filename}>
                              {lora.name} ({lora.type})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium opacity-80">Strength</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          placeholder="0.0-1.0"
                          value={loraScale}
                          onChange={(e) => setLoraScale(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full rounded border px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                    {loraName && !isPresetLoRa(loraName) && (
                      <div>
                        <label className="text-xs font-medium opacity-80">Custom LoRA File</label>
                        <input
                          type="text"
                          placeholder="character.safetensors"
                          value={loraName}
                          onChange={(e) => setLoraName(e.target.value)}
                          className="w-full rounded border px-2 py-1 text-xs font-mono"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Workflow summary like the main prompt box */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold opacity-90">Workflow</label>
                  {mode === 'text' && (
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'social', name: 'Social AI', desc: 'Fast & creative' },
                        { id: 'openai', name: 'OpenAI', desc: 'Advanced reasoning' },
                        { id: 'deepseek', name: 'DeepSeek', desc: 'Code & analysis' },
                      ].map((provider) => (
                        <button
                          key={provider.id}
                          onClick={() => setTextProvider(provider.id as any)}
                          className={`rounded-lg px-3 py-2 text-xs transition-all ${
                            textProvider === provider.id
                              ? (darkMode ? 'bg-gray-600 text-white' : 'bg-gray-500 text-white')
                              : (darkMode ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-gray-100 hover:bg-gray-200')
                          }`}
                        >
                          <div className="font-medium">{provider.name}</div>
                          <div className="opacity-75">{provider.desc}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {mode === 'image' && (
                    <div className="rounded-lg border p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border-neutral-300">
                      <div className="text-xs font-medium mb-1">Socialtwin-Image.json</div>
                      <div className="text-xs opacity-75">SD3 • High-res • Creative compositions</div>
                    </div>
                  )}
                  {mode === 'image-modify' && (
                    <div className="rounded-lg border p-3 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/30 dark:to-yellow-900/30 border-neutral-300">
                      <div className="text-xs font-medium mb-1">SocialTwin-Modify.json</div>
                      <div className="text-xs opacity-75">SD3 • Image transformation • Style transfer</div>
                    </div>
                  )}
                  {mode === 'video' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'ltxv', name: 'LTXV', desc: 'Lightning fast', workflows: 'LTXV-TEXT/IMAGE' },
                          { id: 'wan', name: 'WAN', desc: 'Smooth motion', workflows: 'Wan-text/image' },
                        ].map((model) => (
                          <button
                            key={model.id}
                            onClick={() => setVideoModel(model.id as any)}
                            className={`rounded-lg p-2 text-xs transition-all ${
                              videoModel === model.id
                                ? (darkMode ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white')
                                : (darkMode ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-gray-100 hover:bg-gray-200')
                            }`}
                          >
                            <div className="font-medium">{model.name}</div>
                            <div className="opacity-75">{model.desc}</div>
                            <div className="text-[10px] opacity-60 mt-1">{model.workflows}</div>
                          </button>
                        ))}
                      </div>
                      <div className={`text-xs p-2 rounded ${darkMode ? 'bg-neutral-800' : 'bg-gray-100 border border-neutral-300'}`}>
                        <span className="opacity-60">Active: </span>
                        <span className="font-mono">{attached?.type?.startsWith('image') ? (videoModel === 'wan' ? 'Wan-Image-video.json' : 'LTXIMAGETOVIDEO.json') : (videoModel === 'wan' ? 'Wan-text-video.json' : 'LTXV-TEXT_VIDEO.json')}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
      {/* Docked grid controls (bottom-left) */}
      {!simpleMode && (
      <div className="fixed bottom-4 left-6 z-40 flex items-center gap-2">
        <button className="rounded-full p-2 shadow" title={gridEnabled ? 'Hide Grid' : 'Show Grid'} onClick={()=>setGridEnabled(v=>!v)}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none">
            <path d="M4 4h16v16H4z M8 4v16 M16 4v16 M4 8h16 M4 16h16" stroke={darkMode ? '#fff' : '#111111'} strokeWidth="1.4"/>
          </svg>
        </button>
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
      {/* Quick access to Generated tab - only show if not already on generated tab */}

      {/* Legacy panel removed - now using tab interface */}
      {/* Legacy pinned grid removed */}

      {/* PDF Layout Editor */}
      {pdfEditorOpen && (
        <div className="fixed inset-0 z-[10060] bg-black/50 backdrop-blur-sm">
          <div className={`absolute left-1/2 top-4 -translate-x-1/2 w-[92vw] max-w-6xl h-[88vh] rounded-xl border shadow-2xl ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'}`}>
            {/* Enhanced Header */}
            <div className={`flex flex-col border-b ${darkMode ? 'border-neutral-700' : 'border-neutral-200'}`}>
              {/* Top Row - Main Header */}
      <div className={`flex items-center justify-between p-4 ${darkMode ? 'bg-neutral-800' : 'bg-neutral-50'}`}>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow ${darkMode ? 'bg-neutral-900 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 9h10M7 13h10M7 17h6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-neutral-900'}`}>PDF Layout Editor</div>
                      <div className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Design your PDF layout with precision</div>
                    </div>
                  </div>

                  
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={exportPdfFromEditor}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors border ${darkMode ? 'bg-neutral-900 text-white hover:bg-neutral-800 border-neutral-700' : 'bg-neutral-900 text-white hover:bg-black border-neutral-900'}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7,10 12,15 17,10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Export PDF
                  </button>
                  
                  <button 
                    onClick={() => setPdfEditorOpen(false)}
                    className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Controls Row */}
              <div className={`flex items-center gap-4 px-4 pb-3 border-t ${darkMode ? 'border-neutral-800' : 'border-neutral-100'}`}>
                {/* Orientation Toggle */}
                <div className="flex items-center gap-2">
                  <label className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Orientation:</label>
                  <div className="flex rounded border overflow-hidden">
                    <button
                      onClick={() => setPdfOrientation('portrait')}
                      className={`px-3 py-1 text-sm ${pdfOrientation === 'portrait' 
                        ? (darkMode ? 'bg-neutral-700 text-white' : 'bg-neutral-200 text-neutral-900') 
                        : (darkMode ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300' : 'bg-white hover:bg-neutral-50 text-neutral-700')}`}
                    >
                      Portrait
                    </button>
                    <button
                      onClick={() => setPdfOrientation('landscape')}
                      className={`px-3 py-1 text-sm ${pdfOrientation === 'landscape' 
                        ? (darkMode ? 'bg-neutral-700 text-white' : 'bg-neutral-200 text-neutral-900') 
                        : (darkMode ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300' : 'bg-white hover:bg-neutral-50 text-neutral-700')}`}
                    >
                      Landscape
                    </button>
                  </div>
                </div>

                {/* Background Color */}
                <div className="flex items-center gap-2">
                  <label className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Background:</label>
                  <input
                    type="color"
                    value={pdfBackgroundColor}
                    onChange={(e) => setPdfBackgroundColor(e.target.value)}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                </div>

                {/* Text Controls - only show when text is selected */}
                {selectedItem && pdfPages[currentPage]?.items.find(i => i.id === selectedItem)?.type === 'text' && (
                  <>
                    <div className="w-px h-6 bg-neutral-300"></div>
                    
                    {/* Font Family */}
                    <div className="flex items-center gap-2">
                      <label className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Font:</label>
                      <select
                        value={pdfPages[currentPage]?.items.find(i => i.id === selectedItem)?.fontFamily || 'Arial'}
                        onChange={(e) => {
                          setPdfPages(prev => prev.map((page, idx) => 
                            idx === currentPage 
                              ? {
                                  ...page,
                                  items: page.items.map(i => 
                                    i.id === selectedItem ? { ...i, fontFamily: e.target.value } : i
                                  )
                                }
                              : page
                          ));
                        }}
                        className={`rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'}`}
                      >
                        <option value="Arial">Arial</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Tahoma">Tahoma</option>
                      </select>
                    </div>

                    {/* Font Size */}
                    <div className="flex items-center gap-2">
                      <label className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Size:</label>
                      <input
                        type="number"
                        min="8"
                        max="72"
                        value={pdfPages[currentPage]?.items.find(i => i.id === selectedItem)?.fontSize || 16}
                        onChange={(e) => {
                          setPdfPages(prev => prev.map((page, idx) => 
                            idx === currentPage 
                              ? {
                                  ...page,
                                  items: page.items.map(i => 
                                    i.id === selectedItem ? { ...i, fontSize: Number(e.target.value) } : i
                                  )
                                }
                              : page
                          ));
                        }}
                        className={`w-16 rounded border px-2 py-1 text-sm ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'}`}
                      />
                    </div>

                    {/* Font Color */}
                    <div className="flex items-center gap-2">
                      <label className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Color:</label>
                      <input
                        type="color"
                        value={pdfPages[currentPage]?.items.find(i => i.id === selectedItem)?.fontColor || '#000000'}
                        onChange={(e) => {
                          setPdfPages(prev => prev.map((page, idx) => 
                            idx === currentPage 
                              ? {
                                  ...page,
                                  items: page.items.map(i => 
                                    i.id === selectedItem ? { ...i, fontColor: e.target.value } : i
                                  )
                                }
                              : page
                          ));
                        }}
                        className="w-8 h-8 rounded border cursor-pointer"
                      />
                    </div>

                    {/* Text Alignment */}
                    <div className="flex items-center gap-2">
                      <label className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Align:</label>
                      <div className="flex rounded border overflow-hidden">
                        {(['left', 'center', 'right'] as const).map(align => (
                          <button
                            key={align}
                            onClick={() => {
                              setPdfPages(prev => prev.map((page, idx) => 
                                idx === currentPage 
                                  ? {
                                      ...page,
                                      items: page.items.map(i => 
                                        i.id === selectedItem ? { ...i, textAlign: align } : i
                                      )
                                    }
                                  : page
                              ));
                            }}
                            className={`px-2 py-1 text-sm ${
                              pdfPages[currentPage]?.items.find(i => i.id === selectedItem)?.textAlign === align
                                ? (darkMode ? 'bg-neutral-700 text-white' : 'bg-neutral-200 text-neutral-900') 
                                : (darkMode ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300' : 'bg-white hover:bg-neutral-50 text-neutral-700')
                            }`}
                          >
                            {align === 'left' ? 'L' : align === 'center' ? 'C' : 'R'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Bold Toggle */}
                    <button
                      onClick={() => {
                        const currentWeight = pdfPages[currentPage]?.items.find(i => i.id === selectedItem)?.fontWeight || 'normal';
                        setPdfPages(prev => prev.map((page, idx) => 
                          idx === currentPage 
                            ? {
                                ...page,
                                items: page.items.map(i => 
                                  i.id === selectedItem ? { ...i, fontWeight: currentWeight === 'bold' ? 'normal' : 'bold' } : i
                                )
                              }
                            : page
                        ));
                      }}
                      className={`px-3 py-1 text-sm font-bold rounded border ${
                        pdfPages[currentPage]?.items.find(i => i.id === selectedItem)?.fontWeight === 'bold'
                          ? (darkMode ? 'bg-neutral-700 text-white border-neutral-600' : 'bg-neutral-200 text-neutral-900 border-neutral-300') 
                          : (darkMode ? 'border-neutral-700 hover:bg-neutral-800 text-neutral-300' : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700')
                      }`}
                    >
                      B
                    </button>
                  </>
                )}
                {/* Push Add Text to the far right of the controls row */}
                <div className="ml-auto">
                  <button 
                    onClick={() => {
                      const newText = {
                        id: generateId(),
                        type: 'text' as const,
                        text: 'Edit me',
                        x: 100,
                        y: 100,
                        w: 200,
                        h: 40,
                        fontSize: 16,
                        fontFamily: 'Arial',
                        fontColor: '#000000',
                        fontWeight: 'normal' as const,
                        textAlign: 'left' as const
                      };
                      setPdfPages(prev => prev.map((page, idx) => 
                        idx === currentPage 
                          ? { ...page, items: [...page.items, newText] }
                          : page
                      ));
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${darkMode ? 'border-neutral-600 hover:bg-neutral-800 text-white' : 'border-neutral-200 hover:bg-neutral-50 text-neutral-900'}`}
                    title="Add a text box"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14,2 14,8 20,8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10,9 9,9 8,9"></polyline>
                    </svg>
                    Add Text
                  </button>
                </div>
              </div>
            </div>

            {/* Enhanced Page Canvas */}
            <div className={`flex-1 overflow-hidden p-4 ${darkMode ? 'bg-neutral-900/50' : 'bg-neutral-50/30'}`}>
              <div className="flex h-full gap-4">
                {/* Pages Sidebar */}
                <div className={`w-44 shrink-0 flex flex-col ${darkMode ? 'border-r border-neutral-800' : 'border-r border-neutral-200'}`}>
                  <div className={`px-2 py-2 sticky top-0 z-10 ${darkMode ? 'bg-neutral-900' : 'bg-white'} ${darkMode ? 'border-b border-neutral-800' : 'border-b border-neutral-200'} flex items-center justify-between`}>
                    <span className={`text-xs uppercase tracking-wide ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Pages</span>
                    <button
                      onClick={() => {
                        const newPage = { id: generateId(), items: [] };
                        setPdfPages(prev => [...prev, newPage]);
                        setCurrentPage(pdfPages.length);
                      }}
                      className={`text-xs px-2 py-1 rounded border ${darkMode ? 'border-neutral-700 hover:bg-neutral-800 text-neutral-200' : 'border-neutral-200 hover:bg-neutral-50 text-neutral-800'}`}
                      title="Add Page"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-2">
                    {pdfPages.map((page, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentPage(idx)}
                        className={`w-full rounded-md border text-left transition-colors ${idx === currentPage ? (darkMode ? 'border-neutral-500 bg-neutral-800' : 'border-neutral-400 bg-neutral-100') : (darkMode ? 'border-neutral-800 hover:bg-neutral-900' : 'border-neutral-200 hover:bg-neutral-50')}`}
                      >
                        <div className="p-2">
                          <div
                            className={`w-full h-24 rounded ${darkMode ? 'bg-neutral-800' : 'bg-neutral-200'}`}
                            style={{ backgroundColor: pdfBackgroundColor }}
                          ></div>
                          <div className="mt-2 flex items-center justify-between text-[10px]">
                            <span className={darkMode ? 'text-neutral-300' : 'text-neutral-700'}>Page {idx + 1}</span>
                            <span className={darkMode ? 'text-neutral-500' : 'text-neutral-500'}>{page.items?.length || 0} items</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Canvas Container */}
  <div className={`relative flex-1 flex flex-col items-center ${pdfOrientation === 'portrait' ? 'justify-start pt-0' : 'justify-center'} w-full overflow-auto`}>
                  <div 
          className={`relative mx-auto border-2 shadow-2xl rounded-lg ${darkMode ? 'border-neutral-600' : 'border-neutral-300'}`}
                    style={{ 
                      width: pdfOrientation === 'portrait' ? '595px' : '842px', 
                      height: pdfOrientation === 'portrait' ? '842px' : '595px',
                      backgroundColor: pdfBackgroundColor,
                      transform: 'scale(0.65)',
                      transformOrigin: 'center center',
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                      marginTop: pdfOrientation === 'portrait' ? -80 : 0
                    }}
                    onClick={(e) => {
                      // Deselect item when clicking on empty canvas area
                      if (e.target === e.currentTarget) {
                        setSelectedItem(null);
                      }
                    }}
                  >
                    {/* Grid Overlay */}
                    <div 
                      className="absolute inset-0 opacity-30 pointer-events-none"
                      style={{
                        backgroundImage: `
                          linear-gradient(rgba(156, 163, 175, 0.2) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(156, 163, 175, 0.2) 1px, transparent 1px)
                        `,
                        backgroundSize: '20px 20px'
                      }}
                    ></div>

                    {/* Page Items */}
                    {pdfPages[currentPage]?.items.map((item) => (
                      <div
                        key={item.id}
                        className={`absolute border-2 cursor-move group ${
                          selectedItem === item.id 
                            ? (darkMode ? 'border-neutral-500 shadow-lg ring-4 ring-neutral-500/20' : 'border-neutral-500 shadow-lg ring-4 ring-neutral-500/20') 
                            : (darkMode ? 'border-dashed border-neutral-600 hover:border-neutral-500 hover:shadow-md' : 'border-dashed border-neutral-300 hover:border-neutral-400 hover:shadow-md')
                        } ${item.type === 'text' ? 'bg-white/80 backdrop-blur-sm' : ''}`}
                        style={{
                          left: item.x,
                          top: item.y,
                          width: item.w,
                          height: item.h,
                          borderRadius: item.type === 'text' ? '6px' : '4px',
                          willChange: 'left, top, width, height'
                        }}
                        onClick={() => setSelectedItem(item.id)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSelectedItem(item.id);
                          const startX = e.clientX;
                          const startY = e.clientY;
                          const startItemX = item.x;
                          const startItemY = item.y;
                          
                          const pageWidth = pdfOrientation === 'portrait' ? 595 : 842;
                          const pageHeight = pdfOrientation === 'portrait' ? 842 : 595;

                          // Improve drag UX
                          const prevUserSelect = document.body.style.userSelect;
                          const prevCursor = document.body.style.cursor;
                          document.body.style.userSelect = 'none';
                          document.body.style.cursor = 'grabbing';

                          const handleMouseMove = (e: MouseEvent) => {
                            const deltaX = (e.clientX - startX) / 0.65; // Account for scale
                            const deltaY = (e.clientY - startY) / 0.65;
                            const newX = Math.max(0, Math.min(pageWidth - item.w, startItemX + deltaX));
                            const newY = Math.max(0, Math.min(pageHeight - item.h, startItemY + deltaY));

                            setPdfPages(prev => prev.map((page, idx) => 
                              idx === currentPage 
                                ? {
                                    ...page,
                                    items: page.items.map(i => 
                                      i.id === item.id ? { ...i, x: newX, y: newY } : i
                                    )
                                  }
                                : page
                            ));
                          };

                          const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                            document.body.style.userSelect = prevUserSelect;
                            document.body.style.cursor = prevCursor;
                          };

                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                      >
                        {item.type === 'image' ? (
                          <img 
                            src={item.url} 
                            alt="PDF item" 
                            className="w-full h-full object-contain rounded"
                            draggable={false}
                          />
                        ) : (
                          <div 
                            className="w-full h-full p-3 bg-transparent resize-none outline-none overflow-hidden"
                            style={{ 
                              fontSize: `${item.fontSize || 16}px`,
                              fontFamily: item.fontFamily || 'Arial',
                              color: item.fontColor || '#000000',
                              fontWeight: item.fontWeight || 'normal',
                              textAlign: item.textAlign || 'left',
                              lineHeight: '1.4'
                            }}
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              const newText = e.currentTarget.textContent || '';
                              setPdfPages(prev => prev.map((page, idx) => 
                                idx === currentPage 
                                  ? {
                                      ...page,
                                      items: page.items.map(i => 
                                        i.id === item.id ? { ...i, text: newText } : i
                                      )
                                    }
                                  : page
                              ));
                            }}
                            onFocus={() => setSelectedItem(item.id)}
                          >
                            {item.text}
                          </div>
                        )}
                        
                        {/* Enhanced Delete button */}
                        <button
                          className={`absolute -top-3 -right-3 w-7 h-7 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg flex items-center justify-center ${darkMode ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100' : 'bg-neutral-900 hover:bg-neutral-800 text-white'}`}
                          onClick={() => {
                            setPdfPages(prev => prev.map((page, idx) => 
                              idx === currentPage 
                                ? {
                                    ...page,
                                    items: page.items.filter(i => i.id !== item.id)
                                  }
                                : page
                            ));
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>

                        {/* Enhanced Resize handle */}
                        <div
                          className={`absolute -bottom-1 -right-1 w-4 h-4 cursor-se-resize opacity-0 group-hover:opacity-100 rounded-full shadow-md ${darkMode ? 'bg-neutral-500 hover:bg-neutral-400' : 'bg-neutral-400 hover:bg-neutral-500'}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const startX = e.clientX;
                            const startY = e.clientY;
                            const startW = item.w;
                            const startH = item.h;
                            
                            const pageWidth = pdfOrientation === 'portrait' ? 595 : 842;
                            const pageHeight = pdfOrientation === 'portrait' ? 842 : 595;

                            const prevUserSelect = document.body.style.userSelect;
                            const prevCursor = document.body.style.cursor;
                            document.body.style.userSelect = 'none';
                            document.body.style.cursor = 'nwse-resize';

                            const handleMouseMove = (e: MouseEvent) => {
                              const deltaX = (e.clientX - startX) / 0.65;
                              const deltaY = (e.clientY - startY) / 0.65;
                              const newW = Math.max(50, Math.min(pageWidth - item.x, startW + deltaX));
                              const newH = Math.max(20, Math.min(pageHeight - item.y, startH + deltaY));

                              setPdfPages(prev => prev.map((page, idx) => 
                                idx === currentPage 
                                  ? {
                                      ...page,
                                      items: page.items.map(i => 
                                        i.id === item.id ? { ...i, w: newW, h: newH } : i
                                      )
                                    }
                                  : page
                              ));
                            };

                            const handleMouseUp = () => {
                              document.removeEventListener('mousemove', handleMouseMove);
                              document.removeEventListener('mouseup', handleMouseUp);
                              document.body.style.userSelect = prevUserSelect;
                              document.body.style.cursor = prevCursor;
                            };

                            document.addEventListener('mousemove', handleMouseMove);
                            document.addEventListener('mouseup', handleMouseUp);
                          }}
                        >
                          <div className="absolute inset-0 bg-white rounded-full scale-50"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Status Bar */}
                  <div className={`mt-4 flex items-center justify-between px-4 py-2 rounded-lg ${darkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        {pdfPages[currentPage]?.items.length || 0} items on page
                      </div>
                      <div className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        {pdfOrientation === 'portrait' ? '595×842' : '842×595'} pts
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedItem && (
                        <div className={`text-sm px-2 py-1 rounded ${darkMode ? 'bg-neutral-700 text-neutral-200' : 'bg-neutral-100 text-neutral-700'}`}>
                          {pdfPages[currentPage]?.items.find(i => i.id === selectedItem)?.type} selected
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Director's Desk Modal */}
      {storyboardOpen && (
        <div className="fixed inset-0 z-[9999] bg-black bg-opacity-95 flex items-center justify-center p-4 overflow-hidden">
          <div className="w-full h-full max-w-7xl bg-neutral-900 rounded-xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-700">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4v12H8V4h12m0-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7.53 12L9 10.5l1.4-1.41 2.07 2.08L17.6 6 19 7.41 12.47 14z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Director's Desk</h2>
                  <p className="text-sm text-neutral-400">Visual storytelling workspace</p>
                </div>
                
                {/* Mode Toggle */}
                <div className="flex bg-neutral-800 rounded-lg p-1">
                  <button
                    onClick={() => setDirectorMode('gallery')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      directorMode === 'gallery'
                        ? 'bg-gray-500 text-white shadow-md'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    📸 Gallery ({imageGallery.length})
                  </button>
                  <button
                    onClick={() => setDirectorMode('storyboard')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      directorMode === 'storyboard'
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    🎬 Storyboard ({storyboardFrames.length})
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {storyboardLocked && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-500/20 text-green-400 rounded-lg">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10A2,2 0 0,1 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"/>
                    </svg>
                    <span className="text-sm font-medium">Locked</span>
                  </div>
                )}
                <button
                  onClick={() => setStoryboardOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-400 hover:text-white transition-all"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Phase 1: Image Gallery (Inspiration Mode) */}
            {directorMode === 'gallery' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Generation Controls */}
                <div className="p-6 border-b border-neutral-700 bg-neutral-800">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={batchPrompt}
                        onChange={(e) => setBatchPrompt(e.target.value)}
                        placeholder="Describe the shots you want to generate..."
                        className="w-full bg-neutral-700 text-white border border-neutral-600 rounded-lg px-4 py-3 text-sm focus:border-gray-500 focus:outline-none"
                      />
                    </div>
                    <select
                      value={selectedStyle}
                      onChange={(e) => setSelectedStyle(e.target.value)}
                      className="bg-neutral-700 text-white border border-neutral-600 rounded-lg px-3 py-3 text-sm"
                    >
                      <option value="cinematic">Cinematic</option>
                      <option value="documentary">Documentary</option>
                      <option value="commercial">Commercial</option>
                      <option value="artistic">Artistic</option>
                      <option value="vintage">Vintage Film</option>
                    </select>
                    <select
                      value={batchSize}
                      onChange={(e) => setBatchSize(parseInt(e.target.value))}
                      className="bg-neutral-700 text-white border border-neutral-600 rounded-lg px-3 py-3 text-sm"
                    >
                      <option value="5">Batch x5</option>
                      <option value="10">Batch x10</option>
                      <option value="15">Batch x15</option>
                      <option value="20">Batch x20</option>
                    </select>
                    <button
                      onClick={() => {
                        if (batchPrompt.trim()) {
                          setIsGeneratingBatch(true);
                          // Simulate batch generation
                          setTimeout(() => {
                            const count = typeof batchSize === 'number' ? batchSize : Number(batchSize) || 1;
                            const newImages = Array.from({ length: count }, (_, i) => ({
                              id: `img-${Date.now()}-${i}`,
                              url: `https://picsum.photos/400/300?random=${Date.now() + i}`, // Placeholder
                              prompt: batchPrompt,
                              createdAt: new Date().toISOString(),
                              style: selectedStyle
                            }));
                            setImageGallery([...newImages, ...imageGallery]);
                            setIsGeneratingBatch(false);
                          }, 3000);
                        }
                      }}
                      disabled={!batchPrompt.trim() || isGeneratingBatch}
                      className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 disabled:from-neutral-600 disabled:to-neutral-700 text-white px-6 py-3 rounded-lg font-medium transition-all"
                    >
                      {isGeneratingBatch ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Generating...
                        </div>
                      ) : (
                        'Generate Images'
                      )}
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-neutral-400">
                    <span>Gallery: {imageGallery.length} images • Storyboard: {storyboardFrames.length} frames</span>
                    <span>Click [+] on any image to add to storyboard</span>
                  </div>
                </div>

                {/* Image Gallery */}
                <div className="flex-1 overflow-y-auto p-6">
                  {imageGallery.length > 0 ? (
                    <div className="grid grid-cols-4 gap-4">
                      {imageGallery.map((image) => (
                        <div
                          key={image.id}
                          className="group relative bg-neutral-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-gray-500 transition-all"
                        >
                          <div className="aspect-video bg-neutral-700 flex items-center justify-center">
                            <img 
                              src={image.url} 
                              alt="Generated shot" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          
                          {/* Overlay Controls */}
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all flex items-center justify-center">
                            <button
                              onClick={() => {
                                const newFrame = {
                                  id: `frame-${Date.now()}`,
                                  imageUrl: image.url,
                                  title: `Shot ${storyboardFrames.length + 1}`,
                                  duration: 3,
                                  motionPreset: 'static',
                                  transition: 'fade',
                                  character: '',
                                  background: '',
                                  action: '',
                                  cameraStyle: 'medium shot',
                                  lookDirection: 'center',
                                  strength: 0.8,
                                  seed: Math.floor(Math.random() * 1000000),
                                  status: 'idle' as const
                                };
                                setStoryboardFrames([...storyboardFrames, newFrame]);
                              }}
                              className="opacity-0 group-hover:opacity-100 w-12 h-12 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white text-xl font-bold transition-all transform scale-0 group-hover:scale-100"
                            >
                              +
                            </button>
                          </div>
                          
                          {/* Image Info */}
                          <div className="p-3">
                            <div className="text-xs text-neutral-400 truncate">{image.prompt}</div>
                            <div className="text-xs text-neutral-500 mt-1">{image.style}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-24 h-24 bg-neutral-800 rounded-lg mx-auto mb-6 flex items-center justify-center">
                          <svg className="w-12 h-12 text-neutral-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M21,17H7V3H21M21,1H7A2,2 0 0,0 5,3V17A2,2 0 0,0 7,19H21A2,2 0 0,0 23,17V3A2,2 0 0,0 21,1M3,5H1V21A2,2 0 0,0 3,23H19V21H3M15.96,10.29L13.21,13.83L11.25,11.47L8.5,15H19.5L15.96,10.29Z"/>
                          </svg>
                        </div>
                        <h3 className="text-xl text-white mb-2">Image Gallery</h3>
                        <p className="text-neutral-400 mb-4">Generate visual concepts for your story</p>
                        <p className="text-sm text-neutral-500">Enter a prompt above and click "Generate Images" to start</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Phase 2: Storyboard (Production Mode) */}
            {directorMode === 'storyboard' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Storyboard Strip */}
                <div className="p-6 border-b border-neutral-700 bg-neutral-800">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Storyboard Timeline</h3>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setStoryboardLocked(!storyboardLocked)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          storyboardLocked
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600 hover:text-white'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d={storyboardLocked 
                            ? "M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10A2,2 0 0,1 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"
                            : "M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3M6,20H18V10H6V20Z"
                          }/>
                        </svg>
                        {storyboardLocked ? 'Unlock Storyboard' : 'Lock Storyboard'}
                      </button>
                      <button
                        disabled={storyboardFrames.length === 0 || !storyboardLocked}
                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-neutral-600 disabled:to-neutral-700 text-white px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                        Generate Video
                      </button>
                    </div>
                  </div>
                  
                  {/* Timeline */}
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {storyboardFrames.length > 0 ? storyboardFrames.map((frame, index) => (
                      <div
                        key={frame.id}
                        onClick={() => setSelectedFrameIndex(index)}
                        className={`flex-shrink-0 w-32 h-20 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedFrameIndex === index
                            ? 'border-purple-500 ring-2 ring-purple-500/30'
                            : 'border-neutral-600 hover:border-neutral-500'
                        }`}
                      >
                        {frame.imageUrl ? (
                          <img src={frame.imageUrl} alt={frame.title} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <div className="w-full h-full bg-neutral-700 rounded-lg flex items-center justify-center text-neutral-500">
                            {index + 1}
                          </div>
                        )}
                      </div>
                    )) : (
                      <div className="flex items-center justify-center h-20 text-neutral-500 text-sm">
                        No frames yet. Add images from the Gallery phase.
                      </div>
                    )}
                  </div>
                </div>

                {/* Frame Preview & Controls */}
                {storyboardFrames.length > 0 && selectedFrameIndex < storyboardFrames.length ? (
                  <div className="flex-1 flex">
                    {/* Preview */}
                    <div className="flex-1 flex flex-col">
                      <div className="flex-1 bg-black flex items-center justify-center p-6">
                        <div className="relative max-w-2xl max-h-full">
                          <img 
                            src={storyboardFrames[selectedFrameIndex].imageUrl} 
                            alt="Frame preview"
                            className="max-w-full max-h-full object-contain rounded-lg"
                          />
                          {/* Motion Preview Overlay */}
                          <div className="absolute inset-0 border-2 border-gray-500/50 rounded-lg flex items-center justify-center pointer-events-none">
                            <div className="bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                              🎥 {storyboardFrames[selectedFrameIndex].motionPreset}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Frame Controls */}
                      <div className="p-6 bg-neutral-800 border-t border-neutral-700">
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-2">🎥 Camera Move</label>
                            <select
                              value={storyboardFrames[selectedFrameIndex].motionPreset}
                              onChange={(e) => {
                                const newFrames = [...storyboardFrames];
                                newFrames[selectedFrameIndex] = { ...newFrames[selectedFrameIndex], motionPreset: e.target.value };
                                setStoryboardFrames(newFrames);
                              }}
                              disabled={storyboardLocked}
                              className="w-full bg-neutral-700 text-white border border-neutral-600 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                            >
                              <option value="static">Static</option>
                              <option value="ken-burns">Ken Burns</option>
                              <option value="pan-left">Pan Left</option>
                              <option value="pan-right">Pan Right</option>
                              <option value="zoom-in">Zoom In</option>
                              <option value="zoom-out">Zoom Out</option>
                              <option value="dolly-in">Dolly In</option>
                              <option value="dolly-out">Dolly Out</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-2">⏱ Duration</label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              step="0.5"
                              value={storyboardFrames[selectedFrameIndex].duration}
                              onChange={(e) => {
                                const newFrames = [...storyboardFrames];
                                newFrames[selectedFrameIndex] = { ...newFrames[selectedFrameIndex], duration: parseFloat(e.target.value) };
                                setStoryboardFrames(newFrames);
                              }}
                              disabled={storyboardLocked}
                              className="w-full bg-neutral-700 text-white border border-neutral-600 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-2">✨ Transition</label>
                            <select
                              value={storyboardFrames[selectedFrameIndex].transition}
                              onChange={(e) => {
                                const newFrames = [...storyboardFrames];
                                newFrames[selectedFrameIndex] = { ...newFrames[selectedFrameIndex], transition: e.target.value };
                                setStoryboardFrames(newFrames);
                              }}
                              disabled={storyboardLocked}
                              className="w-full bg-neutral-700 text-white border border-neutral-600 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                            >
                              <option value="fade">Fade</option>
                              <option value="cut">Cut</option>
                              <option value="dissolve">Dissolve</option>
                              <option value="wipe">Wipe</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-neutral-700 rounded-lg mx-auto mb-4 flex items-center justify-center">
                        <svg className="w-8 h-8 text-neutral-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20 4v12H8V4h12m0-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7.53 12L9 10.5l1.4-1.41 2.07 2.08L17.6 6 19 7.41 12.47 14z"/>
                        </svg>
                      </div>
                      <h3 className="text-xl text-white mb-2">Storyboard Empty</h3>
                      <p className="text-neutral-400 mb-4">Add frames from the Gallery to start building your story</p>
                      <button
                        onClick={() => setDirectorMode('gallery')}
                        className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-all"
                      >
                        Go to Gallery
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Library Modal */}
      {showLibraryModal && (
        <div className="fixed inset-0 z-[10050] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowLibraryModal(false)}>
          <div className="w-full max-w-6xl h-[80vh] bg-neutral-900 rounded-xl shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-700">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2" stroke="currentColor" fill="none"/>
                    <path d="M7 7h10M7 12h8M7 17h6" strokeWidth="2" stroke="currentColor" fill="none"/>
                    <circle cx="16" cy="16" r="3" strokeWidth="2" stroke="currentColor" fill="none"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">My Library</h2>
                  <p className="text-sm text-neutral-400">All your generated content in one place</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-sm text-neutral-400">
                  {libraryItems.length} generations
                </div>
                <button
                  onClick={() => setShowLibraryModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-400 hover:text-white transition-all"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {libraryLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="ml-2 text-white">Loading your library...</span>
                </div>
              ) : libraryItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {[...libraryItems].sort((a,b)=> new Date(b.created_at||b.createdAt||0).getTime() - new Date(a.created_at||a.createdAt||0).getTime()).map((it, index) => {
                    const url = it.display_url || it.result_url;
                    const isVideo = it.type === 'video';

                    return (
                      <div
                        key={it.id}
                        className="group relative bg-neutral-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer"
                        onClick={() => {
                          setViewerItem(it);
                          setViewerOpen(true);
                          setShowLibraryModal(false);
                        }}
                      >
                        {/* Content */}
                        <div className="aspect-square">
                          {isVideo ? (
                            url ? (
                              (!lowDataMode || mediaAllowed.has(it.id)) ? (
                                <video
                                  src={(typeof url==='string' && url.startsWith('http') && !url.startsWith(getLocationOrigin())) ? (`/api/social-twin/proxy?url=${encodeURIComponent(url)}`) : (url as string)}
                                  className="h-full w-full object-cover"
                                  preload="metadata"
                                  muted
                                  onMouseEnter={(e) => {
                                    const video = e.currentTarget;
                                    video.play().catch(() => {});
                                  }}
                                  onMouseLeave={(e) => {
                                    const video = e.currentTarget;
                                    video.pause();
                                    video.currentTime = 0;
                                  }}
                                />
                              ) : (
                                <div
                                  className="w-full h-full flex items-center justify-center text-2xl bg-neutral-700 hover:bg-neutral-600 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMediaAllowed(prev=>{ const n = new Set(prev); n.add(it.id); return n; });
                                  }}
                                >
                                  📹
                                </div>
                              )
                            ) : (
                              <div className="h-full w-full bg-neutral-700 flex items-center justify-center text-2xl opacity-70">
                                ⏳
                              </div>
                            )
                          ) : (
                            url ? (
                              <img
                                src={(typeof url==='string' && url.startsWith('http') && !url.startsWith(getLocationOrigin())) ? (`/api/social-twin/proxy?url=${encodeURIComponent(url)}`) : (url as string)}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                alt="Generated content"
                                onError={(e) => {
                                  const status = it.status || 'completed';
                                  const statusEmoji = status === 'completed' ? '🎨' : status === 'pending' ? '⏳' : status === 'processing' ? '⚙️' : '❌';
                                  const statusText = status === 'completed' ? 'Generated' : status.charAt(0).toUpperCase() + status.slice(1);

                                  e.currentTarget.style.display = 'none';
                                  const parent = e.currentTarget.parentElement;
                                  if (parent && !parent.querySelector('.fallback-placeholder')) {
                                    const placeholder = document.createElement('div');
                                    placeholder.className = 'fallback-placeholder h-full w-full flex flex-col items-center justify-center text-center bg-neutral-700 text-white';
                                    placeholder.innerHTML = `
                                      <div class="text-2xl mb-1">${statusEmoji}</div>
                                      <div class="text-xs opacity-70">${statusText}</div>
                                      ${status === 'completed' ? '<div class="text-xs opacity-50 mt-1">URL expired</div>' : ''}
                                    `;
                                    parent.appendChild(placeholder);
                                  }
                                }}
                              />
                            ) : (
                              <div className="h-full w-full flex flex-col items-center justify-center text-center bg-neutral-700 text-white">
                                <div className="text-2xl mb-1">{it.status === 'pending' ? '⏳' : it.status === 'processing' ? '⚙️' : it.status === 'failed' ? '❌' : '🎨'}</div>
                                <div className="text-xs opacity-70">{it.status ? it.status.charAt(0).toUpperCase() + it.status.slice(1) : 'Generated'}</div>
                                {it.status === 'completed' && <div className="text-xs opacity-50 mt-1">No preview</div>}
                              </div>
                            )
                          )}
                        </div>

                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 text-white text-center">
                            <div className="text-lg mb-1">{isVideo ? '🎥' : '🖼️'}</div>
                            <div className="text-xs">Click to view</div>
                          </div>
                        </div>

                        {/* Info overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <div className="text-white text-xs truncate">
                            {new Date(it.created_at || it.createdAt || 0).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-neutral-800 rounded-lg mx-auto mb-6 flex items-center justify-center">
                      <svg className="w-12 h-12 text-neutral-600" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2" stroke="currentColor" fill="none"/>
                        <path d="M7 7h10M7 12h8M7 17h6" strokeWidth="2" stroke="currentColor" fill="none"/>
                        <circle cx="16" cy="16" r="3" strokeWidth="2" stroke="currentColor" fill="none"/>
                      </svg>
                    </div>
                    <h3 className="text-xl text-white mb-2">Your Library is Empty</h3>
                    <p className="text-neutral-400 mb-4">Generate some images or videos to see them here</p>
                    <button
                      onClick={() => setShowLibraryModal(false)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm transition-all"
                    >
                      Start Creating
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function DraggableResizableItem({ item, dark, onChange, scale, onStartLink, onFinishLink, hoverPort }:{ item: any, dark:boolean, onChange:(it:any)=>void, scale?: number, onStartLink?:(port:'male'|'female')=>void, onFinishLink?:(port:'male'|'female', targetId:string)=>void, hoverPort: { id: string; port: 'male'|'female' } | null }){
  const ref = useRef<HTMLDivElement|null>(null);
  const videoRef = useRef<HTMLVideoElement|null>(null);
  const [videoUi, setVideoUi] = useState<{ playing: boolean; current: number; duration: number; volume: number; muted: boolean }>({ playing: false, current: 0, duration: 0, volume: 1, muted: false });

  // Wire up video events if this item is a video
  useEffect(()=>{
    if (item.type !== 'video') return;
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = ()=>{
      setVideoUi(s=>({ ...s, duration: v.duration || 0 }));
      // Maintain original aspect ratio once metadata is known
      const vw = v.videoWidth || 0; const vh = v.videoHeight || 0;
      if (vw > 0 && vh > 0) {
        const aspect = vw / vh;
        const targetH = Math.max(80, Math.round(item.w / aspect));
        // Only update if aspect not set or size mismatched by > 1px
        if (!item.aspect || Math.abs(item.h - targetH) > 1) {
          onChange({ ...item, aspect, h: targetH });
        } else if (!item.aspect) {
          onChange({ ...item, aspect });
        }
      }
    };
    const onTime = ()=>{
      setVideoUi(s=>({ ...s, current: v.currentTime || 0 }));
    };
    const onPlay = ()=> setVideoUi(s=>({ ...s, playing: true }));
    const onPause = ()=> setVideoUi(s=>({ ...s, playing: false }));
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return ()=>{
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [item, onChange]);

  // Simple resize handle (bottom-right) with aspect ratio lock for images/videos
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
      let nw = Math.max(120, ow + dw);
      let nh = Math.max(80, oh + dh);
      const isMedia = item.type === 'image' || item.type === 'video';
      const aspect = (item as any).aspect && (item as any).aspect > 0 ? (item as any).aspect : (ow / oh);
      if (isMedia && aspect > 0) {
        // Keep original aspect ratio; choose dominant delta axis
        if (Math.abs(dw) >= Math.abs(dh)) {
          nw = Math.max(120, ow + dw);
          nh = Math.max(80, Math.round(nw / aspect));
        } else {
          nh = Math.max(80, oh + dh);
          nw = Math.max(120, Math.round(nh * aspect));
        }
      }
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
      let nw = Math.max(120, ow + dw);
      let nh = Math.max(80, oh + dh);
      const isMedia = item.type === 'image' || item.type === 'video';
      const aspect = (item as any).aspect && (item as any).aspect > 0 ? (item as any).aspect : (ow / oh);
      if (isMedia && aspect > 0) {
        if (Math.abs(dw) >= Math.abs(dh)) {
          nw = Math.max(120, ow + dw);
          nh = Math.max(80, Math.round(nw / aspect));
        } else {
          nh = Math.max(80, oh + dh);
          nw = Math.max(120, Math.round(nh * aspect));
        }
      }
      if (item.type === 'text') {
        const newScale = Math.max(0.5, Math.min(6, nh / 160 * (item.fontScale || 3.2)));
        onChange({ ...item, w:nw, h:nh, fontScale: newScale });
      } else {
        onChange({ ...item, w:nw, h:nh, ...(isMedia ? { aspect } : {}) });
      }
    }
    handle.addEventListener('mousedown', onDown);
    return ()=>{ handle.removeEventListener('mousedown', onDown); };
  }, [item, onChange, scale]);

  return (
  <div ref={ref} style={{ position:'absolute', left:item.x, top:item.y, width:item.w, height:item.h }}
     className={`canvas-item group rounded border cursor-move touch-none ${item.type==='text'
           ? ((typeof window !== 'undefined' && (window as any).__editingTextId === item.id) || false
               ? (dark ? 'border-neutral-700' : 'border-neutral-300')
               : 'border-transparent')
           : (dark ? 'border-neutral-700' : 'border-neutral-300')} overflow-visible select-none`}
         onContextMenu={(e)=>{
           e.preventDefault();
           const rect = (document.body as HTMLElement).getBoundingClientRect();
           (window as any).__setGridMenu && (window as any).__setGridMenu({ open:true, x:e.clientX - rect.left, y:e.clientY - rect.top, targetId: item.id });
         }}
         onMouseDown={(e) => {
           if (e.button !== 0) return;
           
           const target = e.target as HTMLElement;
           if (target.classList.contains('resize')) return;
           if (target.closest('.port')) return;
           if (target.closest('.video-controls-bar')) return;
           if (item.type === 'text' && target.tagName === 'TEXTAREA') return;
           
           e.preventDefault();
           e.stopPropagation();
           
           const startX = e.clientX;
           const startY = e.clientY;
           const startItemX = item.x;
           const startItemY = item.y;
           
           const handleMouseMove = (moveEvent: MouseEvent) => {
             moveEvent.preventDefault();
             const deltaX = moveEvent.clientX - startX;
             const deltaY = moveEvent.clientY - startY;
             
             // Update position immediately
             onChange({ ...item, x: startItemX + deltaX, y: startItemY + deltaY });
           };
           
           const handleMouseUp = () => {
             document.removeEventListener('mousemove', handleMouseMove);
             document.removeEventListener('mouseup', handleMouseUp);
           };
           
           document.addEventListener('mousemove', handleMouseMove);
           document.addEventListener('mouseup', handleMouseUp);
         }}
         title="Drag to move, resize from bottom-right corner"
    >
      {item.type==='video' ? (
        <div className="h-full w-full overflow-hidden relative group">
          <video
            ref={videoRef}
            src={(typeof item.url==='string' && item.url.startsWith('http') && typeof window!=='undefined' && !item.url.startsWith(getLocationOrigin())) ? (`/api/social-twin/proxy?url=${encodeURIComponent(item.url)}`) : (item.url as string)}
            className="h-full w-full origin-center object-contain transition-transform duration-200 group-hover:scale-[1.02] cursor-pointer"
            preload="metadata"
            // No native controls to avoid overlay interference; click-drag moves node
            draggable={false}
            onClick={(e) => {
              e.stopPropagation();
              const v = videoRef.current;
              if (!v) return;
              if (v.paused) {
                v.play();
              } else {
                v.pause();
              }
            }}
          />
          
          {/* Play overlay when paused */}
          {!videoUi.playing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`rounded-full p-4 ${dark ? 'bg-black/60' : 'bg-white/80'} backdrop-blur-sm shadow-lg`}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 5v14l11-7z" fill={dark ? '#ffffff' : '#111111'} />
                </svg>
              </div>
            </div>
          )}
          
          {/* Custom controls bar placed below the node with enhanced features */}
          <div
            className={`video-controls-bar absolute left-0 top-full mt-1 w-full select-none ${dark ? 'text-white' : 'text-black'}`}
            onMouseDown={(e)=>{ e.stopPropagation(); }}
            onClick={(e)=>{ e.stopPropagation(); }}
          >
            <div className={`mx-auto flex w-full items-center gap-2 rounded-md border px-2 py-1 ${dark ? 'bg-neutral-900 border-neutral-700' : 'bg-white/90 border-neutral-300 backdrop-blur'} shadow-lg`}>
              <button
                className={`rounded px-2 py-1 text-xs transition-colors ${dark ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-neutral-100 hover:bg-neutral-200'}`}
                onClick={(e)=>{ e.stopPropagation(); const v = videoRef.current; if (!v) return; if (v.paused) { v.play(); } else { v.pause(); } }}
                title={videoUi.playing ? 'Pause' : 'Play'}
              >{videoUi.playing ? '⏸️' : '▶️'}</button>
              
              {/* Time display */}
              <span className="text-xs tabular-nums">
                {Math.floor(videoUi.current / 60)}:{Math.floor(videoUi.current % 60).toString().padStart(2, '0')} / {Math.floor(videoUi.duration / 60)}:{Math.floor(videoUi.duration % 60).toString().padStart(2, '0')}
              </span>
              
              <input
                type="range"
                min={0}
                max={videoUi.duration || 0}
                step={0.1}
                value={Math.min(videoUi.current, videoUi.duration || 0)}
                onChange={(e)=>{
                  const v = videoRef.current; if (!v) return; const t = Number(e.target.value); v.currentTime = t; setVideoUi(s=>({ ...s, current: t }));
                }}
                onMouseDown={(e)=> e.stopPropagation()}
                className="flex-1 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #ff8a00 0%, #ff8a00 ${(videoUi.current / (videoUi.duration || 1)) * 100}%, #e5e7eb ${(videoUi.current / (videoUi.duration || 1)) * 100}%, #e5e7eb 100%)`
                }}
              />
              
              <button
                className={`rounded p-1.5 transition-colors ${dark ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-neutral-100 hover:bg-neutral-200'}`}
                onClick={(e)=>{ e.stopPropagation(); const v = videoRef.current; if (!v) return; const next = !v.muted; v.muted = next; setVideoUi(s=>({ ...s, muted: next })); }}
                title={videoUi.muted ? 'Unmute' : 'Mute'}
                aria-label={videoUi.muted ? 'Unmute' : 'Mute'}
              >
                {videoUi.muted ? (
                  // Muted icon (speaker with slash)
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 5L6 9H3v6h3l5 4V5z" stroke={dark ? '#ffffff' : '#111111'} strokeWidth="1.6" fill="none"/>
                    <path d="M16 9l5 6M21 9l-5 6" stroke={dark ? '#ffffff' : '#111111'} strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                ) : (
                  // Volume icon (speaker with waves)
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 5L6 9H3v6h3l5 4V5z" stroke={dark ? '#ffffff' : '#111111'} strokeWidth="1.6" fill="none"/>
                    <path d="M16 8c1.5 1.5 1.5 6 0 7" stroke={dark ? '#ffffff' : '#111111'} strokeWidth="1.6" strokeLinecap="round"/>
                    <path d="M19 6c3 3 3 9 0 12" stroke={dark ? '#ffffff' : '#111111'} strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : item.type==='image' ? (
        <div className="h-full w-full overflow-hidden relative">
          <img
            src={(typeof item.url==='string' && item.url.startsWith('http') && typeof window!=='undefined' && !item.url.startsWith(getLocationOrigin())) ? (`/api/social-twin/proxy?url=${encodeURIComponent(item.url)}`) : (item.url as string)}
            className="h-full w-full origin-center object-contain transition-transform duration-200 group-hover:scale-[1.02]"
            loading="lazy"
            alt="canvas"
            draggable={false}
            onLoad={(e)=>{
              const img = e.currentTarget as HTMLImageElement;
              const iw = img.naturalWidth || 0, ih = img.naturalHeight || 0;
              if (iw > 0 && ih > 0) {
                const aspect = iw / ih;
                const targetH = Math.max(80, Math.round(item.w / aspect));
                if (!item.aspect || Math.abs(item.h - targetH) > 1) {
                  onChange({ ...item, aspect, h: targetH });
                } else if (!item.aspect) {
                  onChange({ ...item, aspect });
                }
              }
            }}
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
