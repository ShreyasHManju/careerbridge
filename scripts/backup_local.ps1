<#
.SYNOPSIS
    CareerBridge - Windows-First Local Backup Tool (Quiesced & Binary-Safe)
.DESCRIPTION
    Creates an atomic, consistent, SHA-256 verified backup bundle containing
    PostgreSQL logical database snapshot and /app/uploads storage volume.
    Safely suspends application ingress to ensure zero-drift cross-system consistency
    and guarantees service resumption in finally block.
.PARAMETER ComposeFile
    Path to target Docker Compose file. Defaults to .\docker-compose.production.yml.
.PARAMETER EnvFile
    Path to environment file. Defaults to .\.env.
.PARAMETER BackupDir
    Output directory for backup bundles. Defaults to .\local-backups.
.PARAMETER DbOnly
    If specified, backs up database records only.
.PARAMETER UploadsOnly
    If specified, backs up uploaded files only.
.PARAMETER NoQuiesce
    If specified, skips stopping backend/frontend (hot live backup with potential drift).
.PARAMETER ProjectName
    Optional explicit Docker Compose project name override.
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [string]$ComposeFile = ".\docker-compose.production.yml",

    [Parameter(Mandatory = $false)]
    [string]$EnvFile = ".\.env",

    [Parameter(Mandatory = $false)]
    [string]$BackupDir = ".\local-backups",

    [Parameter(Mandatory = $false)]
    [switch]$DbOnly,

    [Parameter(Mandatory = $false)]
    [switch]$UploadsOnly,

    [Parameter(Mandatory = $false)]
    [switch]$NoQuiesce,

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

# 1. Pre-flight Path and Binary Checks
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI is not available in PATH. Ensure Docker Desktop is installed and running."
}
if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
    throw "tar CLI is not available in PATH. Ensure tar (bsdtar/tar.exe) is available."
}

Invoke-NativeCli "Docker daemon check" { docker info --format '{{.ServerVersion}}' | Out-Null }

$resolvedCompose = Resolve-Path $ComposeFile -ErrorAction SilentlyContinue
if (-not $resolvedCompose -or -not (Test-Path $resolvedCompose)) {
    throw "Compose file not found at: $ComposeFile"
}
$resolvedCompose = $resolvedCompose.Path

$resolvedEnv = Resolve-Path $EnvFile -ErrorAction SilentlyContinue
$hasEnv = [bool]($resolvedEnv -and (Test-Path $resolvedEnv))
$resolvedEnv = if ($hasEnv) { $resolvedEnv.Path } else { $null }

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}
$resolvedBackupDir = (Resolve-Path $BackupDir).Path

# 2. Compose Target Discovery & Parameter Extraction
$composeArgs = @("-f", $resolvedCompose)
if ($resolvedEnv) {
    $composeArgs += @("--env-file", $resolvedEnv)
}
if ($ProjectName) {
    $composeArgs += @("-p", $ProjectName)
}

Write-InfoLog "Resolving target stack configuration..."
$configJsonRaw = & docker compose @composeArgs config --format json
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($configJsonRaw)) {
    throw "Failed to parse Docker Compose configuration."
}
$configObj = $configJsonRaw | ConvertFrom-Json

$discoveredProject = if ($ProjectName) { $ProjectName } elseif ($configObj.name) { $configObj.name } else { (Split-Path (Split-Path $resolvedCompose -Parent) -Leaf).ToLower() }
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

$dbContainer = $containers | Where-Object { $_.Service -eq "db" } | Select-Object -First 1
$backendContainer = $containers | Where-Object { $_.Service -eq "backend" } | Select-Object -First 1
$frontendContainer = $containers | Where-Object { $_.Service -eq "frontend" } | Select-Object -First 1

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

# Discover Database Name and User dynamically
$dbUser = "postgres"
$dbName = "internship_db"
if ($configObj.services.db.environment.POSTGRES_USER) {
    $dbUser = $configObj.services.db.environment.POSTGRES_USER
}
if ($configObj.services.db.environment.POSTGRES_DB) {
    $dbName = $configObj.services.db.environment.POSTGRES_DB
}

# 3. Capture Initial Running State
$backendWasRunning = ($backendInspect.State.Status -eq "running")
$frontendWasRunning = ($frontendContainer -and ((docker inspect $frontendContainer.ID | ConvertFrom-Json)[0].State.Status -eq "running"))
$dbWasRunning = ($dbInspect.State.Status -eq "running")

if (-not $dbWasRunning) {
    Write-WarnLog "PostgreSQL 'db' service is currently stopped. Starting 'db' container for backup..."
    & docker compose @composeArgs start db
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to start database container."
    }
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$bundleDir = Join-Path $resolvedBackupDir "careerbridge_backup_$timestamp"
New-Item -ItemType Directory -Path $bundleDir -Force | Out-Null

$quiesced = $false
$backupSucceeded = $false

try {
    # 4. Quiescence Lifecycle
    if (-not $NoQuiesce) {
        Write-InfoLog "Entering maintenance quiescence window (suspending backend & frontend traffic)..."
        if ($frontendWasRunning) {
            & docker compose @composeArgs stop frontend
        }
        if ($backendWasRunning) {
            & docker compose @composeArgs stop backend
        }
        $quiesced = $true

        Write-InfoLog "Verifying PostgreSQL active client connection draining..."
        $drained = $false
        for ($i = 0; $i -lt 10; $i++) {
            $connCountRaw = & docker compose @composeArgs exec -T db psql -U $dbUser -d postgres -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname = '$dbName' AND pid <> pg_backend_pid();"
            if ($LASTEXITCODE -eq 0) {
                $count = 0
                if ([int]::TryParse($connCountRaw.Trim(), [ref]$count) -and $count -eq 0) {
                    $drained = $true
                    break
                }
            }
            Start-Sleep -Seconds 1
        }
        if (-not $drained) {
            throw "PostgreSQL connection draining timed out. Active client transactions remain."
        }
        Write-InfoLog "Database connections successfully drained (0 active client sessions)."
    } else {
        Write-WarnLog "Running LIVE backup without quiescence. Consistency across concurrent writes is best-effort."
    }

    # 5. Database Backup
    $dbManifest = $null
    if (-not $UploadsOnly) {
        Write-InfoLog "Capturing PostgreSQL database snapshot for '$dbName'..."
        Invoke-NativeCli "pg_dump database snapshot" {
            docker compose @composeArgs exec -T db pg_dump -U $dbUser -d $dbName --clean --if-exists --no-owner --no-privileges -f /tmp/cb_backup_db.sql
        }

        $hostDbFile = Join-Path $bundleDir "database.sql"
        Invoke-NativeCli "Binary copy database.sql" {
            docker cp "${dbContainerId}:/tmp/cb_backup_db.sql" $hostDbFile
        }

        & docker compose @composeArgs exec -T db rm -f /tmp/cb_backup_db.sql

        $dbItem = Get-Item $hostDbFile
        if ($dbItem.Length -le 0) {
            throw "Generated database.sql is empty."
        }
        $dbHash = (Get-FileHash -Path $hostDbFile -Algorithm SHA256).Hash.ToLower()
        $dbManifest = [PSCustomObject]@{
            file = "database.sql"
            size_bytes = $dbItem.Length
            sha256 = $dbHash
        }
        Write-SuccessLog "Database dump captured ($($dbItem.Length) bytes, SHA256: $dbHash)"
    }

    # 6. Uploads Volume Backup
    $uploadsManifest = $null
    if (-not $DbOnly) {
        Write-InfoLog "Capturing /app/uploads storage volume snapshot (quiescence-safe binary copy)..."
        $tempUploadsHost = Join-Path $bundleDir ".tmp_uploads"
        New-Item -ItemType Directory -Path (Join-Path $tempUploadsHost "resumes") -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $tempUploadsHost "profile_images") -Force | Out-Null

        Invoke-NativeCli "Binary copy uploads from container" {
            docker cp "${backendContainerId}:/app/uploads/." $tempUploadsHost
        }

        if (-not (Test-Path (Join-Path $tempUploadsHost "resumes"))) {
            New-Item -ItemType Directory -Path (Join-Path $tempUploadsHost "resumes") -Force | Out-Null
        }
        if (-not (Test-Path (Join-Path $tempUploadsHost "profile_images"))) {
            New-Item -ItemType Directory -Path (Join-Path $tempUploadsHost "profile_images") -Force | Out-Null
        }

        $hostUploadsFile = Join-Path $bundleDir "uploads.tar.gz"
        Invoke-NativeCli "tar archive creation" {
            tar.exe -czf $hostUploadsFile -C $tempUploadsHost resumes profile_images
        }

        Remove-Item -Path $tempUploadsHost -Recurse -Force -ErrorAction SilentlyContinue

        $upItem = Get-Item $hostUploadsFile
        if ($upItem.Length -le 0) {
            throw "Generated uploads.tar.gz is empty."
        }
        $upHash = (Get-FileHash -Path $hostUploadsFile -Algorithm SHA256).Hash.ToLower()
        $uploadsManifest = [PSCustomObject]@{
            file = "uploads.tar.gz"
            size_bytes = $upItem.Length
            sha256 = $upHash
        }
        Write-SuccessLog "Uploads archive captured ($($upItem.Length) bytes, SHA256: $upHash)"
    }

    # 7. Checksums and Manifest Generation
    Write-InfoLog "Generating SHA-256 checksums and manifest..."
    $checksumLines = @()
    if ($dbManifest) {
        $checksumLines += "$($dbManifest.sha256)  database.sql"
    }
    if ($uploadsManifest) {
        $checksumLines += "$($uploadsManifest.sha256)  uploads.tar.gz"
    }
    Set-Content -Path (Join-Path $bundleDir "checksums.sha256") -Value ($checksumLines -join "`n") -Encoding ASCII

    $manifestObj = [PSCustomObject]@{
        manifest_version = "1.0"
        created_at_utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        project_name = $discoveredProject
        compose_file = $resolvedCompose
        quiescence_mode = if ($quiesced) { "quiesced" } else { "live" }
        target_database = $dbName
        database = $dbManifest
        uploads = $uploadsManifest
    }
    $manifestJson = $manifestObj | ConvertTo-Json -Depth 5
    Set-Content -Path (Join-Path $bundleDir "manifest.json") -Value $manifestJson -Encoding UTF8

    $backupSucceeded = $true
} catch {
    Write-ErrorLog "Backup failed: $_"
    if (-not $backupSucceeded -and (Test-Path $bundleDir)) {
        Write-WarnLog "Cleaning up incomplete backup bundle: $bundleDir"
        Remove-Item -Path $bundleDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    throw
} finally {
    # 8. Guaranteed Service Resumption
    if ($quiesced) {
        Write-InfoLog "Restoring original service execution state..."
        if ($backendWasRunning) {
            & docker compose @composeArgs start backend
        }
        if ($frontendWasRunning) {
            & docker compose @composeArgs start frontend
        }
        if (-not $dbWasRunning) {
            & docker compose @composeArgs stop db
        }
    }
}

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "CAREERBRIDGE LOCAL BACKUP COMPLETED SUCCESSFULLY" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "Bundle Directory : $bundleDir"
Write-Host "Project Name     : $discoveredProject"
Write-Host "Quiescence Mode  : $(if ($quiesced) { 'Quiesced (100% Consistent)' } else { 'Live' })"
if ($dbManifest) {
    Write-Host "Database Snapshot: database.sql ($($dbManifest.size_bytes) bytes)"
}
if ($uploadsManifest) {
    Write-Host "Uploads Archive  : uploads.tar.gz ($($uploadsManifest.size_bytes) bytes)"
}
Write-Host "Checksum File    : checksums.sha256"
Write-Host "Manifest File    : manifest.json"
Write-Host "=================================================================" -ForegroundColor Green
