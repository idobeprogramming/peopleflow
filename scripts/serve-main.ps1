# Run once in a dedicated Windows checkout to serve the latest merged main.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$node = (Get-Command node.exe).Source
$npm = (Get-Command npm.cmd).Source
$npmCli = Join-Path (Split-Path $npm) 'node_modules/npm/bin/npm-cli.js'
if (!(Test-Path -LiteralPath $npmCli)) { throw 'Installation de npm introuvable.' }

function Read-Git([string[]]$Arguments) {
    $result = & git @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Échec de git $($Arguments[0])." }
    return $result
}

function Stop-PeopleFlow($Process) {
    if ($Process -and !$Process.HasExited) {
        & taskkill.exe /PID $Process.Id /T /F | Out-Null
        $Process.WaitForExit()
    }
}

Read-Git @('remote', 'get-url', 'origin') | Out-Null
$server = $null
$runningCommit = ''
$installedLock = ''
try {
    while ($true) {
        try {
            if ((Read-Git @('branch', '--show-current')) -ne 'main' -or
                (Read-Git @('status', '--porcelain'))) {
                throw 'Synchronisation suspendue. Ce checkout doit être propre et sur main.'
            }
            Read-Git @('fetch', '--quiet', 'origin', 'main')
            $target = Read-Git @('rev-parse', 'FETCH_HEAD')
            & git merge-base --is-ancestor HEAD $target
            if ($LASTEXITCODE -ne 0) { throw 'Historique local divergent.' }
            if ($runningCommit -ne $target -or !$server -or $server.HasExited) {
                Stop-PeopleFlow $server
                Read-Git @('merge', '--ff-only', $target)
                $lock = (Get-FileHash package-lock.json).Hash
                if ($installedLock -ne $lock) {
                    & $npm ci
                    if ($LASTEXITCODE -ne 0) { throw 'Installation npm incomplète.' }
                    $installedLock = $lock
                }
                $server = Start-Process -PassThru -FilePath $node -WindowStyle Hidden -ArgumentList @(
                    ('"' + $npmCli + '"'), 'run', 'dev:local'
                ) -RedirectStandardOutput 'peopleflow-local.log' -RedirectStandardError 'peopleflow-local-error.log'
                $runningCommit = $target
                Write-Host "Démarrage de PeopleFlow pour $target. Journal : peopleflow-local.log"
                $healthy = $false
                for ($i = 0; $i -lt 30 -and !$server.HasExited; $i++) {
                    Start-Sleep -Seconds 3
                    try {
                        $healthy = (Invoke-RestMethod -TimeoutSec 2 'http://localhost:3000/api/health').status -eq 'ok'
                    } catch { }
                    if ($healthy) { break }
                }
                if ($healthy) { Write-Host "PeopleFlow répond sur http://localhost:5173 ($($target.Substring(0, 7)))." }
                else { Write-Warning 'PeopleFlow ne répond pas après 90 s. Voir peopleflow-local-error.log.' }
            }
        } catch {
            Write-Warning $_.Exception.Message
        }
        Start-Sleep -Seconds 30
    }
} finally {
    Stop-PeopleFlow $server
}
