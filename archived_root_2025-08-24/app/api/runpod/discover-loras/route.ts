import { NextResponse } from 'next/server';

// Minimal LoRA discovery endpoint for the root app.
// In production, replace with a real scan against your RunPod ComfyUI endpoint.
export async function GET() {
  const loras = [
    { name: 'Maahi Character', filename: 'maahi_character_lora.safetensors', type: 'character' },
    { name: 'Anime Style v2', filename: 'anime_style_v2.safetensors', type: 'style' },
    { name: 'Realistic Portrait XL', filename: 'realistic_portrait_xl.safetensors', type: 'style' },
    { name: 'Cyberpunk Environment', filename: 'cyberpunk_environment.safetensors', type: 'style' },
  ];
  return NextResponse.json({ ok: true, loras });
}
