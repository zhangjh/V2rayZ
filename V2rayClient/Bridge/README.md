# JavaScript Bridge Documentation

This directory contains the JavaScript bridge that connects the React UI with the C# backend.

## Overview

The bridge uses WebView2's `AddHostObjectToScript` API to expose C# methods to JavaScript. All methods return JSON-serialized strings that need to be parsed in JavaScript.

## Architecture

```
React UI (JavaScript)
    ↓
window.nativeApi (JavaScript wrapper)
    ↓
chrome.webview.hostObjects.nativeApi (WebView2 bridge)
    ↓
NativeApi.cs (C# implementation)
    ↓
Services (V2rayManager, ConfigurationManager, etc.)
```

## Usage in React

### 1. Import Types

Copy `NativeApi.d.ts` to your React project and import the types:

```typescript
import type { ApiResponse, UserConfig, ConnectionStatus } from './types/nativeApi';
```

### 2. Call API Methods

All API methods return JSON strings that need to be parsed:

```typescript
// Start proxy
const response = await window.nativeApi.startProxy();
const result: ApiResponse = JSON.parse(response);
if (result.success) {
  console.log('Proxy started successfully');
} else {
  console.error('Failed to start proxy:', result.error);
}

// Get configuration
const configResponse = await window.nativeApi.getConfig();
const configResult: ApiResponse<UserConfig> = JSON.parse(configResponse);
if (configResult.success) {
  const config = configResult.data;
  console.log('Current config:', config);
}

// Save configuration
const newConfig: UserConfig = { /* ... */ };
const saveResponse = await window.nativeApi.saveConfig(newConfig);
const saveResult: ApiResponse = JSON.parse(saveResponse);
```

### 3. Listen to Events

The bridge supports event notifications from C# to JavaScript:

```typescript
// Add event listener
window.addNativeEventListener('statsUpdated', (stats) => {
  console.log('Traffic stats updated:', stats);
  setTrafficStats(stats);
});

window.addNativeEventListener('processError', (error) => {
  console.error('V2ray process error:', error);
  showErrorNotification(error.error);
});

// Remove event listener
const handleStatsUpdate = (stats) => {
  console.log('Stats:', stats);
};

window.addNativeEventListener('statsUpdated', handleStatsUpdate);
// Later...
window.removeNativeEventListener('statsUpdated', handleStatsUpdate);
```

## Available API Methods

### Proxy Control

- `startProxy()`: Start the proxy connection
- `stopProxy()`: Stop the proxy connection

### Configuration Management

- `getConfig()`: Get current user configuration
- `saveConfig(config)`: Save user configuration
- `updateProxyMode(mode)`: Update proxy mode ('Global', 'Smart', or 'Direct')

### Status and Statistics

- `getConnectionStatus()`: Get current connection status
- `getStatistics()`: Get traffic statistics
- `resetStatistics()`: Reset traffic statistics

### Custom Rules

- `addCustomRule(rule)`: Add a custom domain rule
- `updateCustomRule(rule)`: Update an existing custom rule
- `deleteCustomRule(ruleId)`: Delete a custom rule

## Available Events

- `processStarted`: V2ray process started
- `processStopped`: V2ray process stopped
- `processError`: V2ray process encountered an error
- `configChanged`: Configuration changed
- `statsUpdated`: Traffic statistics updated (fires every second when connected)

## Example: React Hook

Here's an example custom hook for using the native API:

```typescript
import { useState, useEffect } from 'react';
import type { ApiResponse, ConnectionStatus, TrafficStats } from './types/nativeApi';

export function useNativeApi() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [trafficStats, setTrafficStats] = useState<TrafficStats | null>(null);

  useEffect(() => {
    // Listen to events
    const handleStatsUpdate = (stats: TrafficStats) => {
      setTrafficStats(stats);
    };

    window.addNativeEventListener('statsUpdated', handleStatsUpdate);

    // Cleanup
    return () => {
      window.removeNativeEventListener('statsUpdated', handleStatsUpdate);
    };
  }, []);

  const startProxy = async () => {
    const response = await window.nativeApi.startProxy();
    const result: ApiResponse = JSON.parse(response);
    if (!result.success) {
      throw new Error(result.error);
    }
  };

  const stopProxy = async () => {
    const response = await window.nativeApi.stopProxy();
    const result: ApiResponse = JSON.parse(response);
    if (!result.success) {
      throw new Error(result.error);
    }
  };

  const getStatus = async () => {
    const response = await window.nativeApi.getConnectionStatus();
    const result: ApiResponse<ConnectionStatus> = JSON.parse(response);
    if (result.success && result.data) {
      setConnectionStatus(result.data);
    }
  };

  return {
    connectionStatus,
    trafficStats,
    startProxy,
    stopProxy,
    getStatus,
  };
}
```

## Error Handling

All API methods return a response with the following structure:

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
```

Always check the `success` field before accessing `data`:

```typescript
const response = await window.nativeApi.getConfig();
const result: ApiResponse<UserConfig> = JSON.parse(response);

if (result.success) {
  // Use result.data
  console.log(result.data);
} else {
  // Handle error
  console.error(result.error);
}
```

## Notes

- All API calls are synchronous from the C# perspective but should be treated as async in JavaScript
- The bridge is initialized when the WebView2 loads, so ensure it's ready before making calls
- Event listeners are called on the UI thread, so they're safe to use for updating React state
- The `statsUpdated` event fires every second when the proxy is connected, so use it efficiently
