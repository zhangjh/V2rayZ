# Project Structure

## Root Directory
```
V2rayClient/                 # Main WPF application project
V2rayClient.UI/              # React frontend project
V2rayClient.sln              # Visual Studio solution file
publish/                     # Build output directory
installer-output/            # Installer build output
```

## Backend Structure (`V2rayClient/`)
```
Bridge/                      # JavaScript bridge for WebView2 communication
Models/                      # Data models and DTOs
Services/                    # Core business logic services
ViewModels/                  # MVVM view models
Resources/                   # Static resources (icons, v2ray binaries)
wwwroot/                     # Frontend build output (generated)
Properties/                  # Assembly info and settings
MainWindow.xaml(.cs)         # Main application window
App.xaml(.cs)               # Application entry point
V2rayClient.csproj          # Project file
```

## Frontend Structure (`V2rayClient.UI/`)
```
src/
  components/                # React components
    ui/                      # Base UI components (shadcn/ui)
    settings/                # Settings-related components
    rules/                   # Routing rules components
  lib/                       # Utility functions
  hooks/                     # Custom React hooks
  stores/                    # Zustand state stores
  types/                     # TypeScript type definitions
public/                      # Static assets
dist/                        # Build output (generated)
```

## Key Architecture Patterns

### Service Layer Pattern
- Services in `V2rayClient/Services/` handle core functionality
- Dependency injection planned (currently manual instantiation)
- Services: V2rayManager, ConfigurationManager, SystemProxyManager, etc.

### MVVM Pattern
- ViewModels in `V2rayClient/ViewModels/` for data binding
- Models in `V2rayClient/Models/` for data structures
- Views are WPF XAML + embedded React

### Bridge Pattern
- `V2rayClient/Bridge/NativeApi.cs` provides JavaScript bridge
- Exposes .NET services to React frontend via WebView2
- Event system for real-time updates between layers

### Component Architecture (Frontend)
- Atomic design principles with shadcn/ui base components
- Feature-based component organization
- Zustand for state management with TypeScript

## Build Artifacts
- `publish/V2rayClient.exe` - Main executable
- `publish/wwwroot/` - Embedded React app
- `publish/Resources/` - V2ray binaries and geo data
- `installer-output/*.exe` - Windows installer package

## Configuration Files
- `V2rayClient.UI/vite.config.ts` - Frontend build configuration
- `V2rayClient/V2rayClient.csproj` - Backend project configuration
- `installer.iss` - Inno Setup installer script
- Various PowerShell scripts for build automation