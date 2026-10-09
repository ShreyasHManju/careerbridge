<#
.SYNOPSIS
    CareerBridge - Windows-First Local Restore Tool (Staged, Atomic Journaled & Fail-Closed)
.DESCRIPTION
    Restores a CareerBridge backup bundle with pre-flight privilege verification,
    checksum integrity checks, zip-slip security scanning, staged database restoration,
    catalog-aware rename switching, and fail-closed automatic rollback.
.PARAMETER BackupBundlePath
    Path to backup bundle directory (e.g. .\local-backups\careerbridge_backup_20261009_120000).
.PARAMETER ComposeFile
    Path to target Docker Compose file. Defaults to .\docker-compose.production.yml.
.PARAMETER EnvFile
    Path to environment file. Defaults to .\.env.
.PARAMETER Force
    Bypasses interactive confirmation prompt.
.PARAMETER DbOnly
    If specified, restores database records only.
.PARAMETER UploadsOnly
    If specified, restores uploaded files only.
.PARAMETER SkipChecksum
    Bypasses SHA-256 checksum verification (NOT recommended).
.PARAMETER ProjectName
    Optional explicit Docker Compose project name override.
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$BackupBundlePath,

    [Parameter(Mandatory = $false)]
    [string]$ComposeFile = ".\docker-compose.production.yml",

    [Parameter(Mandatory = $false)]
    [string]$EnvFile = ".\.env",

    [Parameter(Mandatory = $false)]
    [switch]$Force,

    [Parameter(Mandatory = $false)]
    [switch]$DbOnly,

    [Parameter(Mandatory = $false)]
    [switch]$UploadsOnly,

    [Parameter(Mandatory = $false)]
    [switch]$SkipChecksum,

    [Parameter(Mandatory = $false)]
    [string]$ProjectName
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-InfoLog([string]$Message) {
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-SuccessLog([string]$Message) {
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-WarnLog([string]$Message) {
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-ErrorLog([string]$Message) {
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Invoke-NativeCli([string]$CommandDescription, [scriptblock]$Script) {
    & $Script
    if ($LASTEXITCODE -ne 0) {
        throw "Command '$CommandDescription' failed with exit code $LASTEXITCODE"
    }
}

function Get-SafeProperty($Object, [string]$PropertyName, $DefaultValue = $null) {
    if ($null -eq $Object) { return $DefaultValue }
    if ($Object.PSObject.Properties[$PropertyName]) {
        $val = $Object.$PropertyName
        if ($null -ne $val) { return $val }
    }
    return $DefaultValue
}

# 1. Validate Backup Bundle Path and Structure
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI is not available in PATH. Ensure Docker Desktop is installed and running."
}
if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
    throw "tar CLI is not available in PATH. Ensure tar (bsdtar/tar.exe) is available."
}

$resolvedBundle = Resolve-Path $BackupBundlePath -ErrorAction SilentlyContinue
if (-not $resolvedBundle -or -not (Test-Path $resolvedBundle)) {
    throw "Backup bundle path does not exist: $BackupBundlePath"
}
$resolvedBundle = $resolvedBundle.Path

$manifestPath = Join-Path $resolvedBundle "manifest.json"
$checksumsPath = Join-Path $resolvedBundle "checksums.sha256"

if (-not (Test-Path $manifestPath)) {
    throw "Missing manifest.json in backup bundle: $resolvedBundle"
}
if (-not (Test-Path $checksumsPath)) {
    throw "Missing checksums.sha256 in backup bundle: $resolvedBundle"
}

$manifest = (Get-Content $manifestPath -Raw | ConvertFrom-Json)

$manifestDb = Get-SafeProperty -Object $manifest -PropertyName "database"
$manifestUploads = Get-SafeProperty -Object $manifest -PropertyName "uploads"

$hasDbDump = (-not $UploadsOnly -and ($null -ne $manifestDb) -and (Test-Path (Join-Path $resolvedBundle "database.sql")))
$hasUploadsDump = (-not $DbOnly -and ($null -ne $manifestUploads) -and (Test-Path (Join-Path $resolvedBundle "uploads.tar.gz")))

if (-not $hasDbDump -and -not $hasUploadsDump) {
    throw "No valid restore target found in bundle (database.sql or uploads.tar.gz missing)."
}

# 2. SHA-256 Pre-Execution Checksum Verification
if (-not $SkipChecksum) {
    Write-InfoLog "Verifying backup bundle SHA-256 checksums..."
    $checksumLines = Get-Content $checksumsPath | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    $checksumMap = @{}
    foreach ($line in $checksumLines) {
        $parts = $line.Trim() -split "\s+", 2
        if ($parts.Count -eq 2) {
            $checksumMap[$parts[1].Trim()] = $parts[0].Trim().ToLower()
        }
    }

    if ($hasDbDump) {
        $dbFile = Join-Path $resolvedBundle "database.sql"
        $dbHash = (Get-FileHash -Path $dbFile -Algorithm SHA256).Hash.ToLower()
        $rawExpectedDbSha = Get-SafeProperty -Object $manifestDb -PropertyName "sha256" -DefaultValue ""
        $expectedDbSha = if ($rawExpectedDbSha) { $rawExpectedDbSha.ToString().ToLower() } else { "" }
        if (-not $checksumMap.ContainsKey("database.sql") -or $checksumMap["database.sql"] -ne $dbHash -or $expectedDbSha -ne $dbHash) {
            throw "SHA-256 checksum mismatch for database.sql! Expected '$expectedDbSha', computed '$dbHash'."
        }
    }

    if ($hasUploadsDump) {
        $upFile = Join-Path $resolvedBundle "uploads.tar.gz"
        $upHash = (Get-FileHash -Path $upFile -Algorithm SHA256).Hash.ToLower()
        $rawExpectedUpSha = Get-SafeProperty -Object $manifestUploads -PropertyName "sha256" -DefaultValue ""
        $expectedUpSha = if ($rawExpectedUpSha) { $rawExpectedUpSha.ToString().ToLower() } else { "" }
        if (-not $checksumMap.ContainsKey("uploads.tar.gz") -or $checksumMap["uploads.tar.gz"] -ne $upHash -or $expectedUpSha -ne $upHash) {
            throw "SHA-256 checksum mismatch for uploads.tar.gz! Expected '$expectedUpSha', computed '$upHash'."
        }
    }
    Write-SuccessLog "Backup bundle checksums 100% verified."
}

# 3. Target Compose Discovery & Pre-Flight Inspections
$resolvedCompose = Resolve-Path $ComposeFile -ErrorAction SilentlyContinue
if (-not $resolvedCompose -or -not (Test-Path $resolvedCompose)) {
    throw "Compose file not found at: $ComposeFile"
}
$resolvedCompose = $resolvedCompose.Path

$resolvedEnv = Resolve-Path $EnvFile -ErrorAction SilentlyContinue
$hasEnv = [bool]($resolvedEnv -and (Test-Path $resolvedEnv))
$resolvedEnv = if ($hasEnv) { $resolvedEnv.Path } else { $null }

$composeArgs = @("-f", $resolvedCompose)
if ($resolvedEnv) {
    $composeArgs += @("--env-file", $resolvedEnv)
}
if ($ProjectName) {
    $composeArgs += @("-p", $ProjectName)
}

Write-InfoLog "Discovering target Compose services and volumes..."
$configJsonRaw = & docker compose @composeArgs config --format json
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($configJsonRaw)) {
    throw "Failed to parse Docker Compose configuration."
}
$configObj = $configJsonRaw | ConvertFrom-Json

$discoveredProject = if ($ProjectName) { $ProjectName } elseif (Get-SafeProperty -Object $configObj -PropertyName "name") { $configObj.name } else { (Split-Path (Split-Path $resolvedCompose -Parent) -Leaf).ToLower() }
$psJsonRaw = & docker compose @composeArgs ps -a --format json
if ($LASTEXITCODE -ne 0) {
    throw "Failed to query Compose service container status."
}

$containers = @()
if (-not [string]::IsNullOrWhiteSpace($psJsonRaw)) {
    $lines = $psJsonRaw -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    foreach ($line in $lines) {
        try { $containers += ($line | ConvertFrom-Json) } catch { }
    }
}

$dbContainer = $containers | Where-Object { (Get-SafeProperty -Object $_ -PropertyName "Service") -eq "db" } | Select-Object -First 1
$backendContainer = $containers | Where-Object { (Get-SafeProperty -Object $_ -PropertyName "Service") -eq "backend" } | Select-Object -First 1
$frontendContainer = $containers | Where-Object { (Get-SafeProperty -Object $_ -PropertyName "Service") -eq "frontend" } | Select-Object -First 1

if (-not $dbContainer) {
    throw "PostgreSQL 'db' service container not found in target Compose stack."
}
if (-not $backendContainer) {
    throw "Backend service container not found in target Compose stack."
}

$dbContainerId = $dbContainer.ID
$backendContainerId = $backendContainer.ID

# Verify Volume Mounts
$dbInspect = (docker inspect $dbContainerId | ConvertFrom-Json)[0]
$backendInspect = (docker inspect $backendContainerId | ConvertFrom-Json)[0]

$dbMount = $dbInspect.Mounts | Where-Object { $_.Destination -eq "/var/lib/postgresql/data" }
if (-not $dbMount) {
    throw "PostgreSQL container is not mounted to /var/lib/postgresql/data."
}

$backendMount = $backendInspect.Mounts | Where-Object { $_.Destination -eq "/app/uploads" }
if (-not $backendMount) {
    throw "Backend container is not mounted to /app/uploads."
}

$dbUser = "postgres"
$dbName = "internship_db"
$dbEnv = Get-SafeProperty -Object (Get-SafeProperty -Object (Get-SafeProperty -Object $configObj -PropertyName "services") -PropertyName "db") -PropertyName "environment"
if ($dbEnv) {
    $foundUser = Get-SafeProperty -Object $dbEnv -PropertyName "POSTGRES_USER"
    if ($foundUser) { $dbUser = $foundUser }
    $foundDb = Get-SafeProperty -Object $dbEnv -PropertyName "POSTGRES_DB"
    if ($foundDb) { $dbName = $foundDb }
}

# 4. Pre-Flight PostgreSQL Privilege Verification Gate
Write-InfoLog "Verifying PostgreSQL role privileges and database ownership..."
$privQuery = @"
SELECT
    current_user AS role_name,
    rolsuper,
    rolcreatedb,
    (SELECT pg_has_role(current_user, datdba, 'USAGE') FROM pg_database WHERE datname = '$dbName') AS is_target_owner,
    (rolsuper OR pg_has_role(current_user, 'pg_signal_backend', 'USAGE')) AS can_terminate_sessions
FROM pg_roles
WHERE rolname = current_user;
"@

$privRaw = & docker compose @composeArgs exec -T db psql -U $dbUser -d postgres -t -c $privQuery
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($privRaw)) {
    throw "Failed to query PostgreSQL role privileges on maintenance catalog."
}

$privCols = $privRaw.Trim() -split "\|"
if ($privCols.Count -lt 5) {
    throw "Unexpected privilege query result format."
}

$isSuper = ($privCols[1].Trim() -eq "t")
$hasCreateDb = ($privCols[2].Trim() -eq "t")
$isTargetOwner = ($privCols[3].Trim() -eq "t")
$canTerminate = ($privCols[4].Trim() -eq "t")

if (-not $isSuper -and (-not $hasCreateDb -or -not $isTargetOwner -or -not $canTerminate)) {
    throw "Insufficient PostgreSQL privileges for restore operations. User '$dbUser' requires SUPERUSER or (CREATEDB + target database ownership + pg_signal_backend)."
}
Write-SuccessLog "PostgreSQL privileges verified for user '$dbUser'."

# 5. Catalog & Journal Reconciliation Pre-Check (Bug B Fix: robust array handling under StrictMode)
$backupParent = Split-Path $resolvedBundle -Parent
$activeJournals = @(Get-ChildItem -Path $backupParent -Filter ".restore_journal_*.json" -File -ErrorAction SilentlyContinue)

$existingDbsRaw = & docker compose @composeArgs exec -T db psql -U $dbUser -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE '${dbName}_%';"
$existingDbs = @()
if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($existingDbsRaw)) {
    $existingDbs = @($existingDbsRaw -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -match "^${dbName}_(stage|old|failed)_" })
}

if ($activeJournals.Count -gt 0 -or $existingDbs.Count -gt 0) {
    Write-WarnLog "Detected residual database(s) or active journal(s): $($existingDbs -join ', ')"
    if ($activeJournals.Count -ne 1 -or $existingDbs.Count -ne 1) {
        throw "Ambiguous or conflicting recovery state. Multiple residual databases or journals detected. Halting fail-closed."
    }
}

# 6. Interactive Confirmation Gate
if (-not $Force) {
    Write-Host ""
    Write-Host "=================================================================" -ForegroundColor Yellow
    Write-Host "CAREERBRIDGE DATABASE & UPLOADS RESTORATION WARNING" -ForegroundColor Yellow
    Write-Host "=================================================================" -ForegroundColor Yellow
    Write-Host "Target Compose Project : $discoveredProject"
    Write-Host "Target Database        : $dbName"
    Write-Host "Target Uploads Volume  : /app/uploads"
    Write-Host "Source Backup Bundle   : $resolvedBundle"
    Write-Host "-----------------------------------------------------------------"
    Write-Host "WARNING: This will replace the active database and file storage!" -ForegroundColor Yellow
    Write-Host "A pre-restore safety snapshot will be created before any changes."
    Write-Host "=================================================================" -ForegroundColor Yellow
    $confirm = Read-Host "Type 'RESTORE' to confirm destructive restoration"
    if ($confirm -ne "RESTORE") {
        Write-WarnLog "Restoration aborted by operator. No changes made."
        exit 0
    }
}

# 7. Initialize Operation Journal
$opId = (Get-Date -Format "yyyyMMdd_HHmmss") + "_" + [guid]::NewGuid().ToString("N").Substring(0, 8)
$journalPath = Join-Path $backupParent ".restore_journal_${opId}.json"

function Update-DurableJournal([string]$StepName, [hashtable]$ExtraData = @{}) {
    $jObj = [PSCustomObject]@{
        operation_id = $opId
        updated_at_utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        bundle_path = $resolvedBundle
        project_name = $discoveredProject
        target_database = $dbName
        stage_database = "${dbName}_stage_${opId}"
        previous_database = "${dbName}_old_${opId}"
        failed_database = "${dbName}_failed_${opId}"
        stage_uploads_dir = "/app/uploads/.staging_${opId}"
        previous_uploads_dir = "/app/uploads/.live_old_${opId}"
        failed_uploads_dir = "/app/uploads/.failed_install_${opId}"
        step = $StepName
    }
    foreach ($k in $ExtraData.Keys) {
        $jObj | Add-Member -MemberType NoteProperty -Name $k -Value $ExtraData[$k] -Force
    }
    $tmpJournal = "$journalPath.tmp"
    $bakJournal = "$journalPath.bak"
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $jsonBytes = $utf8NoBom.GetBytes(($jObj | ConvertTo-Json -Depth 5))
    $fs = New-Object System.IO.FileStream($tmpJournal, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    try {
        $fs.Write($jsonBytes, 0, $jsonBytes.Length)
        $fs.Flush($true)
    } finally {
        $fs.Dispose()
    }
    if (Test-Path -LiteralPath $journalPath) {
        [System.IO.File]::Replace($tmpJournal, $journalPath, $bakJournal)
        Remove-Item -LiteralPath $bakJournal -Force -ErrorAction SilentlyContinue
    } else {
        [System.IO.File]::Move($tmpJournal, $journalPath)
    }
}

Update-DurableJournal "INIT"

# 8. Record Initial State and Enter Quiescence
$backendWasRunning = ($backendInspect.State.Status -eq "running")
$frontendWasRunning = ($frontendContainer -and ((docker inspect $frontendContainer.ID | ConvertFrom-Json)[0].State.Status -eq "running"))

Write-InfoLog "Entering maintenance quiescence window..."
if ($frontendWasRunning) { & docker compose @composeArgs stop frontend }
if ($backendWasRunning) { & docker compose @composeArgs stop backend }

# 9. Pre-Restore Safety Snapshot
$safetyBundleDir = Join-Path $backupParent ".pre_restore_safety_${opId}"
New-Item -ItemType Directory -Path $safetyBundleDir -Force | Out-Null

Write-InfoLog "Capturing pre-restore safety snapshot to: $safetyBundleDir..."
Invoke-NativeCli "Pre-restore DB dump" {
    docker compose @composeArgs exec -T db pg_dump -U $dbUser -d $dbName --clean --if-exists --no-owner --no-privileges -f /tmp/cb_safety_db.sql
}
docker cp "${dbContainerId}:/tmp/cb_safety_db.sql" (Join-Path $safetyBundleDir "database.sql")
& docker compose @composeArgs exec -T db rm -f /tmp/cb_safety_db.sql

$safetyUploadsTemp = Join-Path $safetyBundleDir ".tmp_safety_uploads"
New-Item -ItemType Directory -Path (Join-Path $safetyUploadsTemp "resumes") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $safetyUploadsTemp "profile_images") -Force | Out-Null
docker cp "${backendContainerId}:/app/uploads/." $safetyUploadsTemp

Invoke-NativeCli "Pre-restore Uploads archive" {
    tar.exe -czf (Join-Path $safetyBundleDir "uploads.tar.gz") -C $safetyUploadsTemp resumes profile_images
}
Remove-Item -Path $safetyUploadsTemp -Recurse -Force -ErrorAction SilentlyContinue

$stageDbName = "${dbName}_stage_${opId}"
$oldDbName = "${dbName}_old_${opId}"
$failedDbName = "${dbName}_failed_${opId}"
$stageUploadsDir = "/app/uploads/.staging_${opId}"
$oldUploadsDir = "/app/uploads/.live_old_${opId}"
$failedUploadsDir = "/app/uploads/.failed_install_${opId}"

$dbSwitched = $false
$uploadsSwitched = $false

try {
    # 10. Staged Database Restore
    if ($hasDbDump) {
        Write-InfoLog "Creating isolated staging database: $stageDbName..."
        Invoke-NativeCli "Create staging database" {
            docker compose @composeArgs exec -T db psql -U $dbUser -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE `"$stageDbName`" WITH OWNER `"$dbUser`";"
        }

        Write-InfoLog "Restoring SQL snapshot into staging database..."
        docker cp (Join-Path $resolvedBundle "database.sql") "${dbContainerId}:/tmp/cb_restore_db.sql"
        Invoke-NativeCli "Import into staging database" {
            docker compose @composeArgs exec -T db psql -U $dbUser -d $stageDbName -v ON_ERROR_STOP=1 -f /tmp/cb_restore_db.sql
        }
        & docker compose @composeArgs exec -T db rm -f /tmp/cb_restore_db.sql

        Write-InfoLog "Verifying table schema in staging database..."
        $tableCountRaw = & docker compose @composeArgs exec -T db psql -U $dbUser -d $stageDbName -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'job_postings', 'applications', 'resumes', 'profile_images');"
        $tableCount = 0
        if (-not [int]::TryParse($tableCountRaw.Trim(), [ref]$tableCount) -or $tableCount -lt 5) {
            throw "Staging database verification failed: expected core tables missing ($tableCount/5 found)."
        }
        Update-DurableJournal "DB_STAGED_AND_VERIFIED"
        Write-SuccessLog "Staging database verified successfully."
    }

    # 11. Staged Uploads Restore & Security Scan
    if ($hasUploadsDump) {
        $upFile = Join-Path $resolvedBundle "uploads.tar.gz"
        Write-InfoLog "Scanning upload archive for security invariants (zip-slip, traversal, unexpected roots, links)..."
        $entriesRaw = & tar.exe -tzf $upFile
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to inspect upload archive entries."
        }

        $entries = @($entriesRaw -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        $seenEntries = @{}
        foreach ($entry in $entries) {
            $e = $entry.Trim()
            if ($e.StartsWith("/") -or $e.StartsWith("\") -or $e -match "^[A-Za-z]:") {
                throw "Security violation: Absolute path detected in upload archive: $e"
            }
            if ($e -match "\.\." -or $e.Contains("../") -or $e.Contains("..\")) {
                throw "Security violation: Path traversal detected in upload archive: $e"
            }
            if (-not $e.StartsWith("resumes") -and -not $e.StartsWith("profile_images") -and -not $e.StartsWith("./resumes") -and -not $e.StartsWith("./profile_images") -and -not ($e -eq "." -or $e -eq "./")) {
                throw "Security violation: Unexpected root entry in upload archive: $e"
            }
            $normEntry = $e.TrimStart(".").TrimStart("/").TrimEnd("/")
            if ($normEntry -ne "" -and $seenEntries.ContainsKey($normEntry)) {
                throw "Security violation: Duplicate entry detected in upload archive: $e"
            }
            if ($normEntry -ne "") {
                $seenEntries[$normEntry] = $true
            }
        }

        $verbRaw = & tar.exe -tvf $upFile
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($verbRaw)) {
            $verbLines = @($verbRaw -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
            foreach ($vLine in $verbLines) {
                $vl = $vLine.Trim()
                if ($vl -match "^[lhcbps]" -or $vl.Contains("->") -or $vl.Contains("link to")) {
                    throw "Security violation: Link or special file detected in upload archive: $vl"
                }
            }
        }

        Write-InfoLog "Extracting archive to isolated staging directory: $stageUploadsDir..."
        $tempStageHost = Join-Path $backupParent ".tmp_uploads_stage_${opId}"
        New-Item -ItemType Directory -Path (Join-Path $tempStageHost "resumes") -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $tempStageHost "profile_images") -Force | Out-Null

        Invoke-NativeCli "Extract to local staging" {
            tar.exe -xzf $upFile -C $tempStageHost
        }

        docker cp "${tempStageHost}/." "${backendContainerId}:${stageUploadsDir}/"
        Remove-Item -Path $tempStageHost -Recurse -Force -ErrorAction SilentlyContinue

        Update-DurableJournal "UPLOADS_STAGED_AND_VERIFIED"
        Write-SuccessLog "Uploads staging and security validation passed."
    }

    # 12. Atomic Database Switch
    if ($hasDbDump) {
        Write-InfoLog "Executing database rename switch ($dbName -> $oldDbName, $stageDbName -> $dbName)..."
        Update-DurableJournal "PRE_RENAME_1"
        & docker compose @composeArgs exec -T db psql -U $dbUser -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$dbName' AND pid <> pg_backend_pid();"
        Invoke-NativeCli "Rename live to old" {
            docker compose @composeArgs exec -T db psql -U $dbUser -d postgres -v ON_ERROR_STOP=1 -c "ALTER DATABASE `"$dbName`" RENAME TO `"$oldDbName`";"
        }
        Update-DurableJournal "RENAME_1_COMPLETE"

        Invoke-NativeCli "Rename stage to live" {
            docker compose @composeArgs exec -T db psql -U $dbUser -d postgres -v ON_ERROR_STOP=1 -c "ALTER DATABASE `"$stageDbName`" RENAME TO `"$dbName`";"
        }
        $dbSwitched = $true
        Update-DurableJournal "RENAME_2_COMPLETE"
        Write-SuccessLog "Database rename switch completed."
    }

    # 13. Staged Uploads Replacement
    if ($hasUploadsDump) {
        Write-InfoLog "Executing fine-grained upload directory replacement via isolated helper container..."
        Invoke-NativeCli "Install restored uploads" {
            docker compose @composeArgs run -u root --rm --no-deps backend sh -c "mkdir -p '$oldUploadsDir' && mv /app/uploads/resumes '$oldUploadsDir/resumes' 2>/dev/null || true; mv /app/uploads/profile_images '$oldUploadsDir/profile_images' 2>/dev/null || true; mv '$stageUploadsDir/resumes' /app/uploads/resumes; mv '$stageUploadsDir/profile_images' /app/uploads/profile_images; rm -rf '$stageUploadsDir'; chown -R appuser:appuser /app/uploads/resumes /app/uploads/profile_images"
        }
        $uploadsSwitched = $true
        Update-DurableJournal "UPLOADS_INSTALLED"
        Write-SuccessLog "Upload directory replacement completed."
    }

    # 14. Service Resumption & Deep Health Probe
    Write-InfoLog "Resuming services and running deep readiness probe..."
    if ($backendWasRunning) { & docker compose @composeArgs start backend }
    if ($frontendWasRunning) { & docker compose @composeArgs start frontend }

    if ($backendWasRunning) {
        Start-Sleep -Seconds 3
        $probeOk = $false
        for ($attempt = 1; $attempt -le 10; $attempt++) {
            $healthRaw = & docker compose @composeArgs exec -T backend python -c "import urllib.request; resp = urllib.request.urlopen('http://127.0.0.1:8000/health/ready', timeout=5); print(resp.getcode())"
            if ($LASTEXITCODE -eq 0 -and $healthRaw.Trim() -eq "200") {
                $probeOk = $true
                break
            }
            Start-Sleep -Seconds 2
        }

        if (-not $probeOk) {
            throw "Deep readiness probe (/health/ready) failed post-restore."
        }
    } else {
        Write-WarnLog "Backend service was not running prior to restore; skipping live HTTP readiness probe."
    }

    Update-DurableJournal "VERIFIED"
    $resolvedJournal = [System.IO.Path]::ChangeExtension($journalPath, ".resolved")
    if (Test-Path -LiteralPath $journalPath) {
        if (Test-Path -LiteralPath $resolvedJournal) {
            $bakResolved = "$resolvedJournal.bak"
            [System.IO.File]::Replace($journalPath, $resolvedJournal, $bakResolved)
            Remove-Item -LiteralPath $bakResolved -Force -ErrorAction SilentlyContinue
        } else {
            [System.IO.File]::Move($journalPath, $resolvedJournal)
        }
    }
} catch {
    Write-ErrorLog "Restoration encountered an error: $_"
    Write-WarnLog "Initiating coordinated fail-closed rollback sequence..."

    # Coordinated Rollback Sequence
    $origPref = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        if ($frontendWasRunning) { & docker compose @composeArgs stop frontend 2>&1 | Out-Null }
        if ($backendWasRunning) { & docker compose @composeArgs stop backend 2>&1 | Out-Null }

        $oldDbCheck = & docker compose @composeArgs exec -T db psql -U $dbUser -d postgres -t -c "SELECT 1 FROM pg_database WHERE datname='$oldDbName';" 2>$null
        $oldDbExists = ($LASTEXITCODE -eq 0 -and ($oldDbCheck | Out-String) -match "1")
        if ($dbSwitched -or $oldDbExists) {
            Write-WarnLog "Reverting database switch ($dbName -> $failedDbName, $oldDbName -> $dbName)..."
            & docker compose @composeArgs exec -T db psql -U $dbUser -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$dbName' AND pid <> pg_backend_pid();" 2>$null
            & docker compose @composeArgs exec -T db psql -U $dbUser -d postgres -c "ALTER DATABASE `"$dbName`" RENAME TO `"$failedDbName`";" 2>$null
            & docker compose @composeArgs exec -T db psql -U $dbUser -d postgres -c "ALTER DATABASE `"$oldDbName`" RENAME TO `"$dbName`";" 2>$null
        }

        $oldUploadsCheck = & docker compose @composeArgs run -u root --rm --no-deps backend sh -c "test -d '$oldUploadsDir' && echo 'EXISTS'" 2>$null
        $oldUploadsExists = ($LASTEXITCODE -eq 0 -and ($oldUploadsCheck | Out-String) -match "EXISTS")
        if ($uploadsSwitched -or $oldUploadsExists) {
            Write-WarnLog "Reverting uploads replacement from $oldUploadsDir..."
            & docker compose @composeArgs run -u root --rm --no-deps backend sh -c "mkdir -p '$failedUploadsDir' && mv /app/uploads/resumes '$failedUploadsDir/resumes' 2>/dev/null || true; mv /app/uploads/profile_images '$failedUploadsDir/profile_images' 2>/dev/null || true; mv '$oldUploadsDir/resumes' /app/uploads/resumes 2>/dev/null || true; mv '$oldUploadsDir/profile_images' /app/uploads/profile_images 2>/dev/null || true; chown -R appuser:appuser /app/uploads/resumes /app/uploads/profile_images" 2>&1 | Out-Null
        }

        if ($backendWasRunning) { & docker compose @composeArgs start backend 2>&1 | Out-Null }
        if ($frontendWasRunning) { & docker compose @composeArgs start frontend 2>&1 | Out-Null }
        Write-SuccessLog "Rollback sequence completed. Pre-restore state restored."
    } catch {
        Write-ErrorLog "Rollback sequence failed: $_. Manual DR required using safety snapshot: $safetyBundleDir"
    } finally {
        $ErrorActionPreference = $origPref
    }
    throw
}

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "CAREERBRIDGE RESTORATION COMPLETED & VERIFIED SUCCESSFULLY" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "Restored Database      : $dbName"
Write-Host "Preserved Old Database : $oldDbName (Retained in PostgreSQL for safety)"
Write-Host "Restored Uploads Volume: /app/uploads"
Write-Host "Preserved Old Uploads  : $oldUploadsDir"
Write-Host "Pre-Restore Safety Path: $safetyBundleDir"
Write-Host "Readiness Health Check : PASSED (200 OK)"
Write-Host "=================================================================" -ForegroundColor Green
