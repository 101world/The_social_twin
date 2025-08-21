console.log('Testing Other API Routes');
console.log('='.repeat(30));

async function testOtherRoutes() {
    const baseUrl = 'https://the-social-twin.vercel.app/api';
    
    const routes = [
        '/users/free-credits/status',
        '/generate-with-tracking',
        '/social-twin/generate'
    ];
    
    for (const route of routes) {
        console.log(`\nTesting ${route}:`);
        try {
            const response = await fetch(`${baseUrl}${route}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`Status: ${response.status}`);
            console.log(`Content-Type: ${response.headers.get('content-type')}`);
            
            const text = await response.text();
            console.log(`Response (first 200 chars): ${text.substring(0, 200)}`);
            
            if (text.startsWith('<!DOCTYPE html>')) {
                console.log('⚠️  HTML response detected');
            } else if (response.status === 404) {
                console.log('⚠️  Route not found');
            } else {
                console.log('✅ Valid response');
            }
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }
}

testOtherRoutes();
