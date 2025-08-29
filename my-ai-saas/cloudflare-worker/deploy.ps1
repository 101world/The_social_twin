# Deploy RunPod Proxy to Cloudflare Workers (Windows PowerShell)

Write-Host "🚀 Deploying RunPod Proxy to Cloudflare Workers..." -ForegroundColor Green

# Check if wrangler is installed
$wranglerExists = Get-Command wrangler -ErrorAction SilentlyContinue
if (-not $wranglerExists) {
    Write-Host "Installing Wrangler CLI..." -ForegroundColor Yellow
    npm install -g wrangler
}

# Navigate to worker directory
Set-Location cloudflare-worker

# Check Cloudflare authentication
Write-Host "Checking Cloudflare authentication..." -ForegroundColor Cyan
try {
    wrangler whoami
} catch {
    Write-Host "Logging in to Cloudflare..." -ForegroundColor Yellow
    wrangler login
}

# Deploy the worker
Write-Host "Deploying worker..." -ForegroundColor Cyan
wrangler deploy

Write-Host "✅ RunPod Proxy deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Yellow
Write-Host "1. Update your domain DNS to point to Cloudflare"
Write-Host "2. Add your custom domain in Cloudflare Workers dashboard"
Write-Host "3. Update NEXT_PUBLIC_CLOUDFLARE_RUNPOD_PROXY in your environment variables"
Write-Host "4. Set your RunPod URLs in the Cloudflare Worker environment variables"
Write-Host ""
Write-Host "🌐 Your proxy will be available at: https://runpod-proxy.your-subdomain.workers.dev" -ForegroundColor Cyan
