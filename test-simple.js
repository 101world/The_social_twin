console.log('Testing Simple Route');

async function testSimpleRoute() {
    try {
        const response = await fetch('https://the-social-twin.vercel.app/api/test');
        console.log('Status:', response.status);
        console.log('Headers:', Object.fromEntries(response.headers.entries()));
        const text = await response.text();
        console.log('Response:', text);
        
        if (response.ok) {
            console.log('✅ Simple route working');
        } else {
            console.log('❌ Simple route failed');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testSimpleRoute();
