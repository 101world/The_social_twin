console.log('Starting debug...');

// Check if the modified pickRunpodUrlFromConfig function works
const { pickRunpodUrlFromConfig } = require('./lib/supabase.ts');

// Test the function
const testConfig = {
  image_url: 'https://zgzg6ujmo94qpj-3001.proxy.runpod.net/',
  text_url: null,
  video_url: null,
  image_modify_url: null
};

console.log('Testing URL resolution:');
console.log('Image mode:', pickRunpodUrlFromConfig({ mode: 'image', config: testConfig }));
console.log('Image-modify mode:', pickRunpodUrlFromConfig({ mode: 'image-modify', config: testConfig }));

// Test with no config
console.log('No config (should return undefined):', pickRunpodUrlFromConfig({ mode: 'image', config: null }));

console.log('Debug complete.');
