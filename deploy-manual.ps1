# Manual Vercel Deploy Script
# Use this when GitHub auto-deploy isn't working

Write-Host "🚀 Manual Vercel Deploy for my-ai-saas" -ForegroundColor Green
Write-Host ""

# Check if we're in the right directory
if (!(Test-Path "my-ai-saas\package.json")) {
    Write-Host "❌ Error: Run this from the repo root (where my-ai-saas folder exists)" -ForegroundColor Red
    exit 1
}

# Navigate to my-ai-saas
Set-Location "my-ai-saas"

Write-Host "📦 Installing Vercel CLI..." -ForegroundColor Yellow
npm install -g vercel@latest

Write-Host "🔧 Building project..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed! Check errors above." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build successful!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 To deploy to Vercel:" -ForegroundColor Cyan
Write-Host "1. Run: vercel --prod"
Write-Host "2. Follow the prompts to link your project"
Write-Host "3. Or check Vercel Dashboard → Settings → Git to fix auto-deploy"
Write-Host ""
Write-Host "📍 Your app should be at: https://[your-project-name].vercel.app" -ForegroundColor Green
