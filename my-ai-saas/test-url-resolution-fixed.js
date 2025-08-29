require('dotenv').config({ path: '.env.local' });

function pickRunpodUrlFromConfig(opts) {
  const { provided, mode = 'image', config, useCloudflareProxy = true } = opts || {};

  // PRIORITY 1: Cloudflare Proxy (Stable URL for mobile/web compatibility)
  if (useCloudflareProxy) {
    const cloudflareProxyUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_RUNPOD_PROXY;
    if (cloudflareProxyUrl && typeof cloudflareProxyUrl === 'string' && cloudflareProxyUrl.trim()) {
      // Return proxy URL with mode path: https://runpod.yourdomain.com/image
      return cloudflareProxyUrl.replace(/\/$/, '') + '/' + mode;
    }
  }

  // PRIORITY 2: User-provided URL (e.g., from localStorage)
  if (provided && typeof provided === 'string' && provided.trim()) return provided;

  // PRIORITY 3: Admin config from database
  if (config) {
    const cfgByMode = {
      text: config.text_url,
      image: config.image_url,
      'image-modify': config.image_modify_url || config.image_url,
      video: config.video_url,
    };

    const adminUrl = cfgByMode[mode];
    if (adminUrl && typeof adminUrl === 'string' && adminUrl.trim()) {
      return adminUrl;
    }
  }

  // PRIORITY 4: Environment variables (fallback)
  const envByMode = {
    text: process.env.NEXT_PUBLIC_RUNPOD_TEXT_URL,
    image: process.env.NEXT_PUBLIC_RUNPOD_IMAGE_URL,
    'image-modify': process.env.NEXT_PUBLIC_RUNPOD_IMAGE_MODIFY_URL || process.env.NEXT_PUBLIC_RUNPOD_IMAGE_URL,
    video: process.env.NEXT_PUBLIC_RUNPOD_VIDEO_URL,
  };

  return envByMode[mode];
}

console.log('🔧 Testing URL resolution after proxy disable...');

// Test different modes
const modes = ['image', 'image-modify', 'text', 'video'];

modes.forEach(mode => {
  const url = pickRunpodUrlFromConfig({ mode });
  console.log('   ' + mode + ': ' + (url || 'Not configured'));
});
