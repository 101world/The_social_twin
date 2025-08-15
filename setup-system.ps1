# 101 World AI Chat + Credit System Setup Script
# Run this script to set up your development environment

Write-Host "🚀 101 World AI Chat + Credit System Setup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory or if my-ai-saas exists
if (-not (Test-Path "package.json")) {
    if (Test-Path "my-ai-saas/package.json") {
        Write-Host "📁 Found my-ai-saas directory. Changing to project directory..." -ForegroundColor Yellow
        Set-Location "my-ai-saas"
        Write-Host "✅ Changed to project directory" -ForegroundColor Green
    } else {
        Write-Host "❌ Error: Please run this script from the 101World directory (where my-ai-saas folder is located)" -ForegroundColor Red
        Write-Host "   Current directory: $(Get-Location)" -ForegroundColor Yellow
        Write-Host "   Expected: C:\Users\welco\101World" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "✅ Project directory confirmed: $(Get-Location)" -ForegroundColor Green

# Check Node.js version
Write-Host "🔍 Checking Node.js version..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
    
    # Extract version number and check if it's 18+
    $versionNumber = $nodeVersion -replace 'v', ''
    $majorVersion = [int]($versionNumber -split '\.')[0]
    
    if ($majorVersion -lt 18) {
        Write-Host "⚠️  Warning: Node.js 18+ is recommended. Current version: $nodeVersion" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error: Node.js not found. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

# Check npm
Write-Host "🔍 Checking npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "✅ npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: npm not found. Please install npm first." -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
try {
    npm install
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Error installing dependencies. Please check your internet connection and try again." -ForegroundColor Red
    exit 1
}

# Check for .env.local
Write-Host "🔍 Checking environment configuration..." -ForegroundColor Yellow
if (-not (Test-Path ".env.local")) {
    Write-Host "⚠️  .env.local file not found. Creating template..." -ForegroundColor Yellow
    
    $envTemplate = @"
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_secret_here
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Stripe Payments (for future implementation)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
"@
    
    $envTemplate | Out-File -FilePath ".env.local" -Encoding UTF8
    Write-Host "✅ .env.local template created" -ForegroundColor Green
    Write-Host "⚠️  Please update .env.local with your actual API keys before running the app" -ForegroundColor Yellow
} else {
    Write-Host "✅ .env.local file found" -ForegroundColor Green
}

# Check for database schema
Write-Host "🔍 Checking database schema..." -ForegroundColor Yellow
if (Test-Path "supabase_schema_complete.sql") {
    Write-Host "✅ Database schema file found" -ForegroundColor Green
} else {
    Write-Host "❌ Database schema file not found. Please ensure supabase_schema_complete.sql exists." -ForegroundColor Red
}

# Check for API routes
Write-Host "🔍 Checking API routes..." -ForegroundColor Yellow
$apiRoutes = @(
    "app/api/topics/route.ts",
    "app/api/topics/[topicId]/route.ts",
    "app/api/topics/[topicId]/messages/route.ts",
    "app/api/topics/[topicId]/media/route.ts",
    "app/api/users/credits/route.ts"
)

$missingRoutes = @()
foreach ($route in $apiRoutes) {
    if (Test-Path $route) {
        Write-Host "✅ $route" -ForegroundColor Green
    } else {
        Write-Host "❌ $route" -ForegroundColor Red
        $missingRoutes += $route
    }
}

# Check for components
Write-Host "🔍 Checking components..." -ForegroundColor Yellow
$components = @(
    "components/ChatTopicSelector.tsx",
    "components/ChatMessage.tsx",
    "components/CreditDisplay.tsx"
)

foreach ($component in $components) {
    if (Test-Path $component) {
        Write-Host "✅ $component" -ForegroundColor Green
    } else {
        Write-Host "❌ $component" -ForegroundColor Red
        $missingRoutes += $component
    }
}

# Summary
Write-Host ""
Write-Host "📋 Setup Summary" -ForegroundColor Cyan
Write-Host "================" -ForegroundColor Cyan

if ($missingRoutes.Count -eq 0) {
    Write-Host "✅ All required files are present" -ForegroundColor Green
} else {
    Write-Host "⚠️  Missing files detected:" -ForegroundColor Yellow
    foreach ($route in $missingRoutes) {
        Write-Host "   - $route" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Update .env.local with your actual API keys" -ForegroundColor White
Write-Host "2. Run the database schema in your Supabase project" -ForegroundColor White
Write-Host "3. Start the development server with: npm run dev" -ForegroundColor White
Write-Host "4. Open http://localhost:3000 in your browser" -ForegroundColor White

Write-Host ""
Write-Host "📚 For detailed setup instructions, see README_COMPLETE.md" -ForegroundColor Cyan

# Check if user wants to start the dev server
Write-Host ""
$startServer = Read-Host "Would you like to start the development server now? (y/n)"

if ($startServer -eq "y" -or $startServer -eq "Y") {
    Write-Host "🚀 Starting development server..." -ForegroundColor Green
    Write-Host "📱 The app will be available at http://localhost:3000" -ForegroundColor Cyan
    Write-Host "🛑 Press Ctrl+C to stop the server" -ForegroundColor Yellow
    Write-Host ""
    
    try {
        npm run dev
    } catch {
        Write-Host "❌ Error starting development server. Please check the console output above." -ForegroundColor Red
    }
} else {
    Write-Host "👋 Setup complete! Run 'npm run dev' when you're ready to start." -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 Setup complete! Happy coding!" -ForegroundColor Green
