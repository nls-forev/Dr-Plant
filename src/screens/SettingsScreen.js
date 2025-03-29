// src/screens/SettingsScreen.js
import React from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from "react-native";
import { t } from "../localization/strings"; // Import translation
import { SlidersHorizontal } from "lucide-react-native"; // Example icon

const SettingsScreen = () => {
  // Theme
  const theme = {
    background: "#0A0A0A",
    text: "#EFEFEF",
    textSecondary: "#AEAEB2",
    primary: "#BFFF00",
    card: "#1C1C1E",
    border: "#2C2C2E",
    placeholderIcon: "#888",
  };

  // --- Styles ---
  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      flex: 1,
    },
    scrollContentContainer: {
      paddingTop: 20, // Space below header (if any, none by default here)
      paddingHorizontal: 20,
      paddingBottom: 40,
      alignItems: "center", // Center content horizontally
      justifyContent: "center", // Center vertically if content is short
      flexGrow: 1, // Ensure it grows to fill space
    },
    icon: {
      marginBottom: 20,
      opacity: 0.5, // Make placeholder icon subtle
    },
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
    // Add styles for actual settings components later (Toggle, Picker etc.)
    // Example:
    // settingRow: { ... },
    // settingLabel: { ... },
    // settingControl: { ... },
  });

  // --- Render ---
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContentContainer}
      >
        {/* Placeholder Content */}
        <SlidersHorizontal
          size={60}
          color={theme.placeholderIcon}
          style={styles.icon}
        />
        <Text style={styles.title}>{t("settings")}</Text>
        <Text style={styles.subtitle}>{t("comingSoon")}</Text>
        {/*
                Future Settings Options would go here, e.g.:
                <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Enable Notifications</Text>
                    <Switch style={styles.settingControl} ... />
                </View>
                <TouchableOpacity style={styles.settingRow} onPress={() => {/* Navigate to Language Selection *}}>
                    <Text style={styles.settingLabel}>Language</Text>
                    <Text style={styles.settingValue}>English</Text>
                    <Ionicons name="chevron-forward" ... />
                </TouchableOpacity>
             */}
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen; // Ensure default export is present
