// ⚠️ IMPORTANT: Replace YOUR_PC_IP with your actual PC's IP address on WiFi
// To find your IP on Windows: Open PowerShell and run: ipconfig
// Look for "IPv4 Address" under your WiFi adapter (e.g., 192.168.1.xxx)
//
// Example: If your PC IP is 192.168.1.100, use:
// export const WS_URL = `ws://192.168.1.100:3000`;
//
// Alternative (USB debugging only): Use `adb reverse tcp:3000 tcp:3000` then keep localhost
export const WS_URL = `ws://192.168.1.73:3000`;
export const STREAM_INTERVAL_MS = 400;
export const TARGET_SIZE = 224;
