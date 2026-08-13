param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$workspace = Resolve-Path (Join-Path $PSScriptRoot "..")
$targets = New-Object System.Collections.Generic.List[string]

function Add-Target {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  $resolved = Resolve-Path -LiteralPath $Path
  if (-not $resolved.Path.StartsWith($workspace.Path, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove path outside workspace: $($resolved.Path)"
  }

  $targets.Add($resolved.Path)
}

$transientExtensions = @(".log", ".err", ".tmp", ".temp", ".cache")

Get-ChildItem -LiteralPath $workspace.Path -Force -File |
  Where-Object { $transientExtensions -contains $_.Extension.ToLowerInvariant() } |
  ForEach-Object { Add-Target $_.FullName }

Get-ChildItem -LiteralPath $workspace.Path -Force -Directory -Filter "captures-*" |
  ForEach-Object { Add-Target $_.FullName }

$outputTransientExtensions = @(".log", ".err")

Get-ChildItem -LiteralPath (Join-Path $workspace.Path "output") -Force -File -ErrorAction SilentlyContinue |
  Where-Object { $outputTransientExtensions -contains $_.Extension.ToLowerInvariant() } |
  ForEach-Object { Add-Target $_.FullName }

$oneOffScriptPatterns = @(
  "analyze_*",
  "backfill_*",
  "browser_backfill_*",
  "build_added_*",
  "build_remaining_*",
  "capture_extra_*",
  "capture_full_reproduction_evidence_*",
  "capture_new_*",
  "complete_*",
  "document_*_limitation_*",
  "fix_*",
  "recapture_*",
  "update_extra_*"
)

$scriptDir = Join-Path $workspace.Path "scripts"
foreach ($pattern in $oneOffScriptPatterns) {
  Get-ChildItem -LiteralPath $scriptDir -Force -File -Filter $pattern -ErrorAction SilentlyContinue |
    ForEach-Object { Add-Target $_.FullName }
}

$legacyOneOffScripts = @(
  "audit_evidence_forensic_20260713.mjs",
  "build_catalog.mjs",
  "build_public_library_platform_20260712.py",
  "ingest_approved_sites_20260713.mjs",
  "make_contact_sheet.py"
)

foreach ($scriptName in $legacyOneOffScripts) {
  Add-Target (Join-Path $scriptDir $scriptName)
}

foreach ($localStateDir in @(".agents", ".codex")) {
  $statePath = Join-Path $workspace.Path $localStateDir
  if (Test-Path -LiteralPath $statePath) {
    $hasChildren = Get-ChildItem -LiteralPath $statePath -Force -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $hasChildren) {
      Add-Target $statePath
    }
  }
}

$uniqueTargets = $targets | Sort-Object -Unique

if ($DryRun) {
  $uniqueTargets | ForEach-Object { "Would remove: $_" }
  "Total targets: $($uniqueTargets.Count)"
  exit 0
}

foreach ($target in $uniqueTargets) {
  Remove-Item -LiteralPath $target -Recurse -Force
  "Removed: $target"
}

"Total removed: $($uniqueTargets.Count)"
