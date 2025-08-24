import { NextRequest, NextResponse } from 'next/server';
import { pickRunpodUrlFromConfig, getRunpodConfig } from '@/lib/supabase';

interface LoRAInfo {
  name: string;
  filename: string;
  type: 'character' | 'style' | 'concept' | 'other';
  thumbnail?: string;
  description?: string;
  tags?: string[];
  strength_recommended?: number;
}

// Mock data for now - will be replaced with real RunPod scanning
const MOCK_LORAS: LoRAInfo[] = [
  {
    name: 'Maahi Character',
    filename: 'maahi_character_lora.safetensors',
    type: 'character',
    thumbnail: '/api/runpod/lora-thumbnail?file=maahi_character_lora.safetensors',
    description: 'Indian boy character with brown jacket and jeans',
    tags: ['character', 'male', 'indian', 'young'],
    strength_recommended: 0.8
  },
  {
    name: 'Anime Style',
    filename: 'anime_style_v2.safetensors',
    type: 'style',
    thumbnail: '/api/runpod/lora-thumbnail?file=anime_style_v2.safetensors',
    description: 'High quality anime art style',
    tags: ['anime', 'illustration', 'colorful'],
    strength_recommended: 0.6
  },
  {
    name: 'Realistic Portrait',
    filename: 'realistic_portrait_xl.safetensors',
    type: 'style',
    thumbnail: '/api/runpod/lora-thumbnail?file=realistic_portrait_xl.safetensors',
    description: 'Photorealistic portrait enhancement',
    tags: ['realistic', 'portrait', 'photography'],
    strength_recommended: 0.7
  },
  {
    name: 'Cyberpunk City',
    filename: 'cyberpunk_environment.safetensors',
    type: 'concept',
    thumbnail: '/api/runpod/lora-thumbnail?file=cyberpunk_environment.safetensors',
    description: 'Futuristic cyberpunk cityscapes',
    tags: ['cyberpunk', 'futuristic', 'neon', 'city'],
    strength_recommended: 0.9
  }
];

async function discoverLoRAsFromRunPod(runpodUrl: string): Promise<LoRAInfo[]> {
  try {
    // Try to scan the actual LoRA directory
    const response = await fetch(`${runpodUrl}/api/loras`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      return data.loras || MOCK_LORAS;
    }
  } catch (error) {
    console.log('RunPod LoRA discovery failed, using mock data:', error);
  }

  // Fallback to mock data
  return MOCK_LORAS;
}

export async function GET(req: NextRequest) {
  try {
    // Get RunPod URL from config
    const cfg = await getRunpodConfig().catch(() => null);
    const runpodUrl = pickRunpodUrlFromConfig({ 
      mode: 'image', 
      config: cfg 
    });

    if (!runpodUrl) {
      return NextResponse.json({ 
        error: 'No RunPod URL configured' 
      }, { status: 500 });
    }

    // Discover available LoRAs
    const loras = await discoverLoRAsFromRunPod(runpodUrl);

    // Group by type for better organization
    const groupedLoras = {
      character: loras.filter(l => l.type === 'character'),
      style: loras.filter(l => l.type === 'style'),
      concept: loras.filter(l => l.type === 'concept'),
      other: loras.filter(l => l.type === 'other')
    };

    return NextResponse.json({
      success: true,
      loras: groupedLoras,
      total: loras.length,
      runpod_url: runpodUrl
    });

  } catch (error: any) {
    console.error('LoRA discovery error:', error);
    return NextResponse.json({ 
      error: 'Failed to discover LoRAs',
      details: error.message 
    }, { status: 500 });
  }
}
