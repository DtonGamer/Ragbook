# Install Windsurf Rules for RAG Book Project
# This script copies rule files to the .windsurf/rules directory

Write-Host "Installing Windsurf Rules for RAG Book..." -ForegroundColor Cyan

# Create .windsurf/rules directory if it doesn't exist
$rulesDir = ".windsurf\rules"
if (-not (Test-Path $rulesDir)) {
    Write-Host "Creating $rulesDir directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $rulesDir -Force | Out-Null
}

# Copy all .md files except README from windsurf-rules to .windsurf/rules
$sourceDir = "windsurf-rules"
$ruleFiles = Get-ChildItem -Path $sourceDir -Filter "*.md" | Where-Object { $_.Name -ne "README.md" }

Write-Host "`nCopying rule files..." -ForegroundColor Yellow
foreach ($file in $ruleFiles) {
    $destination = Join-Path $rulesDir $file.Name
    Copy-Item -Path $file.FullName -Destination $destination -Force
    Write-Host "  ✓ Copied $($file.Name)" -ForegroundColor Green
}

Write-Host "`nInstallation complete!" -ForegroundColor Green
Write-Host "`nInstalled rules:" -ForegroundColor Cyan
Get-ChildItem -Path $rulesDir -Filter "*.md" | ForEach-Object {
    Write-Host "  - $($_.Name)" -ForegroundColor White
}

Write-Host "`nRules are now active in Windsurf Cascade!" -ForegroundColor Green
Write-Host "You can manage them via the Customizations icon in Cascade." -ForegroundColor Gray
