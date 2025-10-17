# V2rayZ Release Build Script
# This script builds the complete application for release

param(
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [ValidateSet("SelfContained", "FrameworkDependent")]
    [string]$DeploymentMode = "SelfContained",
    [string]$OutputDir = ".\publish"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "V2rayZ Release Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean previous builds
Write-Host "[1/5] Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path $OutputDir) {
    Remove-Item -Path $OutputDir -Recurse -Force
    Write-Host "  ✓ Cleaned output directory" -ForegroundColor Green
}

# Step 2: Build frontend
Write-Host ""
Write-Host "[2/5] Building frontend (React + Vite)..." -ForegroundColor Yellow
Push-Location V2rayClient.UI
try {
    # Install dependencies if needed
    if (-not (Test-Path "node_modules")) {
        Write-Host "  Installing npm dependencies..." -ForegroundColor Gray
        npm install
    }
    
    # Build production version
    Write-Host "  Building production bundle..." -ForegroundColor Gray
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend build failed"
    }
    
    Write-Host "  ✓ Frontend built successfully" -ForegroundColor Green
}
finally {
    Pop-Location
}

# Step 3: Download v2ray-core resources (if not present)
Write-Host ""
Write-Host "[3/5] Checking v2ray-core resources..." -ForegroundColor Yellow
if (-not (Test-Path "V2rayClient\Resources\v2ray.exe")) {
    Write-Host "  Downloading v2ray-core resources..." -ForegroundColor Gray
    & .\download-resources.ps1
    if ($LASTEXITCODE -ne 0) {
        throw "Resource download failed"
    }
}
Write-Host "  ✓ Resources ready" -ForegroundColor Green

# Step 4: Publish .NET application
Write-Host ""
Write-Host "[4/5] Publishing .NET application..." -ForegroundColor Yellow

$publishArgs = @(
    "publish"
    "V2rayClient\V2rayClient.csproj"
    "-c", $Configuration
    "-r", $Runtime
    "-o", $OutputDir
    "--no-self-contained:$($DeploymentMode -eq 'FrameworkDependent')"
    "-p:PublishSingleFile=true"
    "-p:IncludeNativeLibrariesForSelfContained=true"
    "-p:PublishReadyToRun=true"
    "-p:PublishTrimmed=false"
)

Write-Host "  Configuration: $Configuration" -ForegroundColor Gray
Write-Host "  Runtime: $Runtime" -ForegroundColor Gray
Write-Host "  Deployment: $DeploymentMode" -ForegroundColor Gray
Write-Host "  Output: $OutputDir" -ForegroundColor Gray
Write-Host ""

& dotnet @publishArgs

if ($LASTEXITCODE -ne 0) {
    throw ".NET publish failed"
}

Write-Host "  ✓ Application published successfully" -ForegroundColor Green

# Step 5: Verify build
Write-Host ""
Write-Host "[5/5] Verifying build..." -ForegroundColor Yellow

$exePath = Join-Path $OutputDir "V2rayZ.exe"
$wwwrootPath = Join-Path $OutputDir "wwwroot"
$resourcesPath = Join-Path $OutputDir "Resources"

$checks = @(
    @{ Path = $exePath; Name = "Main executable" }
    @{ Path = $wwwrootPath; Name = "Frontend files" }
    @{ Path = $resourcesPath; Name = "V2ray resources" }
    @{ Path = (Join-Path $resourcesPath "v2ray.exe"); Name = "v2ray.exe" }
    @{ Path = (Join-Path $resourcesPath "geoip.dat"); Name = "geoip.dat" }
    @{ Path = (Join-Path $resourcesPath "geosite.dat"); Name = "geosite.dat" }
)

$allChecksPass = $true
foreach ($check in $checks) {
    if (Test-Path $check.Path) {
        Write-Host "  ✓ $($check.Name)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $($check.Name) - MISSING" -ForegroundColor Red
        $allChecksPass = $false
    }
}

if (-not $allChecksPass) {
    throw "Build verification failed - some files are missing"
}

# Display build summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Build Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$buildSize = (Get-ChildItem -Path $OutputDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "Output Directory: $OutputDir" -ForegroundColor White
Write-Host "Total Size: $([math]::Round($buildSize, 2)) MB" -ForegroundColor White
Write-Host "Deployment Mode: $DeploymentMode" -ForegroundColor White
Write-Host ""
Write-Host "✓ Release build completed successfully!" -ForegroundColor Green
Write-Host ""

if ($DeploymentMode -eq "FrameworkDependent") {
    Write-Host "NOTE: This build requires .NET 8 Runtime to be installed on target machines." -ForegroundColor Yellow
    Write-Host "      Download from: https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor Yellow
}
