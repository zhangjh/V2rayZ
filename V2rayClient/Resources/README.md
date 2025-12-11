# V2rayZ Resources

This directory contains the necessary binary files and data files for the V2rayZ application.

## Required Files

The following files are required for the application to run:

### Core Executables
1. **sing-box.exe** - The sing-box core executable for Windows (unified core for all proxy modes)

### TUN Mode Support
2. **wintun.dll** - Windows TUN driver library (required for TUN mode)

### Routing Databases
3. **geoip.dat** - GeoIP database for IP-based routing rules
4. **geosite.dat** - GeoSite database for domain-based routing rules

### Optional Files
5. **tun2socks.exe** - TUN to SOCKS proxy (optional, for alternative TUN implementation)

## Downloading Resources

### Automated Download
To verify all required resources are present, run:

```powershell
.\verify-resources.ps1
```

### Manual Download

If you need to download manually:

1. **sing-box** (Required for all proxy modes): 
   - Download from [SagerNet/sing-box releases](https://github.com/SagerNet/sing-box/releases)
   - Download `sing-box-{version}-windows-amd64.zip`
   - Extract `sing-box.exe` to this directory
   - Also includes `geoip.db` and `geosite.db` (rename to `.dat` if needed)

2. **wintun.dll** (Required for TUN mode):
   - Download from [WireGuard Wintun](https://www.wintun.net/)
   - Download the latest release (e.g., `wintun-0.14.1.zip`)
   - Extract `wintun.dll` from `wintun/bin/amd64/` to this directory

## Resource Extraction

On first run, the application will automatically:
1. Copy these files from the Resources directory to `%APPDATA%\V2rayZ\resources\`
2. Use the files from AppData for runtime operations
3. Update the files if newer versions are detected

## File Sizes

Typical file sizes:
- sing-box.exe: ~15-20 MB
- wintun.dll: ~200-300 KB
- geoip.dat: ~3-5 MB
- geosite.dat: ~2-3 MB
- tun2socks.exe: ~5-10 MB (optional)

## Proxy Mode Requirements

### System Proxy Mode
- **sing-box.exe** - sing-box core executable
- **geoip.dat** and **geosite.dat** - Routing databases

### TUN Mode (Transparent Proxy)
- **sing-box.exe** - sing-box core executable
- **wintun.dll** - Windows TUN driver
- **geoip.dat** and **geosite.dat** - Routing databases
- **Administrator privileges** - TUN mode requires elevated permissions

All proxy modes now use sing-box as the unified core.

## Build Integration

The build scripts automatically:
1. Verify all required resources are present before building
2. Copy resources to the output directory (`publish/Resources/`)
3. Include resources in the installer package

To verify resources before building:
```powershell
.\verify-resources.ps1
```

## Notes

- These files are excluded from version control due to their size
- Developers must download them before building/running the application
- The verification script should be run after cloning the repository
- TUN mode requires wintun.dll and administrator privileges
- All proxy modes (System Proxy and TUN) now use sing-box as the unified core
