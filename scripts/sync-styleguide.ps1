# sync-styleguide.ps1 - refresh the kit's vendored styleguide theme tokens.
#
# The kit vendors bepy_styleguide's palette theme files (the --color-* token
# source) under frontend/styleguide/themes/ so apps consume them offline with no
# runtime CDN. Re-run this after changing palette values in the styleguide.
#
# Only the theme token files are vendored - NOT styleguide.css (the styleguide's
# general components keep their own rich web look; the kit's settings widgets
# carry claude_usage's flat look directly). See the unified-component-look spec.
#
# Usage:  pwsh scripts/sync-styleguide.ps1 [-Source <path-to-bepy_styleguide>]

param([string]$Source = "C:\Users\tecno\Desktop\Projects\bepy_styleguide")

$ErrorActionPreference = "Stop"
$dest = Join-Path $PSScriptRoot "..\frontend\styleguide\themes"
New-Item -ItemType Directory -Force $dest | Out-Null

$srcThemes = Join-Path $Source "themes"
if (-not (Test-Path $srcThemes)) {
  throw "Styleguide themes not found at $srcThemes - pass -Source <path-to-bepy_styleguide>."
}

Get-ChildItem -Path $srcThemes -Filter "theme-*.css" | ForEach-Object {
  Copy-Item -Force $_.FullName $dest
  Write-Output "  synced $($_.Name)"
}
Write-Output "Synced styleguide themes from $Source"
