# Complete Clean and Rebuild Script
# This script performs a complete clean rebuild of the entire application

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Complete Clean and Rebuild" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 0: Verify resources
Write-Host "[0/7] Verifying required resources..." -ForegroundColor Yellow

$requiredResources = @(
    "V2rayClient\Resources\sing-box.exe",
    "V2rayClient\Resources\wintun.dll",
    "V2rayClient\Resources\geoip.dat",
    "V2rayClient\Resources\geosite.dat"
)

$missingResources = @()
foreach ($resource in $requiredResources) {
    if (-not (Test-Path $resource)) {
        $missingResources += $resource
        Write-Host "  ✗ Missing: $resource" -ForegroundColor Red
    } else {
        Write-Host "  ✓ Found: $resource" -ForegroundColor Green
    }
}

if ($missingResources.Count -gt 0) {
    Write-Host ""
    Write-Host "ERROR: Missing required resources!" -ForegroundColor Red
    Write-Host "Please run .\verify-resources.ps1 for more information" -ForegroundColor Yellow
    exit 1
}

Write-Host "  ✓ All required resources present" -ForegroundColor Green

# Step 1: Clean all build artifacts
Write-Host ""
Write-Host "[1/7] Cleaning all build artifacts..." -ForegroundColor Yellow

$pathsToClean = @(
    "publish",
    "installer-output",
    "V2rayClient\bin",
    "V2rayClient\obj",
    "V2rayClient\wwwroot",
    "V2rayClient.UI\dist",
    "V2rayClient.UI\node_modules\.vite"
)

foreach ($path in $pathsToClean) {
    if (Test-Path $path) {
        Write-Host "  Removing $path..." -ForegroundColor Gray
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "  ✓ Build artifacts cleaned" -ForegroundColor Green

# Step 2: Clean npm cache
Write-Host ""
Write-Host "[2/7] Cleaning npm cache..." -ForegroundColor Yellow
Push-Location V2rayClient.UI
try {
    if (Test-Path "node_modules\.vite") {
        Remove-Item -Path "node_modules\.vite" -Recurse -Force
    }
    Write-Host "  ✓ npm cache cleaned" -ForegroundColor Green
}
finally {
    Pop-Location
}

# Step 3: Rebuild frontend
Write-Host ""
Write-Host "[3/7] Rebuilding frontend..." -ForegroundColor Yellow
Push-Location V2rayClient.UI
try {
    Write-Host "  Running npm install..." -ForegroundColor Gray
    npm install
    
    Write-Host "  Running npm build..." -ForegroundColor Gray
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend build failed"
    }
    
    Write-Host "  ✓ Frontend rebuilt successfully" -ForegroundColor Green
}
finally {
    Pop-Location
}

# Step 4: Verify frontend build
Write-Host ""
Write-Host "[4/7] Verifying frontend build..." -ForegroundColor Yellow

$wwwrootPath = "V2rayClient\wwwroot"
$indexPath = Join-Path $wwwrootPath "index.html"

if (Test-Path $indexPath) {
    Write-Host "  ✓ Frontend files present" -ForegroundColor Green
    
    # Check if the latest changes are included
    $jsFiles = Get-ChildItem -Path (Join-Path $wwwrootPath "assets") -Filter "*.js"
    if ($jsFiles.Count -gt 0) {
        $latestJs = $jsFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        Write-Host "  Latest JS: $($latestJs.Name)" -ForegroundColor Gray
        Write-Host "  Modified: $($latestJs.LastWriteTime)" -ForegroundColor Gray
    }
} else {
    throw "Frontend build verification failed - index.html not found"
}

# Step 5: Clean .NET build
Write-Host ""
Write-Host "[5/7] Cleaning .NET build..." -ForegroundColor Yellow

dotnet clean V2rayClient\V2rayClient.csproj -c Release

Write-Host "  ✓ .NET build cleaned" -ForegroundColor Green

# Step 6: Publish application
Write-Host ""
Write-Host "[6/7] Publishing application..." -ForegroundColor Yellow

& .\publish-release.ps1

if ($LASTEXITCODE -ne 0) {
    throw "Publish failed"
}

# Step 7: Verify final build
Write-Host ""
Write-Host "[7/7] Verifying final build..." -ForegroundColor Yellow

$publishResourcesPath = "publish\Resources"
$verifyResources = @(
    @{ Path = "publish\V2rayZ.exe"; Name = "Main executable" }
    @{ Path = "publish\wwwroot\index.html"; Name = "Frontend files" }
    @{ Path = "$publishResourcesPath\sing-box.exe"; Name = "sing-box.exe" }
    @{ Path = "$publishResourcesPath\wintun.dll"; Name = "wintun.dll" }
    @{ Path = "$publishResourcesPath\geoip.dat"; Name = "geoip.dat" }
    @{ Path = "$publishResourcesPath\geosite.dat"; Name = "geosite.dat" }
)

$verifyFailed = $false
foreach ($item in $verifyResources) {
    if (Test-Path $item.Path) {
        Write-Host "  ✓ $($item.Name)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $($item.Name) - MISSING" -ForegroundColor Red
        $verifyFailed = $true
    }
}

if ($verifyFailed) {
    Write-Host ""
    Write-Host "WARNING: Some files are missing from the build output!" -ForegroundColor Yellow
    Write-Host "The application may not work correctly." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ Complete rebuild finished!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Output directory: .\publish" -ForegroundColor White
Write-Host "Executable: .\publish\V2rayZ.exe" -ForegroundColor White
Write-Host ""
Write-Host "You can now run the application:" -ForegroundColor Yellow
Write-Host "  .\publish\V2rayZ.exe" -ForegroundColor Cyan
Write-Host ""
