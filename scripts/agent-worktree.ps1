# Creates an isolated worktree for one issue so several local agents can run in parallel.
#   .\scripts\agent-worktree.ps1 -Issue 12            -> ..\peopleflow-wt\issue-12 on branch feature/issue-12
#   .\scripts\agent-worktree.ps1 -Issue 12 -Start     -> also starts web and API on dedicated ports
param(
  [Parameter(Mandatory)][int]$Issue,
  [string]$Base = 'staging',
  [switch]$Start
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$root = Join-Path (Split-Path $repo) 'peopleflow-wt'
$path = Join-Path $root "issue-$Issue"
$branch = "feature/issue-$Issue"

git -C $repo fetch --quiet origin $Base
if ($LASTEXITCODE -ne 0) { throw "Impossible de récupérer origin/$Base." }
if (Test-Path $path) {
  Write-Host "Le worktree existe déjà : $path"
} else {
  New-Item -ItemType Directory -Force $root | Out-Null
  git -C $repo worktree add -b $branch $path "origin/$Base"
  if ($LASTEXITCODE -ne 0) { throw 'Création du worktree impossible.' }
  foreach ($file in @('.env', '.env.local')) {
    $source = Join-Path $repo $file
    if (Test-Path $source) { Copy-Item $source (Join-Path $path $file) }
  }
  Push-Location $path
  try { npm ci --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { throw 'npm ci a échoué.' } } finally { Pop-Location }
}

# Ports derived from the issue number so worktrees never collide.
$offset = ($Issue % 50) + 1
$apiPort = 3000 + $offset
$webPort = 5173 + $offset
Set-Content -Path (Join-Path $path '.agent-ports') -Value "API=$apiPort`nWEB=$webPort"

Write-Host @"

Worktree prêt : $path  (branche $branch depuis origin/$Base)
API : http://localhost:$apiPort   Web : http://localhost:$webPort
Lancer l'agent dans ce dossier avec le prompt de scripts/agent/implement.prompt.md
et le texte de l'issue dans .agent/issue.md.
"@

if ($Start) {
  Push-Location $path
  try {
    $env:PORT = $apiPort
    $env:WEB_PORT = $webPort
    npm run dev
  } finally { Pop-Location }
}
