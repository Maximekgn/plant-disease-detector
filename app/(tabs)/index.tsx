import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImageManipulator from "expo-image-manipulator";

import { WS_URL, STREAM_INTERVAL_MS, TARGET_SIZE } from "@/constants/config";
import { useWebSocketStream } from "@/hooks/use-websocket";

type CameraReadyState = "idle" | "ready" | "streaming";

const { width, height } = Dimensions.get("window");

// --- UTILS ---
function isHealthyPlant(label: string): boolean {
  return label.toLowerCase().includes("healthy");
}

function extractPlantInfo(label: string): { plant: string; disease: string | null } {
  const lowerLabel = label.toLowerCase();
  
  if (lowerLabel.includes("healthy")) {
    const match = label.match(/Healthy\s+(.+?)(?:\s+Plant)?$/i);
    return { plant: match?.[1] || label, disease: null };
  }
  
  const withMatch = label.match(/^(.+?)\s+with\s+(.+)$/i);
  if (withMatch) {
    return { plant: withMatch[1], disease: withMatch[2] };
  }
  
  return { plant: label, disease: null };
}

export default function DroneVisionScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraState, setCameraState] = useState<CameraReadyState>("streaming"); // Auto start
  const cameraRef = useRef<CameraView>(null);
  
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const alertOpacity = useRef(new Animated.Value(0)).current;

  const {
    status: wsStatus,
    latencyMs,
    lastPrediction,
    sendBase64,
    reconnect,
    lastError,
  } = useWebSocketStream(WS_URL);

  const [lastFrameAt, setLastFrameAt] = useState<number | null>(null);

  // Animation de scan
  useEffect(() => {
    if (cameraState === "streaming") {
      const scanLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: height,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
      scanLoop.start();
      return () => scanLoop.stop();
    }
  }, [cameraState]);

  // Animation d'alerte
  useEffect(() => {
    if (lastPrediction) {
      Animated.timing(alertOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          Animated.timing(alertOpacity, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }).start();
        }, 2000);
      });
    }
  }, [lastPrediction]);

  // Capture Loop Optimisée
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
      return;
    }

    if (cameraState !== "streaming" || wsStatus !== "open") return;
    
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const photo = await cameraRef.current?.takePictureAsync({
          base64: false, // Pas besoin ici
          skipProcessing: true,
          shutterSound: false,
        } as any);

        if (photo?.uri) {
          // ⚡ Optimisation critique : Resize sur le téléphone
          const manipResult = await ImageManipulator.manipulateAsync(
            photo.uri,
            [{ resize: { width: TARGET_SIZE } }], // 224px
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          );

          if (manipResult.base64) {
             setLastFrameAt(Date.now());
             sendBase64(manipResult.base64);
          }
        }
      } catch (err) {
        // Ignorer les erreurs de capture
      } finally {
        if (!cancelled) {
          setTimeout(tick, STREAM_INTERVAL_MS);
        }
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [cameraState, wsStatus, sendBase64, permission]);

  const fps = useMemo(() => {
    if (!lastFrameAt) return 0;
    return Math.round(1000 / STREAM_INTERVAL_MS);
  }, [lastFrameAt]);

  const isHealthy = lastPrediction ? isHealthyPlant(lastPrediction.label) : true;
  const plantInfo = lastPrediction ? extractPlantInfo(lastPrediction.label) : null;
  const scorePct = lastPrediction ? Math.round(lastPrediction.score * 100) : 0;
  
  const hudColor = isHealthy ? "#00FF9D" : "#FF3B30";

  if (!permission?.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permissionText}>INITIALISATION SYSTÈME VISUEL...</Text>
        <Pressable style={styles.btnPerm} onPress={requestPermission}>
          <Text style={styles.btnPermText}>AUTORISER ACCÈS CAMÉRA</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={() => setCameraState("streaming")}
      />

      <SafeAreaView style={styles.hudLayer} pointerEvents="box-none">
        
        {/* Header Télémétrie */}
        <View style={styles.hudHeader}>
          <View>
            <Text style={styles.hudLabel}>SYS.STATUS</Text>
            <Text style={[styles.hudValue, { color: wsStatus === 'open' ? '#00FF9D' : '#FF3B30' }]}>
              {wsStatus === 'open' ? 'ONLINE' : wsStatus.toUpperCase()}
            </Text>
          </View>
          
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.hudTitle}>AGRI-DRONE V2</Text>
            <View style={styles.recDot} />
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.hudLabel}>LATENCY</Text>
            <Text style={styles.hudValue}>{latencyMs ?? '--'} MS</Text>
          </View>
        </View>

        {/* Viseur Central */}
        <View style={styles.crosshairContainer} pointerEvents="none">
          <View style={[styles.corner, styles.tl, { borderColor: hudColor }]} />
          <View style={[styles.corner, styles.tr, { borderColor: hudColor }]} />
          <View style={[styles.corner, styles.bl, { borderColor: hudColor }]} />
          <View style={[styles.corner, styles.br, { borderColor: hudColor }]} />
          
          <View style={styles.centerCrossV} />
          <View style={styles.centerCrossH} />

          <Animated.View 
            style={[
              styles.scanLine, 
              { 
                top: 0,
                transform: [{ translateY: scanLineAnim }] 
              }
            ]} 
          />
        </View>

        {/* Alerte Détection */}
        {plantInfo && (
          <Animated.View style={[styles.alertBox, { opacity: alertOpacity, borderColor: hudColor }]}>
            <View style={[styles.alertBadge, { backgroundColor: hudColor }]}>
              <Text style={styles.alertIcon}>{isHealthy ? "✓" : "!"}</Text>
            </View>
            <View>
              <Text style={[styles.plantName, { color: hudColor }]}>
                {plantInfo.plant.toUpperCase()}
              </Text>
              {!isHealthy && (
                <Text style={styles.diseaseName}>
                  DETECTED: {plantInfo.disease?.toUpperCase()}
                </Text>
              )}
              <Text style={styles.confidence}>
                CONFIDENCE: {scorePct}%
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Footer Contrôles */}
        <View style={styles.hudFooter}>
          <View>
            <Text style={styles.hudLabel}>CAM.FPS</Text>
            <Text style={styles.hudValue}>{fps}</Text>
          </View>

          <Pressable 
            style={[styles.actionBtn, { borderColor: cameraState === 'streaming' ? '#00FF9D' : '#FF3B30' }]}
            onPress={() => setCameraState(p => p === 'streaming' ? 'idle' : 'streaming')}
          >
            <Text style={[styles.actionBtnText, { color: cameraState === 'streaming' ? '#00FF9D' : '#FF3B30' }]}>
              {cameraState === 'streaming' ? 'SYSTEM ARMED' : 'SYSTEM PAUSED'}
            </Text>
          </Pressable>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.hudLabel}>NET.LINK</Text>
            {wsStatus !== 'open' ? (
              <Pressable onPress={reconnect}>
                <Text style={[styles.hudValue, { color: '#FF3B30', textDecorationLine: 'underline' }]}>RECONNECT</Text>
              </Pressable>
            ) : (
              <Text style={styles.hudValue}>SECURE</Text>
            )}
          </View>
        </View>

      </SafeAreaView>

      {lastError && (
        <View style={styles.errorToaster}>
          <Text style={styles.errorText}>ERR: {lastError}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
  },
  permissionText: {
    color: "#00FF9D",
    fontFamily: "Courier",
    marginBottom: 20,
    fontSize: 16,
  },
  btnPerm: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#00FF9D",
    borderRadius: 4,
  },
  btnPermText: {
    color: "#00FF9D",
    fontWeight: "bold",
    letterSpacing: 1,
  },
  hudLayer: {
    flex: 1,
    justifyContent: "space-between",
    padding: 20,
  },
  hudHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  hudFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 10,
  },
  hudLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  hudValue: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Courier",
    fontWeight: "bold",
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2
  },
  hudTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#fff",
    paddingBottom: 4,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3B30",
    marginTop: 6,
  },
  crosshairContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
  },
  tl: { top: "30%", left: "15%", borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: "30%", right: "15%", borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: "30%", left: "15%", borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: "30%", right: "15%", borderLeftWidth: 0, borderTopWidth: 0 },
  centerCrossV: {
    width: 2,
    height: 20,
    backgroundColor: "rgba(255,255,255,0.5)",
    position: "absolute",
  },
  centerCrossH: {
    width: 20,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.5)",
    position: "absolute",
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(0, 255, 157, 0.6)",
    shadowColor: "#00FF9D",
    shadowOpacity: 1,
    shadowRadius: 10,
    width: width,
  },
  alertBox: {
    position: 'absolute',
    top: "15%",
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fff",
  },
  alertBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  alertIcon: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  plantName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  diseaseName: {
    color: "#FF3B30",
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 2,
  },
  confidence: {
    color: "#aaa",
    fontSize: 10,
    marginTop: 2,
    fontFamily: "Courier",
  },
  actionBtn: {
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  errorToaster: {
    position: "absolute",
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: "#FF3B30",
    padding: 8,
    borderRadius: 4,
  },
  errorText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Courier",
    textAlign: "center",
  },
});
