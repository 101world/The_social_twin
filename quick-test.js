console.log('Quick Production Test');

async function quickTest() {
    console.log('Testing the exact endpoint your app calls...');
    
    try {
        const response = await fetch('https://the-social-twin.vercel.app/api/generate-with-tracking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: "test image",
                mode: "image", 
                runpodUrl: "https://2qarn8rlra93cc-3001.proxy.runpod.net",
                provider: "runpod"
            })
        });
        
        console.log('Status:', response.status);
        console.log('Headers:', Object.fromEntries(response.headers.entries()));
        
        const text = await response.text();
        console.log('Response (first 1000 chars):', text.substring(0, 1000));
        
    } catch (error) {
        console.error('Error:', error);
    }
}

quickTest();
