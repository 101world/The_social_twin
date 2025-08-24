// Quick test to verify LoRA discovery from RunPod storage
// Usage: node test-lora-discovery.js [runpod-url]

const EXAMPLE_RUNPOD_URL = 'https://your-runpod-id-jupyter.pods.runpod.net';

async function testLoraDiscovery(runpodUrl) {
  const base = runpodUrl.replace(/\/$/, '');
  const path = 'workspace/ComfyUI/models/loras';
  const url = `${base}/api/contents/${encodeURIComponent(path)}?content=1`;
  
  console.log(`Testing LoRA discovery from: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`Response status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`Failed to fetch: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    console.log('Response structure:', {
      type: data.type,
      name: data.name,
      path: data.path,
      contentLength: Array.isArray(data.content) ? data.content.length : 'not array'
    });
    
    if (data.type === 'directory' && Array.isArray(data.content)) {
      const loraFiles = data.content.filter(item => 
        item.type === 'file' && 
        /\.(safetensors|pt|ckpt)$/i.test(item.name || '')
      );
      
      console.log(`Found ${loraFiles.length} LoRA files:`);
      loraFiles.forEach(file => {
        console.log(`  - ${file.name} (${file.size} bytes)`);
      });
      
      // Test classification
      loraFiles.forEach(file => {
        const name = file.name.toLowerCase();
        let type = 'other';
        if (/(character|char_|_char|person|face|actor|model|maahi|girl|boy)/.test(name)) type = 'character';
        else if (/(style|anime|toon|illustration|comic|manga|realistic|photoreal|cinematic|oil|sketch)/.test(name)) type = 'style';
        else if (/(concept|env|environment|city|cyberpunk|scifi|fantasy|mecha|vehicle|background)/.test(name)) type = 'concept';
        
        console.log(`    Type: ${type}`);
      });
      
    } else {
      console.log('Not a directory or no content array');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Get RunPod URL from command line or use example
const runpodUrl = process.argv[2] || EXAMPLE_RUNPOD_URL;

if (runpodUrl === EXAMPLE_RUNPOD_URL) {
  console.log('Usage: node test-lora-discovery.js YOUR_RUNPOD_URL');
  console.log('Example: node test-lora-discovery.js https://abc123-jupyter.pods.runpod.net');
  console.log('\nUsing example URL for demonstration...\n');
}

testLoraDiscovery(runpodUrl);
