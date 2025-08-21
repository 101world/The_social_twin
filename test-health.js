console.log('Testing Health Check');

async function testHealth() {
    try {
        const response = await fetch('https://the-social-twin.vercel.app/api/health');
        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Response:', text);
        
        if (response.ok) {
            console.log('✅ Health check working! The deployment is functional.');
        } else {
            console.log('❌ Health check failed');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testHealth();
