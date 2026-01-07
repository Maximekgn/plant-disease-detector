import { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

const optionButton = (label: string, active: boolean) => ({ label, active });

export default function SettingsScreen() {
  const [sensitivity, setSensitivity] = useState(65);
  const [refreshRate, setRefreshRate] = useState<"eco" | "balanced" | "max">(
    "balanced"
  );
  const [showLabels, setShowLabels] = useState(true);
  const [showConfidence, setShowConfidence] = useState(true);
  const [notifications, setNotifications] = useState(false);
  const [haptics, setHaptics] = useState(true);
  const [boxColor, setBoxColor] = useState<"blue" | "green" | "red" | "yellow">(
    "blue"
  );

  const refreshOptions = useMemo(
    () => [
      optionButton("Éco", refreshRate === "eco"),
      optionButton("Balancé", refreshRate === "balanced"),
      optionButton("Max", refreshRate === "max"),
    ],
    [refreshRate]
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Paramètres</Text>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Configuration IA</Text>

        <Pressable style={styles.listRow}>
          <View>
            <Text style={styles.rowTitle}>Modèle de détection</Text>
            <Text style={styles.rowSubtitle}>MobileNetV2 (ONNX)</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <View style={styles.sliderRow}>
          <Text style={styles.rowTitle}>Sensibilité (Seuil)</Text>
          <Text style={styles.accentText}>{sensitivity}%</Text>
        </View>
        <Pressable
          style={styles.sliderTrack}
          onPress={() => setSensitivity((prev) => (prev + 5) % 100)}
        >
          <View style={[styles.sliderFill, { width: `${sensitivity}%` }]} />
        </Pressable>

        <Text style={[styles.sectionLabel, { marginTop: 18 }]}>
          Taux de rafraîchissement
        </Text>
        <View style={styles.rowOptions}>
          {refreshOptions.map((opt) => (
            <Pressable
              key={opt.label}
              style={[styles.pill, opt.active && styles.pillActive]}
              onPress={() =>
                setRefreshRate(
                  opt.label === "Éco"
                    ? "eco"
                    : opt.label === "Max"
                    ? "max"
                    : "balanced"
                )
              }
            >
              <Text
                style={[styles.pillText, opt.active && styles.pillTextActive]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Affichage</Text>

        <ToggleRow
          label="Afficher les labels"
          value={showLabels}
          onValueChange={setShowLabels}
        />
        <ToggleRow
          label="Afficher la confiance"
          value={showConfidence}
          onValueChange={setShowConfidence}
        />

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
          Couleur des boîtes
        </Text>
        <View style={styles.colorRow}>
          {(["blue", "green", "red", "yellow"] as const).map((c) => {
            const dotStyleMap = {
              blue: styles.dot_blue,
              green: styles.dot_green,
              red: styles.dot_red,
              yellow: styles.dot_yellow,
            } as const;
            return (
              <Pressable
                key={c}
                style={[
                  styles.colorDot,
                  dotStyleMap[c],
                  boxColor === c && styles.dotActive,
                ]}
                onPress={() => setBoxColor(c)}
              />
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Système</Text>
        <ToggleRow
          label="Notifications"
          value={notifications}
          onValueChange={setNotifications}
        />
        <ToggleRow
          label="Retour haptique"
          value={haptics}
          onValueChange={setHaptics}
        />
      </View>

      <Pressable style={styles.resetButton}>
        <Text style={styles.resetText}>Rétablir les paramètres par défaut</Text>
      </Pressable>

      <Text style={styles.version}>Version 1.0.2 • Build 450</Text>
    </SafeAreaView>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.rowTitle}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E1116", padding: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 12 },
  card: {
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
    gap: 10,
  },
  sectionLabel: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  rowTitle: { color: "#E5E7EB", fontSize: 15, fontWeight: "700" },
  rowSubtitle: { color: "#9CA3AF", fontSize: 13 },
  chevron: { color: "#9CA3AF", fontSize: 22 },
  sliderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sliderTrack: {
    height: 8,
    backgroundColor: "#1f2937",
    borderRadius: 999,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  sliderFill: { height: "100%", backgroundColor: "#4F8DFE" },
  accentText: { color: "#4F8DFE", fontWeight: "800" },
  rowOptions: { flexDirection: "row", gap: 8 },
  pill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#1f2937",
    alignItems: "center",
  },
  pillActive: { backgroundColor: "#4F8DFE" },
  pillText: { color: "#E5E7EB", fontWeight: "700" },
  pillTextActive: { color: "#fff" },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  colorRow: { flexDirection: "row", gap: 12 },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#1f2937",
  },
  dotActive: { borderColor: "#fff" },
  dot_blue: { backgroundColor: "#4F8DFE" },
  dot_green: { backgroundColor: "#10B981" },
  dot_red: { backgroundColor: "#EF4444" },
  dot_yellow: { backgroundColor: "#F59E0B" },
  resetButton: {
    backgroundColor: "#1f2937",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  resetText: { color: "#EF4444", fontWeight: "800" },
  version: { color: "#6b7280", textAlign: "center", marginTop: 12 },
});
