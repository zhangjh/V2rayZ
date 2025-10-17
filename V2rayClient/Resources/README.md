# V2rayZ Resources

This directory contains the necessary binary files and data files for the V2rayZ application.

## Required Files

The following files are required for the application to run:

1. **v2ray.exe** - The v2ray-core executable for Windows
2. **geoip.dat** - GeoIP database for IP-based routing rules
3. **geosite.dat** - GeoSite database for domain-based routing rules

## Downloading Resources

To download the required resources, run the following PowerShell script from the project root:

```powershell
.\download-resources.ps1
```

This script will:
- Download the latest v2ray-core release for Windows
- Extract v2ray.exe, geoip.dat, and geosite.dat
- Place them in this directory

## Manual Download

If you prefer to download manually:

1. **v2ray-core**: Download from [v2fly/v2ray-core releases](https://github.com/v2fly/v2ray-core/releases)
   - Download `v2ray-windows-64.zip`
   - Extract `v2ray.exe`, `geoip.dat`, and `geosite.dat` to this directory

## Resource Extraction

On first run, the application will automatically:
1. Copy these files from the Resources directory to `%APPDATA%\V2rayZ\resources\`
2. Use the files from AppData for runtime operations
3. Update the files if newer versions are detected

## File Sizes

Typical file sizes:
- v2ray.exe: ~15-20 MB
- geoip.dat: ~3-5 MB
- geosite.dat: ~2-3 MB

## Notes

- These files are excluded from version control due to their size
- Developers must download them before building/running the application
- The download script should be run after cloning the repository
