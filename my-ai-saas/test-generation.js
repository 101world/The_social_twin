async function testGeneration() {
  try {
    console.log('🧪 Testing generation API...');

    const response = await fetch('http://localhost:3000/api/generate-with-tracking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'A beautiful sunset over mountains',
        userId: 'test-user-123',
        type: 'image'
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Generation request successful!');
      console.log('📄 Response:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Generation request failed:', response.status);
      console.log('📄 Error:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

testGeneration();
