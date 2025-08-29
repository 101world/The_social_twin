# PowerShell deployment script for Windows

Write-Host "🚀 Deploying Cloudflare Workers AI for Social Twin Chat" -ForegroundColor Green

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

# Generate types
Write-Host "🔧 Generating types..." -ForegroundColor Yellow
npx wrangler types

# Deploy to production
Write-Host "🌟 Deploying to production..." -ForegroundColor Yellow
npx wrangler deploy --env production

# Test deployment
Write-Host "🧪 Testing deployment..." -ForegroundColor Yellow

# Get worker URL (you'll need to replace this with your actual worker URL)
$WORKER_URL = "https://social-twin-chat-ai.your-account.workers.dev"

Write-Host "Testing health endpoint..." -ForegroundColor Cyan
try {
    $healthResponse = Invoke-RestMethod -Uri "$WORKER_URL/health" -Method Get
    $healthResponse | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Health check failed: $_" -ForegroundColor Red
}

Write-Host "Testing models endpoint..." -ForegroundColor Cyan
try {
    $modelsResponse = Invoke-RestMethod -Uri "$WORKER_URL/models" -Method Get
    $modelsResponse | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Models check failed: $_" -ForegroundColor Red
}

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "📋 Your chat API endpoint: $WORKER_URL/chat" -ForegroundColor White
Write-Host "🔍 Health check: $WORKER_URL/health" -ForegroundColor White
Write-Host "📊 Available models: $WORKER_URL/models" -ForegroundColor White

Write-Host ""
Write-Host "💡 Next steps:" -ForegroundColor Magenta
Write-Host "1. Update your frontend to use: $WORKER_URL/chat" -ForegroundColor White
Write-Host "2. Set up R2 bucket: npx wrangler r2 bucket create social-twin-storage" -ForegroundColor White
Write-Host "3. Set up Vectorize index: npx wrangler vectorize create social-twin-embeddings --dimensions=768" -ForegroundColor White
