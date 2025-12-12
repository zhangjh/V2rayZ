# Technology Stack

## Backend (.NET)
- **Framework**: .NET 8 WPF with Windows Forms integration
- **UI Framework**: WPF with WebView2 for React embedding
- **Logging**: Serilog with file sinks
- **Serialization**: System.Text.Json
- **Communication**: gRPC for v2ray API communication
- **Dependencies**:
  - Microsoft.Web.WebView2 (1.0.2739.15)
  - Serilog ecosystem
  - Grpc.Net.Client & Google.Protobuf

## Frontend (React)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **UI Components**: Radix UI primitives with shadcn/ui
- **Styling**: Tailwind CSS with tailwindcss-animate
- **State Management**: Zustand
- **Form Handling**: React Hook Form with Zod validation
- **Icons**: Lucide React
- **Notifications**: Sonner

## Build System & Commands

### Complete Rebuild (Recommended)
```powershell
.\clean-rebuild.ps1
```
This script performs a complete clean rebuild of both frontend and backend.

### Individual Build Steps
```powershell
# Frontend only
cd V2rayClient.UI
npm install
npm run build

# Backend only
dotnet publish V2rayClient\V2rayClient.csproj -c Release -r win-x64 -o .\publish

# Release build
.\publish-release.ps1

# Build installer (requires Inno Setup)
.\build-installer.ps1
```

### Development
```powershell
# Frontend development server
cd V2rayClient.UI
npm run dev

# Linting
npm run lint
```

## Build Configuration
- **Frontend Output**: `V2rayClient/wwwroot` (copied from `V2rayClient.UI/dist`)
- **Backend Output**: `publish/` directory
- **Installer Output**: `installer-output/` directory
- **Self-contained deployment** with single-file publishing
- **WebView2 virtual host mapping** for local React app serving