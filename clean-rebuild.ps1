# Complete Clean and Rebuild Script
# This script performs a complete clean rebuild of the entire application

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Complete Clean and Rebuild" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean all build artifacts
Write-Host "[1/6] Cleaning all build artifacts..." -ForegroundColor Yellow

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
Write-Host "[2/6] Cleaning npm cache..." -ForegroundColor Yellow
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
Write-Host "[3/6] Rebuilding frontend..." -ForegroundColor Yellow
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
Write-Host "[4/6] Verifying frontend build..." -ForegroundColor Yellow

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
Write-Host "[5/6] Cleaning .NET build..." -ForegroundColor Yellow

dotnet clean V2rayClient\V2rayClient.csproj -c Release

Write-Host "  ✓ .NET build cleaned" -ForegroundColor Green

# Step 6: Publish application
Write-Host ""
Write-Host "[6/6] Publishing application..." -ForegroundColor Yellow

& .\publish-release.ps1

if ($LASTEXITCODE -ne 0) {
    throw "Publish failed"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ Complete rebuild finished!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Output directory: .\publish" -ForegroundColor White
Write-Host "Executable: .\publish\V2rayClient.exe" -ForegroundColor White
Write-Host ""
Write-Host "You can now run the application:" -ForegroundColor Yellow
Write-Host "  .\publish\V2rayClient.exe" -ForegroundColor Cyan
Write-Host ""
