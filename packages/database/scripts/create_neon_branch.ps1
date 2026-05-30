param(
  [string]$BranchName,
  [string]$ProjectId = $env:NEON_PROJECT
)

if (-not $BranchName) {
  Write-Host "Usage: .\create_neon_branch.ps1 -BranchName pr-123" -ForegroundColor Yellow
  exit 2
}

if (-not $ProjectId) {
  Write-Host "NEON_PROJECT not set. Set environment variable or pass -ProjectId." -ForegroundColor Red
  exit 2
}

$neonCmd = Get-Command neon -ErrorAction SilentlyContinue
if (-not $neonCmd) {
  Write-Host "Neon CLI not found. Install with: npm i -g @neondatabase/cli" -ForegroundColor Red
  Write-Host "Falling back to showing the exact commands you should run:" -ForegroundColor Yellow
  Write-Host "neon branch create $BranchName --project $ProjectId"
  Write-Host "neon branch connect $BranchName --project $ProjectId"
  exit 0
}

# Create branch
Write-Host "Creating branch '$BranchName' in project '$ProjectId'..."
neon branch create $BranchName --project $ProjectId

Write-Host "Connecting to branch and printing DATABASE_URL (you can export this in your env)..."
neon branch connect $BranchName --project $ProjectId

Write-Host "Branch created. Remember to delete it when PR is closed: neon branch delete $BranchName --project $ProjectId"
