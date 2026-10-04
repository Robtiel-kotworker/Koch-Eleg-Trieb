<#
.SYNOPSIS
  Downloads the entire Eleg-Trieb cloud sample library (manifest-driven) into a
  local folder, preserving the original folder structure.

.DESCRIPTION
  Reads the manifest (same one bundled with the app) and downloads every
  listed file from the public R2 bucket. Safe to re-run: files that already
  exist locally with a matching size are skipped, so an interrupted run can
  simply be started again. Failed downloads are logged to
  failed-downloads.log in the target folder instead of aborting the run.

.PARAMETER Folder
  Where to download files to. Defaults to ".\eleg-trieb-sample-library" in
  the current directory.

.PARAMETER Zip
  If set, creates a .zip of the downloaded folder once done. Off by default
  since it roughly doubles disk usage while it runs and can take a while for
  ~8.7 GB; you can always zip the folder yourself afterwards (right-click ->
  Send to -> Compressed folder).

.EXAMPLE
  .\download-sample-library.ps1
.EXAMPLE
  .\download-sample-library.ps1 -Folder "D:\Samples\EgelTrieb" -Zip
#>

param(
    [string]$Folder = (Join-Path (Get-Location) 'eleg-trieb-sample-library'),
    [switch]$Zip,
    [int]$MaxRetries = 3
)

$ErrorActionPreference = 'Stop'
# Invoke-WebRequest renders a progress bar per call by default, which is
# extremely slow across thousands of small requests - disable it.
$ProgressPreference = 'SilentlyContinue'

$ManifestUrl = 'https://raw.githubusercontent.com/Robtiel-kotworker/Koch-Eleg-Trieb/claude/electribe-2-clone-samples-1smdze/public/cloud-samples/manifest.json'
$InvalidChars = [System.IO.Path]::GetInvalidFileNameChars()

Write-Host "Ziel-Ordner: $Folder"
New-Item -ItemType Directory -Force -Path $Folder | Out-Null

Write-Host 'Lade Manifest...'
$manifest = Invoke-RestMethod -Uri $ManifestUrl
$baseUrl = $manifest.baseUrl
$files = $manifest.files
$total = $files.Count
Write-Host "Manifest geladen: $total Dateien, Basis-URL: $baseUrl"

function Get-SafeSegment([string]$segment) {
    $clean = $segment
    foreach ($c in $InvalidChars) {
        $clean = $clean.Replace([string]$c, '_')
    }
    return $clean
}

function Get-RemoteUrl([string]$key) {
    $segments = $key -split '/' | ForEach-Object { [System.Uri]::EscapeDataString($_) }
    return "$baseUrl/" + ($segments -join '/')
}

$logPath = Join-Path $Folder 'failed-downloads.log'
if (Test-Path $logPath) { Remove-Item $logPath }

$downloaded = 0
$skipped = 0
$failed = 0
$index = 0
$sw = [System.Diagnostics.Stopwatch]::StartNew()

foreach ($entry in $files) {
    $index++
    $key = $entry[0]
    $expectedSize = [int64]$entry[1]

    $segments = @($key -split '/' | ForEach-Object { Get-SafeSegment $_ })
    $localPath = $Folder
    foreach ($segment in $segments) {
        $localPath = Join-Path $localPath $segment
    }

    $localDir = Split-Path $localPath -Parent
    if (-not (Test-Path $localDir)) {
        New-Item -ItemType Directory -Force -Path $localDir | Out-Null
    }

    if ((Test-Path $localPath) -and ((Get-Item $localPath).Length -eq $expectedSize)) {
        $skipped++
    } else {
        $url = Get-RemoteUrl $key
        $attempt = 0
        $ok = $false
        while (-not $ok -and $attempt -lt $MaxRetries) {
            $attempt++
            try {
                Invoke-WebRequest -Uri $url -OutFile $localPath -UseBasicParsing
                $ok = $true
                $downloaded++
            } catch {
                if ($attempt -ge $MaxRetries) {
                    $failed++
                    "$key`t$($_.Exception.Message)" | Out-File -Append -FilePath $logPath -Encoding utf8
                } else {
                    Start-Sleep -Milliseconds 500
                }
            }
        }
    }

    if ($index % 100 -eq 0 -or $index -eq $total) {
        $pct = [math]::Round(100 * $index / $total, 1)
        Write-Host "[$index/$total, $pct%] neu: $downloaded, übersprungen: $skipped, fehlgeschlagen: $failed ($([math]::Round($sw.Elapsed.TotalMinutes,1)) min)"
    }
}

Write-Host ''
Write-Host '== Fertig =='
Write-Host "Neu heruntergeladen: $downloaded"
Write-Host "Übersprungen (schon vorhanden): $skipped"
Write-Host "Fehlgeschlagen: $failed"
if ($failed -gt 0) {
    Write-Host "Details zu Fehlern: $logPath"
    Write-Host 'Einfach das Skript erneut ausführen, um nur die fehlenden/fehlgeschlagenen Dateien nachzuladen.'
}

if ($Zip) {
    $zipPath = "$Folder.zip"
    Write-Host ''
    Write-Host "Erstelle ZIP: $zipPath (kann bei ~8,7 GB eine Weile dauern)..."
    if (Test-Path $zipPath) { Remove-Item $zipPath }
    Compress-Archive -Path "$Folder\*" -DestinationPath $zipPath -CompressionLevel Optimal
    Write-Host "ZIP erstellt: $zipPath"
}
