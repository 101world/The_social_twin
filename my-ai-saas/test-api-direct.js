console.log('Testing Social Twin Generate API Directly');
console.log('='.repeat(50));

// Test the API endpoint with minimal payload
async function testSocialTwinAPI() {
    const payload = {
        mode: 'image',
        prompt: 'Test image generation',
        runpodUrl: 'https://2qarn8rlra93cc-3001.proxy.runpod.net',
        userId: 'test-user' // For testing without auth
    };

    console.log('Testing payload:', JSON.stringify(payload, null, 2));
    
    try {
        // Test locally first if possible
        const localUrl = 'http://localhost:3000/api/social-twin/generate';
        
        console.log('\nTesting local API...');
        try {
            const localResponse = await fetch(localUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': 'test-user'
                },
                body: JSON.stringify(payload)
            });
            
            const localText = await localResponse.text();
            console.log('Local response status:', localResponse.status);
            console.log('Local response headers:', Object.fromEntries(localResponse.headers.entries()));
            console.log('Local response (first 500 chars):', localText.substring(0, 500));
            
            if (localText.startsWith('<!DOCTYPE html>')) {
                console.log('❌ Local API returning HTML - this is the issue!');
            } else {
                console.log('✅ Local API returning proper response');
            }
        } catch (localError) {
            console.log('Local test failed (expected if not running locally):', localError.message);
        }
        
        // Test production
        console.log('\nTesting production API...');
        const prodUrl = 'https://the-social-twin.vercel.app/api/social-twin/generate';
        
        const prodResponse = await fetch(prodUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': 'test-user'
            },
            body: JSON.stringify(payload)
        });
        
        const prodText = await prodResponse.text();
        console.log('Production response status:', prodResponse.status);
        console.log('Production response headers:', Object.fromEntries(prodResponse.headers.entries()));
        console.log('Production response (first 500 chars):', prodText.substring(0, 500));
        
        if (prodText.startsWith('<!DOCTYPE html>')) {
            console.log('❌ Production API returning HTML - checking for error details...');
            
            // Try to extract error from HTML
            const titleMatch = prodText.match(/<title>(.*?)<\/title>/);
            if (titleMatch) {
                console.log('HTML title:', titleMatch[1]);
            }
            
            // Look for error messages in HTML
            const errorMatch = prodText.match(/error[^<]*<[^>]*>([^<]+)/i);
            if (errorMatch) {
                console.log('Extracted error:', errorMatch[1]);
            }
        } else {
            console.log('✅ Production API returning proper response');
            try {
                const json = JSON.parse(prodText);
                console.log('Parsed JSON:', json);
            } catch {
                console.log('Response is not JSON but not HTML either');
            }
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testSocialTwinAPI();
