// src/screens/AnalyticsScreen.js
import React from "react";
import { View, Text, StyleSheet, SafeAreaView } from "react-native";
import { t } from "../localization/strings"; // Import translation
import { BarChart2 } from "lucide-react-native"; // Example icon

const AnalyticsScreen = () => {
  // Theme
  const theme = {
    background: "#0A0A0A",
    text: "#EFEFEF",
    textSecondary: "#AEAEB2",
    placeholderIcon: "#888",
  };

  // Styles
  const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    icon: { marginBottom: 20, opacity: 0.5 },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 8,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: "center",
      lineHeight: 22,
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <BarChart2
          size={60}
          color={theme.placeholderIcon}
          style={styles.icon}
        />
        <Text style={styles.title}>{t("Analytics") || "Analytics"}</Text>{" "}
        {/* Add 'Analytics' key to strings.js */}
        <Text style={styles.subtitle}>{t("comingSoon")}</Text>
      </View>
    </SafeAreaView>
  );
};

export default AnalyticsScreen;
