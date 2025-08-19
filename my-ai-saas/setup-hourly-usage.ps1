# ====================================
# HOURLY USAGE SETUP SCRIPT
# Run this to set up the hourly billing system
# ====================================

Write-Host "🚀 Setting up Hourly Usage System..." -ForegroundColor Cyan
Write-Host ""

# Check if we're in the correct directory
if (!(Test-Path "HOURLY_USAGE_SETUP.sql")) {
    Write-Host "❌ Error: HOURLY_USAGE_SETUP.sql not found!" -ForegroundColor Red
    Write-Host "Please run this script from: c:\Users\welco\101World\my-ai-saas\" -ForegroundColor Yellow
    exit 1
}

Write-Host "📍 SQL Setup File Location:" -ForegroundColor Green
Write-Host "   c:\Users\welco\101World\my-ai-saas\HOURLY_USAGE_SETUP.sql" -ForegroundColor White
Write-Host ""

Write-Host "🔧 What this sets up:" -ForegroundColor Yellow
Write-Host "   ✅ hourly_usage_sessions table" -ForegroundColor Green
Write-Host "   ✅ hourly_account_balance table" -ForegroundColor Green
Write-Host "   ✅ hourly_topup_transactions table" -ForegroundColor Green
Write-Host "   ✅ RPC functions for session management" -ForegroundColor Green
Write-Host "   ✅ New plan pricing entries" -ForegroundColor Green
Write-Host "   ✅ Permissions and indexes" -ForegroundColor Green
Write-Host ""

Write-Host "📋 Setup Instructions:" -ForegroundColor Cyan
Write-Host "1. Open your Supabase dashboard" -ForegroundColor White
Write-Host "2. Go to SQL Editor" -ForegroundColor White
Write-Host "3. Copy and paste the content from:" -ForegroundColor White
Write-Host "   HOURLY_USAGE_SETUP.sql" -ForegroundColor Yellow
Write-Host "4. Run the SQL script" -ForegroundColor White
Write-Host ""

Write-Host "🌐 Updated Webhook:" -ForegroundColor Cyan
Write-Host "   ✅ Existing webhook at /api/webhooks/razorpay" -ForegroundColor Green
Write-Host "   ✅ Now handles both monthly subscriptions AND hourly top-ups" -ForegroundColor Green
Write-Host "   ❌ No need for separate webhook!" -ForegroundColor Red
Write-Host ""

Write-Host "🎯 New Features:" -ForegroundColor Cyan
Write-Host "   💰 Pay-per-hour billing ($15/hour)" -ForegroundColor Green
Write-Host "   🔄 Pause/Resume sessions" -ForegroundColor Green
Write-Host "   💳 Balance top-ups ($100, $200, $500)" -ForegroundColor Green
Write-Host "   ⚡ Unlimited AI generations during sessions" -ForegroundColor Green
Write-Host "   📊 Session tracking and analytics" -ForegroundColor Green
Write-Host ""

Write-Host "📱 Access Dashboard:" -ForegroundColor Cyan
Write-Host "   URL: http://localhost:3000/hourly-usage" -ForegroundColor Yellow
Write-Host ""

Write-Host "🔗 Current Razorpay Webhook URL:" -ForegroundColor Cyan
Write-Host "   https://your-domain.com/api/webhooks/razorpay" -ForegroundColor Yellow
Write-Host "   (No changes needed - same webhook handles everything!)" -ForegroundColor Green
Write-Host ""

$continue = Read-Host "Would you like to open the SQL file? (y/n)"
if ($continue -eq "y" -or $continue -eq "Y") {
    Write-Host "📂 Opening SQL file..." -ForegroundColor Green
    Start-Process notepad.exe "HOURLY_USAGE_SETUP.sql"
}

Write-Host ""
Write-Host "✨ Setup ready! Run the SQL script in Supabase to complete setup." -ForegroundColor Green
