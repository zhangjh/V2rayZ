# V2rayZ UI

React + TypeScript + Vite + Tailwind CSS + shadcn/ui frontend for V2rayZ.

## Development

### Prerequisites
- Node.js 18+ and npm

### Install Dependencies
```bash
npm install
```

### Development Server
```bash
npm run dev
```
The dev server runs on http://localhost:5173

### Build for Production
```bash
npm run build
```
Builds to `../V2rayClient/wwwroot/` directory for integration with the WPF application.

### Lint
```bash
npm run lint
```

## Project Structure

- `src/bridge/` - Communication layer with C# backend via WebView2
- `src/components/` - React components (layout, UI components)
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utility functions
- `src/store/` - Zustand state management
- `src/pages/` - Page components (to be implemented)

## Architecture

### Bridge Layer
The bridge layer (`src/bridge/`) provides type-safe communication with the C# backend:
- All API calls return `ApiResponse<T>` with success/error handling
- Mock data support for development outside WebView2
- Event listener system for real-time updates from backend

### State Management
Uses Zustand for global state management:
- Connection status
- User configuration
- Traffic statistics
- UI state (current view, loading, errors)

### Theme System
Supports light/dark/system themes:
- Theme persists to localStorage
- Uses CSS variables for consistent theming
- Smooth transitions between themes

## Adding shadcn/ui Components

To add more shadcn/ui components:
```bash
npx shadcn@latest add [component-name]
```

Example:
```bash
npx shadcn@latest add toast
```

## WebView2 Integration

The app is designed to run inside a WebView2 control in the WPF application. The C# backend exposes APIs via `window.nativeApi`:

```typescript
// Check if running in WebView2
if (window.nativeApi) {
  // Call native API
  const result = await window.nativeApi.startProxy()
}
```

During development (outside WebView2), the bridge layer returns mock data.

## Development Tips

1. **Hot Module Replacement**: Changes are reflected immediately in dev mode
2. **Type Safety**: All API calls and state are fully typed
3. **Mock Data**: Test UI without running the C# backend
4. **Theme Testing**: Toggle theme with the ThemeProvider

## Next Steps

Implement the page components:
- Home page (Task 9)
- Server configuration page (Task 10)
- Custom rules page (Task 11)
- Settings page (Task 12)
