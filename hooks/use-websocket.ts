import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, AppState } from "react-native";

export type PredictionPayload = {
  label: string;
  score: number;
  time?: string;
};

export type WsStatus = "connecting" | "open" | "closed" | "error";

const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

export function useWebSocketStream(url: string) {
  const [status, setStatus] = useState<WsStatus>("connecting");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastPrediction, setLastPrediction] =
    useState<PredictionPayload | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [messagesSent, setMessagesSent] = useState<number>(0);
  const [bytesLastSent, setBytesLastSent] = useState<number | null>(null);
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const socketRef = useRef<WebSocket | null>(null);
  const lastSendRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isManualCloseRef = useRef(false);

  const clearReconnectTimeout = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const connect = useCallback(() => {
    clearReconnectTimeout();
    isManualCloseRef.current = false;
    
    if (socketRef.current) {
      isManualCloseRef.current = true;
      socketRef.current.close();
    }
    
    console.log(`[WS] Connecting to: ${url} (attempt ${reconnectAttempts + 1})`);
    
    if (
      Platform.OS === "android" &&
      (url.includes("ws://localhost") || url.includes("ws://127.0.0.1"))
    ) {
      console.log(
        "[WS] ⚠️ ATTENTION: Sur Android physique, localhost = le téléphone! Utilisez l'IP du PC."
      );
    }
    
    setStatus("connecting");
    setLastError(null);
    
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log(`[WS] ✅ Connected to: ${url}`);
      setStatus("open");
      setLastError(null);
      setReconnectAttempts(0);
    };
    
    ws.onerror = (event) => {
      console.warn("[WS] ❌ Error:", event);
      setStatus("error");
      setLastError("Erreur de connexion WebSocket. Vérifiez que le serveur est actif.");
    };
    
    ws.onclose = (event) => {
      console.log(`[WS] 🔌 Closed: code=${event.code} reason=${event.reason}`);
      setStatus("closed");
      
      // Auto-reconnect if not manually closed
      if (!isManualCloseRef.current && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(
          INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
          MAX_RECONNECT_DELAY
        );
        console.log(`[WS] 🔄 Reconnecting in ${delay}ms...`);
        setLastError(`Reconnexion dans ${Math.round(delay/1000)}s...`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          connect();
        }, delay);
      } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        setLastError("Impossible de se connecter. Appuyez sur Reconnecter.");
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as
          | PredictionPayload
          | { error?: string; time?: string };
        setLastMessageAt(Date.now());

        if (typeof parsed === "object" && "error" in parsed && parsed.error) {
          console.warn("[WS] Server error:", parsed.error);
          setLastError(parsed.error);
          return;
        }
        
        const payload = parsed as PredictionPayload;
        console.log(`[WS] 📊 Prediction: ${payload.label} (${(payload.score * 100).toFixed(1)}%)`);
        setLastPrediction(payload);

        const now = Date.now();
        const backendTs = payload.time ? Date.parse(payload.time) : NaN;
        if (!Number.isNaN(backendTs)) {
          setLatencyMs(Math.max(0, now - backendTs));
        } else if (lastSendRef.current) {
          setLatencyMs(Math.max(0, now - lastSendRef.current));
        }
      } catch (err) {
        console.warn("[WS] Parse error:", err);
        setLastError("Erreur de parsing du message");
      }
    };
  }, [url, reconnectAttempts]);

  // Initial connection
  useEffect(() => {
    connect();
    return () => {
      clearReconnectTimeout();
      isManualCloseRef.current = true;
      socketRef.current?.close();
    };
  }, []);

  // Reconnect when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active" && status !== "open") {
        console.log("[WS] App active, reconnecting...");
        setReconnectAttempts(0);
        connect();
      }
    });
    return () => subscription.remove();
  }, [status, connect]);

  // Manual reconnect (resets attempts)
  const reconnect = useCallback(() => {
    console.log("[WS] Manual reconnect triggered");
    setReconnectAttempts(0);
    connect();
  }, [connect]);

  const sendBase64 = useCallback(
    (base64: string) => {
      if (!socketRef.current || status !== "open") {
        console.log("[WS] ⏸️ Send skipped: socket not open");
        return;
      }
      lastSendRef.current = Date.now();
      setBytesLastSent(base64.length);
      setMessagesSent((prev) => prev + 1);
      socketRef.current.send(base64);
    },
    [status]
  );

  return useMemo(
    () => ({
      status,
      latencyMs,
      lastPrediction,
      sendBase64,
      reconnect,
      lastError,
      diagnostics: { 
        messagesSent, 
        bytesLastSent, 
        lastMessageAt,
        reconnectAttempts 
      },
    }),
    [
      status,
      latencyMs,
      lastPrediction,
      sendBase64,
      reconnect,
      lastError,
      messagesSent,
      bytesLastSent,
      lastMessageAt,
      reconnectAttempts,
    ]
  );
}
