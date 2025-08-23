# 101World News Platform - GitHub Secrets Setup Script
# Run this to complete the automated news system setup

Write-Host "🌟 101World News Platform - GitHub Secrets Setup" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# GitHub repository details
$repoOwner = "101world"
$repoName = "The_social_twin"
$repoUrl = "https://github.com/$repoOwner/$repoName"

# Supabase configuration
$supabaseUrl = "https://tnlftxudmiryrgkajfun.supabase.co"
$serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubGZ0eHVkbWlyeXJna2FqZnVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDk5NDE4MSwiZXhwIjoyMDcwNTcwMTgxfQ.80sKPr0NTPuGCwKhm3VZisadRdU1aQLkHFgfokyQcIk"

Write-Host "✅ CONFIGURATION READY:" -ForegroundColor Green
Write-Host "   Repository: $repoUrl"
Write-Host "   Supabase URL: $supabaseUrl"
Write-Host "   Service Role Key: [CONFIGURED ✓]"
Write-Host ""

Write-Host "📋 SETUP INSTRUCTIONS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Open GitHub Repository Secrets:" -ForegroundColor White
Write-Host "   👉 $repoUrl/settings/secrets/actions" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Click 'New repository secret' and add:" -ForegroundColor White
Write-Host ""
Write-Host "   Secret #1:" -ForegroundColor Yellow
Write-Host "   Name: NEXT_PUBLIC_SUPABASE_URL" -ForegroundColor Gray
Write-Host "   Value: $supabaseUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "   Secret #2:" -ForegroundColor Yellow
Write-Host "   Name: SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Gray
Write-Host "   Value: $serviceRoleKey" -ForegroundColor Gray
Write-Host ""

Write-Host "🚀 WHAT HAPPENS AFTER SETUP:" -ForegroundColor Cyan
Write-Host "   ✨ Auto-updates every 10 minutes with fresh news"
Write-Host "   📰 Newest articles always appear first"
Write-Host "   🔍 Search results cached for all users"
Write-Host "   🌤️  Weather widget in header"
Write-Host "   🌟 3D starfield background theme"
Write-Host "   🚫 Zero manual intervention needed"
Write-Host ""

Write-Host "🔍 TESTING YOUR SETUP:" -ForegroundColor Magenta
Write-Host "   1. Go to GitHub Actions tab:"
Write-Host "      👉 $repoUrl/actions"
Write-Host "   2. Find 'Fresh News Sync Every 10 Minutes'"
Write-Host "   3. Click 'Run workflow' to test manually"
Write-Host "   4. Check your live Vercel site for fresh content"
Write-Host ""

Write-Host "🎯 LOCAL TESTING:" -ForegroundColor Blue
$testChoice = Read-Host "Would you like to test the news scraper locally now? (y/n)"

if ($testChoice -eq "y" -or $testChoice -eq "Y") {
    Write-Host ""
    Write-Host "🔬 Running local test..." -ForegroundColor Yellow
    
    # Set environment variables
    $env:NEXT_PUBLIC_SUPABASE_URL = $supabaseUrl
    $env:SUPABASE_SERVICE_ROLE_KEY = $serviceRoleKey
    
    # Test the connection
    Set-Location "my-ai-saas/scripts"
    node test-connection.js
    
    Write-Host ""
    Write-Host "✅ Local test complete!" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 Your 101World news platform is ready to go live!" -ForegroundColor Green
Write-Host "📱 Add the GitHub secrets above and enjoy automated news updates!" -ForegroundColor Cyan
