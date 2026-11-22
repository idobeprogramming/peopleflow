# Removes local agent worktrees whose branch is merged into origin/staging, or whose pushed branch was
# deleted on origin after its PR was merged. Unpushed branches and worktrees with local changes are kept.
param([string]$Base = 'staging', [switch]$WhatIf)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
git -C $repo fetch --quiet --prune origin
$merged = git -C $repo branch --merged "origin/$Base" --format '%(refname:short)'
$lines = git -C $repo worktree list --porcelain
$current = $null
foreach ($line in $lines) {
  if ($line -like 'worktree *') { $current = $line.Substring(9) }
  if ($line -like 'branch refs/heads/feature/issue-*') {
    $branch = $line.Substring(18)
    $track = git -C $repo for-each-ref --format '%(upstream:track)' "refs/heads/$branch"
    $gone = $track -eq '[gone]'
    if ($merged -contains $branch -or $gone) {
      if ($WhatIf) { Write-Host "Supprimerait $current ($branch)"; continue }
      git -C $repo worktree remove $current
      git -C $repo branch -D $branch | Out-Null
      Write-Host "Supprimé : $current ($branch)"
    }
  }
}
