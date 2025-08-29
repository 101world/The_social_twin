# Cloudflare Workers AI Setup for Windows PowerShell

Write-Host "🚀 Setting up Cloudflare Workers AI for 101World..." -ForegroundColor Green

# 1. Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

# 2. Login to Cloudflare (if not already logged in)
Write-Host "🔐 Checking Cloudflare authentication..." -ForegroundColor Yellow
try {
    wrangler whoami | Out-Null
    Write-Host "✅ Already logged in to Cloudflare" -ForegroundColor Green
} catch {
    Write-Host "Please login to Cloudflare:" -ForegroundColor Yellow
    wrangler login
}

# 3. Create R2 bucket for document storage
Write-Host "🗄️ Creating R2 bucket..." -ForegroundColor Yellow
wrangler r2 bucket create 101world-documents --compatibility-date 2024-08-26

# 4. Create KV namespace for caching
Write-Host "🔑 Creating KV namespace..." -ForegroundColor Yellow
$kvOutput = wrangler kv:namespace create "CACHE" --preview false
$kvId = ($kvOutput | Select-String 'id.*"([^"]*)"').Matches[0].Groups[1].Value

$kvPreviewOutput = wrangler kv:namespace create "CACHE" --preview
$kvPreviewId = ($kvPreviewOutput | Select-String 'id.*"([^"]*)"').Matches[0].Groups[1].Value

Write-Host "✅ KV Namespace created:" -ForegroundColor Green
Write-Host "   Production ID: $kvId" -ForegroundColor Gray
Write-Host "   Preview ID: $kvPreviewId" -ForegroundColor Gray

# 5. Create Vectorize index for embeddings
Write-Host "🔍 Creating Vectorize index..." -ForegroundColor Yellow
wrangler vectorize create 101world-embeddings --dimensions=768 --metric=cosine

# 6. Update wrangler.toml with actual IDs
Write-Host "⚙️ Updating configuration..." -ForegroundColor Yellow
$wranglerContent = Get-Content "wrangler.toml" -Raw
$wranglerContent = $wranglerContent -replace "your-kv-namespace-id", $kvId
$wranglerContent = $wranglerContent -replace "your-preview-kv-id", $kvPreviewId
$wranglerContent | Set-Content "wrangler.toml"

# 7. Set up secrets reminder
Write-Host "🔒 Secrets Setup Required:" -ForegroundColor Yellow
Write-Host "   Run these commands to set your secrets:" -ForegroundColor Gray
Write-Host "   wrangler secret put OPENAI_API_KEY" -ForegroundColor Gray
Write-Host "   wrangler secret put CLERK_SECRET_KEY" -ForegroundColor Gray

# 8. Deploy the worker
Write-Host "🚀 Deploying worker..." -ForegroundColor Yellow
wrangler deploy

Write-Host ""
Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Your AI API is now available at:" -ForegroundColor Yellow
Write-Host "   https://101world-ai-api.your-subdomain.workers.dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Set your secrets with the wrangler commands above" -ForegroundColor Gray
Write-Host "2. Update your frontend to use the new endpoint" -ForegroundColor Gray
Write-Host "3. Test with: curl https://your-worker.workers.dev/health" -ForegroundColor Gray
