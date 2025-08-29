// Cloudflare Worker to proxy RunPod requests with stable URL
// This ensures mobile and web work seamlessly with consistent endpoints

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Extract the mode from path: /image, /video, /text, etc.
    const pathParts = url.pathname.split('/').filter(Boolean);
    const mode = pathParts[0] || 'image'; // default to image
    
    // Get the current RunPod URL from environment variables or KV storage
    const runpodUrls = {
      image: env.RUNPOD_IMAGE_URL || env.DEFAULT_IMAGE_URL,
      'image-modify': env.RUNPOD_IMAGE_MODIFY_URL || env.RUNPOD_IMAGE_URL || env.DEFAULT_IMAGE_URL,
      video: env.RUNPOD_VIDEO_URL || env.DEFAULT_VIDEO_URL,
      text: env.RUNPOD_TEXT_URL || env.DEFAULT_TEXT_URL,
    };
    
    const targetUrl = runpodUrls[mode];
    
    if (!targetUrl) {
      return new Response(JSON.stringify({ 
        error: `No RunPod URL configured for mode: ${mode}` 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Build the target URL - remove the mode from path and forward the rest
    const remainingPath = pathParts.slice(1).join('/');
    const targetFullUrl = targetUrl.replace(/\/$/, '') + '/' + remainingPath + url.search;
    
    // Forward the request to RunPod
    try {
      const modifiedRequest = new Request(targetFullUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      
      const response = await fetch(modifiedRequest);
      
      // Add CORS headers for browser compatibility
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Mobile-Request',
        },
      });
      
      return newResponse;
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Failed to proxy to RunPod',
        details: error.message,
        target: targetFullUrl
      }), {
        status: 502,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};
