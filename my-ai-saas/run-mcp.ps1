# Run MCP server for Supabase (safe: reads token from shell)
# Usage: set env and run this script in PowerShell
# $env:SUPABASE_ACCESS_TOKEN = '<your token>'
# ./run-mcp.ps1 --project-ref <project-ref>
param(
  [Parameter(Mandatory=$true)]
  [string]
  $projectRef
)

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Error "SUPABASE_ACCESS_TOKEN is not set in this shell. Set it before running."
  exit 1
}

$npx = "npx -y @supabase/mcp-server-supabase@latest --read-only --project-ref $projectRef"
Write-Host "Starting MCP server for Supabase (project-ref: $projectRef)"
Write-Host "Run in a separate terminal or Ctrl+C to stop."

cmd /c $npx
