const { pickRunpodUrlFromConfig } = require('./lib/supabase.ts');

console.log('🔧 Testing URL resolution after proxy disable...');

// Test different modes
const modes = ['image', 'image-modify', 'text', 'video'];

modes.forEach(mode => {
  const url = pickRunpodUrlFromConfig({ mode });
  console.log('   ' + mode + ': ' + (url || 'Not configured'));
});
