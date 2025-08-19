# Quick helper to start MCP in write mode for Supabase
# Usage: ./start-mcp-write.ps1

$projectRef = "tnlftxudmiryrgkajfun"

Write-Host "🔍 Checking Supabase MCP setup..." -ForegroundColor Cyan

# Check if token is set
if (-not $env:SUPABASE_ACCESS_TOKEN) {
    Write-Host "❌ SUPABASE_ACCESS_TOKEN is not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "To get your token:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://supabase.com/dashboard/account/tokens" -ForegroundColor Cyan
    Write-Host "2. Create a new Personal Access Token" -ForegroundColor Cyan
    Write-Host "3. Copy the token and run:" -ForegroundColor Cyan
    Write-Host '   $env:SUPABASE_ACCESS_TOKEN = "your_token_here"' -ForegroundColor Green
    Write-Host "4. Then run this script again" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

$tokenLength = $env:SUPABASE_ACCESS_TOKEN.Length
Write-Host "✅ Token found (length: $tokenLength)" -ForegroundColor Green

# Check if Node/npm is available
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🚀 Starting MCP server in WRITE mode..." -ForegroundColor Green
Write-Host "Project: $projectRef" -ForegroundColor Cyan
Write-Host "Mode: WRITE (full SQL access)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host "Output will be saved to: .\my-ai-saas\mcp-output.txt" -ForegroundColor Gray
Write-Host ""

# Change to the my-ai-saas directory and run MCP
Set-Location "my-ai-saas"
.\run-mcp.ps1 -projectRef $projectRef -Write
