# Run MCP server for Supabase (safe: reads token from shell)
# Usage: set env and run this script in PowerShell
# $env:SUPABASE_ACCESS_TOKEN = '<your token>'
# ./run-mcp.ps1 --project-ref <project-ref>
param(
  # Allow positional projectRef or named -projectRef
  [Parameter(Mandatory=$false, Position=0)]
  [string]$projectRef
)

# Also support GNU-style --project-ref passed literally in $args
if (-not $projectRef) {
  for ($i = 0; $i -lt $args.Count; $i++) {
    $a = $args[$i]
    if ($a -match '^--project-ref=(.+)') { $projectRef = $Matches[1]; break }
    if ($a -eq '--project-ref' -or $a -eq '--projectRef') {
      if ($i + 1 -lt $args.Count) { $projectRef = $args[$i+1]; break }
    }
    if ($a -match '^--projectRef=(.+)') { $projectRef = $Matches[1]; break }
  }
}

if (-not $projectRef) {
  Write-Error "projectRef not provided. Usage: ./run-mcp.ps1 <projectRef>  OR  ./run-mcp.ps1 --project-ref <projectRef>"
  exit 1
}

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Error "SUPABASE_ACCESS_TOKEN is not set in this shell. Set it before running."
  exit 1
}

Write-Host "Starting MCP server for Supabase (project-ref: $projectRef)"
Write-Host "Output is streamed to the console and saved to .\mcp-output.txt"
Write-Host "Run in a separate terminal or Ctrl+C to stop."

# Build arguments for npx
$npxArgs = @('-y', '@supabase/mcp-server-supabase@latest', '--read-only', '--project-ref', $projectRef)

# Use PowerShell to run npx directly and tee output to a file so the user can copy it safely.
try {
  & npx @npxArgs 2>&1 | Tee-Object -FilePath .\mcp-output.txt
} catch {
  Write-Error "Failed to start MCP via npx. Ensure Node and npx are available. Error: $_"
  exit 1
}
