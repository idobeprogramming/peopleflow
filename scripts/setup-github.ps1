# One-time GitHub configuration for the PeopleFlow delivery workflow. Safe to re-run.
# Requires a token with admin rights on the repository, kept only in this PowerShell session:
#   $env:GH_TOKEN = 'github_pat_...'
#   .\scripts\setup-github.ps1
param(
  [string]$Repository = 'idobeprogramming/peopleflow',
  [string[]]$RequiredChecks = @(
    'CI / Tests, typage et build',
    'CI / Migrations Supabase',
    'CI / Parcours E2E',
    'CI / Scan de secrets'
  )
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$script:limited = @()
if ([string]::IsNullOrWhiteSpace($env:GH_TOKEN)) {
  throw 'Définis GH_TOKEN avec un jeton GitHub ayant les droits administrateur du dépôt.'
}
$headers = @{
  Accept = 'application/vnd.github+json'
  Authorization = "Bearer $($env:GH_TOKEN)"
  'X-GitHub-Api-Version' = '2022-11-28'
  'User-Agent' = 'peopleflow-setup'
}
$api = "https://api.github.com/repos/$Repository"

function Invoke-GitHub([string]$Method, [string]$Uri, $Body = $null) {
  $parameters = @{ Method = $Method; Uri = $Uri; Headers = $headers }
  if ($null -ne $Body) {
    # Windows PowerShell 5.1 would send a string body as ISO-8859-1; send UTF-8 bytes instead.
    $parameters.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 10))
    $parameters.ContentType = 'application/json; charset=utf-8'
  }
  Invoke-RestMethod @parameters
}

function Step([string]$Message) { Write-Host "`n▶ $Message" -ForegroundColor Cyan }

Step 'Réglages du dépôt (squash pour les fonctionnalités, commit de fusion pour la promotion, auto-merge)'
Invoke-GitHub PATCH $api @{
  allow_squash_merge = $true; allow_merge_commit = $true; allow_rebase_merge = $false
  allow_auto_merge = $true; delete_branch_on_merge = $true
  squash_merge_commit_title = 'PR_TITLE'; squash_merge_commit_message = 'PR_BODY'
} | Out-Null

Step 'Jeton GITHUB_TOKEN en lecture seule par défaut'
Invoke-GitHub PUT "$api/actions/permissions/workflow" @{
  default_workflow_permissions = 'read'; can_approve_pull_request_reviews = $false
} | Out-Null

Step 'Labels'
$labels = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot '..\.github\labels.json') | ConvertFrom-Json
foreach ($label in $labels) {
  try {
    Invoke-GitHub POST "$api/labels" @{ name = $label.name; color = $label.color; description = $label.description } | Out-Null
    Write-Host "  + $($label.name)"
  } catch {
    $encoded = [uri]::EscapeDataString($label.name)
    Invoke-GitHub PATCH "$api/labels/$encoded" @{ color = $label.color; description = $label.description } | Out-Null
    Write-Host "  = $($label.name)"
  }
}

Step 'Branche staging'
try {
  Invoke-GitHub GET "$api/branches/staging" | Out-Null
  Write-Host '  staging existe déjà.'
} catch {
  $main = Invoke-GitHub GET "$api/git/ref/heads/main"
  Invoke-GitHub POST "$api/git/refs" @{ ref = 'refs/heads/staging'; sha = $main.object.sha } | Out-Null
  Write-Host "  staging créée depuis main ($($main.object.sha.Substring(0, 7)))."
}

function Test-PlanLimit($ErrorRecord) {
  return "$ErrorRecord" -match 'Upgrade to GitHub Pro|make this repository public'
}

function Protect([string]$Branch, [bool]$EnforceAdmins, [bool]$Linear) {
  try {
  Invoke-GitHub PUT "$api/branches/$Branch/protection" @{
    required_status_checks = @{ strict = $true; contexts = $RequiredChecks }
    enforce_admins = $EnforceAdmins
    required_pull_request_reviews = @{
      dismiss_stale_reviews = $true; require_code_owner_reviews = $true; required_approving_review_count = 1
    }
    restrictions = $null
    required_linear_history = $Linear
    allow_force_pushes = $false
    allow_deletions = $false
    required_conversation_resolution = $true
  } | Out-Null
  Write-Host "  $Branch protégée."
  } catch {
    if (-not (Test-PlanLimit $_)) { throw }
    Write-Warning "$Branch non protégée : un dépôt privé exige GitHub Pro pour la protection de branches."
    $script:limited += "protection de $Branch"
  }
}

Step 'Protection des branches'
# main: merge commits from the staging promotion PR, no admin bypass.
Protect 'main' $true $false
# staging: squash only; the owner keeps admin bypass for their own PRs (a solo owner cannot approve them).
Protect 'staging' $false $true

Step 'Environnements staging et production'
$me = Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers $headers
Invoke-GitHub PUT "$api/environments/staging" @{
  deployment_branch_policy = @{ protected_branches = $false; custom_branch_policies = $true }
} | Out-Null
try {
  Invoke-GitHub POST "$api/environments/staging/deployment-branch-policies" @{ name = 'staging'; type = 'branch' } | Out-Null
} catch { }
try {
  Invoke-GitHub PUT "$api/environments/production" @{
    reviewers = @(@{ type = 'User'; id = $me.id })
    deployment_branch_policy = @{ protected_branches = $false; custom_branch_policies = $true }
  } | Out-Null
  $productionApproval = $true
} catch {
  if (-not (Test-PlanLimit $_)) { throw }
  Invoke-GitHub PUT "$api/environments/production" @{
    deployment_branch_policy = @{ protected_branches = $false; custom_branch_policies = $true }
  } | Out-Null
  $productionApproval = $false
  $script:limited += 'approbation des déploiements production'
}
try {
  Invoke-GitHub POST "$api/environments/production/deployment-branch-policies" @{ name = 'main'; type = 'branch' } | Out-Null
} catch { }
if ($productionApproval) { Write-Host "  production demande l'approbation de $($me.login)." }
else { Write-Warning "production créée sans approbation obligatoire (GitHub Pro requis pour un dépôt privé)." }

if ($script:limited.Count -gt 0) {
  Write-Host @"

ATTENTION — non disponible sur ce dépôt privé avec un compte gratuit :
  - $($script:limited -join "`n  - ")
L'agent n'active pas l'auto-merge sur une branche non protégée : ses PR attendent ta fusion.
Pour tout activer : rendre le dépôt public (gratuit) ou passer à GitHub Pro, puis relancer ce script.
"@ -ForegroundColor Yellow
}

Write-Host @"

Fait. Il reste ce que ce script ne peut pas faire pour toi (voir docs/AUTOMATION_SETUP.md) :
  1. Créer la GitHub App « PeopleFlow Agent », l'installer sur $Repository,
     puis : variable AGENT_APP_ID + secret AGENT_APP_PRIVATE_KEY.
  2. Secret CLAUDE_CODE_OAUTH_TOKEN (abonnement Pro/Max : claude setup-token)
     ou ANTHROPIC_API_KEY (clé API).
  3. Pour déployer : secrets et variables des environnements staging et production.
"@ -ForegroundColor Green
