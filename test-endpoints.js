console.log('Testing Production API Endpoints');
console.log('='.repeat(50));

async function testProductionAPIs() {
    const baseUrl = 'https://the-social-twin.vercel.app';
    
    // Test different endpoint patterns
    const endpoints = [
        '/api/test',
        '/api/users/free-credits/status',
        '/api/generate-with-tracking',
        '/api/social-twin/generate',
        // Try alternative paths that might exist
        '/api/generate',
        '/api/users/credits',
        '/api/social-twin'
    ];
    
    for (const endpoint of endpoints) {
        console.log(`\nTesting ${endpoint}:`);
        try {
            const response = await fetch(`${baseUrl}${endpoint}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            console.log(`  Status: ${response.status}`);
            const text = await response.text();
            
            if (response.status === 404) {
                console.log('  ❌ Not Found');
            } else if (response.status === 405) {
                console.log('  ⚠️  Method Not Allowed (endpoint exists but wrong method)');
            } else if (response.status === 401) {
                console.log('  🔒 Unauthorized (endpoint exists, needs auth)');
            } else if (response.ok) {
                console.log('  ✅ Working');
                console.log(`  Response: ${text.substring(0, 200)}`);
            } else {
                console.log(`  ⚠️  Error ${response.status}`);
                console.log(`  Response: ${text.substring(0, 200)}`);
            }
        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
        }
    }
}

testProductionAPIs();
