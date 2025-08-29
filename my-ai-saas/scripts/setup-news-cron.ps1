# News scraper setup script for production
# This script should be run in production environment where Supabase keys work

Write-Host "🚀 Setting up news scraper for production..." -ForegroundColor Green

# Check if we're in the correct directory
if (!(Test-Path "scripts/fresh-news-scraper.js")) {
    Write-Host "❌ Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

Write-Host "✅ News scraper is ready to run" -ForegroundColor Green
Write-Host "📝 To run manually: node scripts/fresh-news-scraper.js" -ForegroundColor Yellow
Write-Host "⏰ For automated scraping, set up a cron job or GitHub Action" -ForegroundColor Yellow

# Create a simple test script
@"
// Test news scraper connection
console.log('🔧 Testing news scraper...');
console.log('Environment check:');
console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('SERVICE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
console.log('');
console.log('To run full scraper: node scripts/fresh-news-scraper.js');
"@ | Out-File -FilePath "scripts/test-news-setup.js" -Encoding UTF8

Write-Host "📋 Created test script: scripts/test-news-setup.js" -ForegroundColor Cyan
Write-Host "🎉 News scraper setup complete!" -ForegroundColor Green
