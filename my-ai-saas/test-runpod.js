// ===================================================================
// RUNPOD DEBUG TEST SCRIPT
// Test what your RunPod endpoint actually returns
// ===================================================================

// Test 1: Basic GET request to see what RunPod returns
fetch('https://2qarn8rlra93cc-3001.proxy.runpod.net')
  .then(response => response.text())
  .then(data => {
    console.log('=== RUNPOD GET RESPONSE ===');
    console.log('Response:', data.substring(0, 500)); // First 500 chars
    console.log('Is HTML?', data.includes('<!DOCTYPE'));
  })
  .catch(error => console.error('GET Error:', error));

// Test 2: POST to /prompt endpoint (what the API uses)
fetch('https://2qarn8rlra93cc-3001.proxy.runpod.net/prompt', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: { "test": "hello" }
  })
})
  .then(response => response.text())
  .then(data => {
    console.log('=== RUNPOD POST /prompt RESPONSE ===');
    console.log('Response:', data.substring(0, 500));
    console.log('Is HTML?', data.includes('<!DOCTYPE'));
  })
  .catch(error => console.error('POST Error:', error));

// Test 3: Check RunPod status
fetch('https://2qarn8rlra93cc-3001.proxy.runpod.net/health')
  .then(response => response.text())
  .then(data => {
    console.log('=== RUNPOD HEALTH CHECK ===');
    console.log('Response:', data);
  })
  .catch(error => console.error('Health Error:', error));
