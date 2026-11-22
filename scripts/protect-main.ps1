param(
  [string]$Repository = 'idobeprogramming/peopleflow',
  [string[]]$RequiredChecks = @(
    'CI / Tests, typage et build',
    'CI / Migrations Supabase'
  )
)

$ErrorActionPreference = 'Stop'
$token = $env:GH_TOKEN
if ([string]::IsNullOrWhiteSpace($token)) {
  throw 'D�finis GH_TOKEN avec un jeton GitHub ayant les droits administrateur du d�p�t.'
}

$headers = @{
  Accept = 'application/vnd.github+json'
  Authorization = "Bearer $token"
  'X-GitHub-Api-Version' = '2022-11-28'
  'User-Agent' = 'peopleflow-branch-protection'
}

$payload = @{
  required_status_checks = @{
    strict = $true
    contexts = $RequiredChecks
  }
  enforce_admins = $true
  required_pull_request_reviews = @{
    dismiss_stale_reviews = $true
    require_code_owner_reviews = $true
    required_approving_review_count = 1
  }
  restrictions = $null
  required_linear_history = $true
  allow_force_pushes = $false
  allow_deletions = $false
  block_creations = $false
  required_conversation_resolution = $true
  lock_branch = $false
  allow_fork_syncing = $false
} | ConvertTo-Json -Depth 8

$uri = "https://api.github.com/repos/$Repository/branches/main/protection"
Invoke-RestMethod -Method Put -Uri $uri -Headers $headers -Body $payload -ContentType 'application/json' | Out-Null
Write-Host "La branche main est prot�g�e dans $Repository."

