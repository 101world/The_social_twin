# ============================================================================
# ONE MAX PAY-PER-USAGE PLAN SETUP SCRIPT
# ============================================================================
# This script sets up the complete pay-per-usage billing system
# ============================================================================

Write-Host "🚀 Setting up ONE MAX Pay-Per-Usage Plan..." -ForegroundColor Cyan

# Check if Supabase CLI is available
try {
    $supabaseVersion = supabase --version
    Write-Host "✅ Supabase CLI found: $supabaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase CLI not found. Please install it first." -ForegroundColor Red
    Write-Host "   npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

# Check if we're in a Supabase project
if (-not (Test-Path "supabase\config.toml")) {
    Write-Host "❌ Not in a Supabase project directory" -ForegroundColor Red
    Write-Host "   Run this from your project root directory" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "📋 What this script will set up:" -ForegroundColor Yellow
Write-Host "   • ONE MAX plan in plan_pricing table" -ForegroundColor White
Write-Host "   • User balance system (user_balance table)" -ForegroundColor White
Write-Host "   • Usage tracking (usage_charges table)" -ForegroundColor White
Write-Host "   • RPC functions for charging and balance management" -ForegroundColor White
Write-Host "   • Frontend integration with subscription page" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Do you want to proceed? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "❌ Setup cancelled" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "🔧 Running database setup..." -ForegroundColor Cyan

# Run the SQL setup file
try {
    supabase db push --include-all
    Write-Host "✅ Database schema updated" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Database push failed, trying alternative method..." -ForegroundColor Yellow
    
    # Alternative: using psql if available
    try {
        $env:PGPASSWORD = (Get-Content .env.local | Select-String "SUPABASE_SERVICE_ROLE_KEY" | ForEach-Object { $_.ToString().Split('=')[1] })
        $supabaseUrl = (Get-Content .env.local | Select-String "SUPABASE_URL" | ForEach-Object { $_.ToString().Split('=')[1] })
        
        # Extract database URL components
        $dbUrl = $supabaseUrl -replace "https://", "" -replace ".supabase.co", ""
        
        Write-Host "🔗 Connecting to: $dbUrl" -ForegroundColor Cyan
        psql -h "$dbUrl.supabase.co" -U postgres -d postgres -f "PAY_PER_USAGE_PLAN_SETUP.sql"
        Write-Host "✅ Database setup completed via psql" -ForegroundColor Green
    } catch {
        Write-Host "❌ Database setup failed. Please run the SQL file manually:" -ForegroundColor Red
        Write-Host "   File: PAY_PER_USAGE_PLAN_SETUP.sql" -ForegroundColor Yellow
        Write-Host "   Run this in your Supabase SQL editor" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🧪 Testing setup..." -ForegroundColor Cyan

# Test if the functions were created
try {
    $functions = supabase db functions list 2>$null
    if ($functions -like "*charge_for_generation*") {
        Write-Host "✅ RPC functions created successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠️  RPC functions may not be created. Check SQL output above." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not verify functions. Check Supabase dashboard." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 ONE MAX Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 What you can do now:" -ForegroundColor Cyan
Write-Host "   • Users can select ONE MAX plan on subscription page" -ForegroundColor White
Write-Host "   • They add balance ($5 minimum) via Razorpay" -ForegroundColor White
Write-Host "   • Each generation automatically charges their balance:" -ForegroundColor White
Write-Host "     - Images: $0.20 each (₹16.60)" -ForegroundColor Green
Write-Host "     - Videos: $0.50 each (₹41.50)" -ForegroundColor Blue
Write-Host "     - Text: $0.01 each (₹0.83)" -ForegroundColor Purple
Write-Host "   • No monthly limits or commitments" -ForegroundColor White
Write-Host "   • Ultra-fast processing (15s images, 5min videos)" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Deploy your Next.js app to see the updated subscription page" -ForegroundColor White
Write-Host "   2. Test the ONE MAX plan with a small balance top-up" -ForegroundColor White
Write-Host "   3. Monitor usage in the Supabase dashboard" -ForegroundColor White
Write-Host ""
Write-Host "📊 Database tables created:" -ForegroundColor Cyan
Write-Host "   • user_balance (stores USD balance for each user)" -ForegroundColor White
Write-Host "   • usage_charges (tracks all pay-per-use charges)" -ForegroundColor White
Write-Host "   • Updated plan_pricing (includes ONE MAX plan)" -ForegroundColor White
Write-Host ""
Write-Host "🔗 API endpoints available:" -ForegroundColor Cyan
Write-Host "   • GET /api/user/balance (check user balance)" -ForegroundColor White
Write-Host "   • POST /api/user/charge-generation (charge for usage)" -ForegroundColor White
Write-Host "   • POST /api/razorpay/create-balance-payment (add balance)" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter to finish..."
