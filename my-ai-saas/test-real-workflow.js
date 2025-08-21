// ===================================================================
// TEST RUNPOD WITH ACTUAL WORKFLOW
// Send the real workflow to see if it works
// ===================================================================

const fs = require('fs');
const path = require('path');

async function testRunPodWithRealWorkflow() {
  try {
    // Load the actual workflow
    const workflowPath = path.join(__dirname, 'Workflows', 'Socialtwin-Image.json');
    const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
    
    // Inject a test prompt
    workflow['6'].inputs.text = "A simple test image of a cat";
    
    console.log('=== TESTING RUNPOD WITH REAL WORKFLOW ===');
    
    const response = await fetch('https://2qarn8rlra93cc-3001.proxy.runpod.net/prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: workflow })
    });
    
    const responseText = await response.text();
    
    console.log('Status:', response.status);
    console.log('Response length:', responseText.length);
    console.log('Is HTML?', responseText.includes('<!DOCTYPE'));
    console.log('First 500 chars:', responseText.substring(0, 500));
    
    if (responseText.includes('<!DOCTYPE')) {
      console.log('\n❌ RUNPOD RETURNED HTML - Pod might be down or misconfigured');
    } else {
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log('\n✅ RUNPOD RETURNED JSON:', jsonResponse);
        
        if (jsonResponse.error) {
          console.log('\n⚠️ ComfyUI Error Details:');
          console.log('Type:', jsonResponse.error.type);
          console.log('Message:', jsonResponse.error.message);
          console.log('Details:', jsonResponse.error.details);
          console.log('Extra Info:', jsonResponse.error.extra_info);
        }
      } catch {
        console.log('\n⚠️ Response is not JSON but also not HTML');
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testRunPodWithRealWorkflow();
