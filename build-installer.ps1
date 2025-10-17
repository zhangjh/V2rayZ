# V2rayZ Installer Build Script
# This script builds the Windows installer using Inno Setup

param(
    [string]$InnoSetupPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    [string]$PublishDir = ".\publish",
    [switch]$BuildRelease = $false
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "V2rayZ Installer Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if Inno Setup is installed
Write-Host "[1/5] Checking Inno Setup installation..." -ForegroundColor Yellow

if (-not (Test-Path $InnoSetupPath)) {
    Write-Host ""
    Write-Host "Error: Inno Setup not found at: $InnoSetupPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Inno Setup 6 from:" -ForegroundColor Yellow
    Write-Host "  https://jrsoftware.org/isdl.php" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or specify the correct path using -InnoSetupPath parameter" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternative: Use the GUI version of Inno Setup Compiler" -ForegroundColor Yellow
    Write-Host "  1. Open Inno Setup Compiler" -ForegroundColor Gray
    Write-Host "  2. Open installer.iss" -ForegroundColor Gray
    Write-Host "  3. Click Build > Compile" -ForegroundColor Gray
    exit 1
}

Write-Host "  ✓ Inno Setup found: $InnoSetupPath" -ForegroundColor Green

# Step 2: Build release if requested
if ($BuildRelease) {
    Write-Host ""
    Write-Host "[2/5] Building release..." -ForegroundColor Yellow
    & .\publish-release.ps1 -DeploymentMode SelfContained -OutputDir $PublishDir
    
    if ($LASTEXITCODE -ne 0) {
        throw "Release build failed"
    }
    
    Write-Host "  ✓ Release built successfully" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[2/5] Skipping release build (using existing publish directory)" -ForegroundColor Yellow
    Write-Host "  Use -BuildRelease to build before creating installer" -ForegroundColor Gray
}

# Step 3: Verify publish directory
Write-Host ""
Write-Host "[3/5] Verifying publish directory..." -ForegroundColor Yellow

if (-not (Test-Path $PublishDir)) {
    Write-Host ""
    Write-Host "Error: Publish directory not found: $PublishDir" -ForegroundColor Red
    Write-Host "Please run publish-release.ps1 first or use -BuildRelease parameter" -ForegroundColor Yellow
    exit 1
}

$requiredFiles = @(
    "V2rayZ.exe",
    "wwwroot\index.html",
    "Resources\v2ray.exe"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    $fullPath = Join-Path $PublishDir $file
    if (-not (Test-Path $fullPath)) {
        $missingFiles += $file
        Write-Host "  ✗ Missing: $file" -ForegroundColor Red
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "Error: Required files are missing from publish directory" -ForegroundColor Red
    Write-Host "Please run publish-release.ps1 to build the application first" -ForegroundColor Yellow
    exit 1
}

Write-Host "  ✓ All required files present" -ForegroundColor Green

# Step 4: Build installer
Write-Host ""
Write-Host "[4/5] Building installer with Inno Setup..." -ForegroundColor Yellow

$issFile = "installer.iss"
if (-not (Test-Path $issFile)) {
    Write-Host ""
    Write-Host "Error: Installer script not found: $issFile" -ForegroundColor Red
    exit 1
}

Write-Host "  Compiling installer script..." -ForegroundColor Gray
Write-Host "  Script: $issFile" -ForegroundColor Gray

# Run Inno Setup compiler
$process = Start-Process -FilePath $InnoSetupPath -ArgumentList $issFile -Wait -PassThru -NoNewWindow

if ($process.ExitCode -ne 0) {
    Write-Host ""
    Write-Host "Error: Inno Setup compilation failed with exit code: $($process.ExitCode)" -ForegroundColor Red
    exit 1
}

Write-Host "  ✓ Installer compiled successfully" -ForegroundColor Green

# Step 5: Verify installer output
Write-Host ""
Write-Host "[5/5] Verifying installer output..." -ForegroundColor Yellow

$installerDir = "installer-output"
if (-not (Test-Path $installerDir)) {
    Write-Host ""
    Write-Host "Error: Installer output directory not found: $installerDir" -ForegroundColor Red
    exit 1
}

$installerFiles = Get-ChildItem -Path $installerDir -Filter "*.exe"
if ($installerFiles.Count -eq 0) {
    Write-Host ""
    Write-Host "Error: No installer executable found in output directory" -ForegroundColor Red
    exit 1
}

$installerFile = $installerFiles[0]
$installerSize = [math]::Round($installerFile.Length / 1MB, 2)

Write-Host "  ✓ Installer created: $($installerFile.Name)" -ForegroundColor Green
Write-Host "  Size: $installerSize MB" -ForegroundColor Gray
Write-Host "  Path: $($installerFile.FullName)" -ForegroundColor Gray

# Display summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installer Build Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installer File: $($installerFile.Name)" -ForegroundColor White
Write-Host "Size: $installerSize MB" -ForegroundColor White
Write-Host "Location: $installerDir\" -ForegroundColor White
Write-Host ""
Write-Host "✓ Installer build completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Test the installer on a clean Windows machine" -ForegroundColor Gray
Write-Host "  2. Verify installation and uninstallation work correctly" -ForegroundColor Gray
Write-Host "  3. Test the installed application" -ForegroundColor Gray
Write-Host "  4. (Optional) Sign the installer with a code signing certificate" -ForegroundColor Gray
Write-Host "  5. Distribute the installer" -ForegroundColor Gray
Write-Host ""
