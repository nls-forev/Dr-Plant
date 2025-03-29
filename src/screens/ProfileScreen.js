// src/screens/ProfileScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView, // Added ScrollView for content
  SafeAreaView, // Added SafeAreaView
  Platform,
} from "react-native";
import {
  User,
  Smartphone, // Changed from Clock to Smartphone for Edit Profile association maybe? Or keep User?
  Edit3, // Icon for Edit Profile
  History, // Icon for Scan History
  Globe, // Icon for Language
  HelpCircle, // Keep for Help
  LogOut,
  Info, // Icon for App Version
  Settings
} from "lucide-react-native"; // Import relevant icons
import { useAuth } from "../context/AuthContext";
import { db, firebase } from "../firebase/firebaseInit"; // Import db
import { doc, getDoc } from "firebase/firestore"; // Import Firestore functions
import { useNavigation } from "@react-navigation/native";
import { t } from "../localization/strings"; // Import translation
import Constants from "expo-constants"; // Import expo-constants
import { Ionicons } from "@expo/vector-icons";

const ProfileScreen = () => {
  const { user } = useAuth(); // Auth user (contains email, maybe displayName, uid)
  const navigation = useNavigation();
  const [userData, setUserData] = useState(null); // To store Firestore user data (username, phone)
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState(null);

  // Theme
  const theme = {
    background: "#0A0A0A",
    text: "#EFEFEF",
    textSecondary: "#AEAEB2",
    primary: "#BFFF00",
    card: "#1C1C1E", // For potential card backgrounds if needed
    border: "#2C2C2E",
    error: "#FF9A9A",
    logoutColor: "#FF453A", // Specific color for logout
    iconColor: "#EFEFEF", // Default icon color
    profileInitialBg: "#BFFF00",
    profileInitialText: "#111111",
  };

  // --- Fetch User Data from Firestore ---
  const fetchUserData = useCallback(async () => {
    if (!user?.uid) {
      setLoadingData(false);
      setUserData(null); // No user, no data
      return;
    }

    setLoadingData(true);
    setError(null);
    console.log("Fetching Firestore data for user:", user.uid);

    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        setUserData(userDocSnap.data());
        console.log("Firestore User Data:", userDocSnap.data());
      } else {
        console.log(
          "No matching user document found in Firestore for UID:",
          user.uid
        );
        // Handle case where user exists in Auth but not Firestore (maybe redirect to finish profile?)
        setError(t("error_not_found") + " (User profile data missing)");
        setUserData(null); // Set to null if doc doesn't exist
      }
    } catch (err) {
      console.error("Error fetching user data from Firestore:", err);
      setError(t("error_loading_data") + " (Profile)");
      setUserData(null); // Clear data on error
    } finally {
      setLoadingData(false);
    }
  }, [user?.uid]); // Dependency on user UID

  // Fetch data when user changes or screen focuses
  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]); // fetchUserData is memoized with user.uid dependency

  // --- Logout Handler ---
  const handleLogout = useCallback(async () => {
    Alert.alert(
      t("logout_confirm_title"), // Translated title
      t("logout_confirm_message"), // Translated message
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("logout"),
          style: "destructive",
          onPress: async () => {
            try {
              await firebase.auth().signOut();
              // AuthProvider listener will handle navigation update automatically
              console.log("User logged out successfully.");
            } catch (error) {
              console.error("Logout Error:", error);
              // Show translated error message
              Alert.alert(t("error"), error.message || t("error_general"));
            }
          },
        },
      ]
    );
  }, []); // No dependencies needed

  // --- Navigation Handlers (Placeholders for now) ---
  const handleNavigate = useCallback(
    (screenName, params = {}) => {
      // ** TODO: Replace placeholders with actual navigation or feature implementation **
      if (screenName === "EditProfile") {
        Alert.alert(t("comingSoon"), t("featureNotImplemented"));
        // navigation.navigate('EditProfile', params); // Example future navigation
      } else if (screenName === "ScanHistory") {
        Alert.alert(t("comingSoon"), t("featureNotImplemented"));
        // navigation.navigate('ScanHistory', params);
      } else if (screenName === "LanguageSelection") {
        Alert.alert(t("comingSoon"), t("featureNotImplemented"));
        // navigation.navigate('LanguageSelection', params);
      } else if (screenName === "HelpCenter") {
        Alert.alert(t("comingSoon"), t("featureNotImplemented"));
        // navigation.navigate('HelpCenter', params);
      } else {
        console.warn("Attempted to navigate to unknown screen:", screenName);
      }
    },
    [navigation]
  ); // Dependency on navigation

  // --- Helper Functions ---
  const getInitials = (displayName, firestoreUsername, email) => {
    const nameToUse = displayName || firestoreUsername;
    if (nameToUse && nameToUse.length > 0) {
      // Handle multiple words in name
      const parts = nameToUse.split(" ").filter(Boolean); // Split and remove empty strings
      if (parts.length > 1) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase(); // First and Last initial
      }
      return parts[0][0].toUpperCase(); // First letter of single word name
    }
    if (email && email.length > 0) return email[0].toUpperCase();
    return "?"; // Fallback
  };

  // Get display values, prioritizing Auth displayName, then Firestore username
  const displayName =
    user?.displayName ||
    userData?.username ||
    user?.email?.split("@")[0] ||
    t("home_gardener");
  const displayEmail = user?.email || t("profile_no_email");
  const displayPhone = userData?.phone || t("phone_number") + ": N/A"; // Show phone if available
  const displayInitial = getInitials(
    user?.displayName,
    userData?.username,
    user?.email
  );
  const appVersion = Constants.expoConfig?.version || "N/A"; // Get app version

  // --- Component Styles ---
  const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1 }, // ScrollView container
    scrollContentContainer: {
      paddingHorizontal: 20,
      paddingBottom: 40,
      paddingTop: 20, // Padding inside ScrollView
    },
    loadingContainer: {
      // Centered loader
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    errorContainer: {
      // Centered error
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    errorText: {
      color: theme.error,
      textAlign: "center",
      marginTop: 10,
      fontSize: 16,
    },
    profileHeader: {
      alignItems: "center",
      marginBottom: 30,
    },
    profileCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.profileInitialBg,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 15,
      // Optional subtle shadow
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3,
    },
    profileInitial: {
      color: theme.profileInitialText, // Use theme color
      fontSize: 40, // Adjusted size for 2 initials potentially
      fontWeight: "bold",
    },
    username: {
      color: theme.text,
      fontSize: 22, // Larger
      fontWeight: "bold",
      marginTop: 5,
      textAlign: "center",
    },
    email: {
      color: theme.textSecondary,
      marginTop: 5,
      fontSize: 14,
    },
    phone: {
      // Added style for phone
      color: theme.textSecondary,
      marginTop: 5,
      fontSize: 14,
    },
    menuContainer: {
      marginTop: 10, // Space above menu items
      backgroundColor: theme.card, // Give menu a card background
      borderRadius: 16,
      overflow: "hidden", // Clip borders inside radius
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 16, // Consistent padding
      paddingHorizontal: 20, // Padding inside menu card
      borderBottomWidth: 1,
      borderBottomColor: theme.border, // Use theme border color
    },
    menuItemLast: {
      borderBottomWidth: 0, // No border for the last item
    },
    menuIcon: {
      width: 24, // Fixed width for icon alignment
      alignItems: "center", // Center icon horizontally
      marginRight: 20, // Space between icon and text
    },
    menuText: {
      color: theme.text,
      fontSize: 16,
      flex: 1, // Allow text to take remaining space
    },
    menuTextSecondary: {
      // For things like app version
      color: theme.textSecondary,
      fontSize: 14,
      textAlign: "right",
    },
    logoutText: {
      color: theme.logoutColor, // Use specific logout color
      fontSize: 16,
      fontWeight: "600", // Make logout slightly bolder
      flex: 1,
    },
  });

  // Reusable Menu Icon Component
  const MenuIcon = ({ icon: Icon, color }) => (
    <View style={styles.menuIcon}>
      {/* Use theme color as default, allow override */}
      <Icon color={color || theme.iconColor} size={22} strokeWidth={1.8} />
    </View>
  );

  // --- Loading State ---
  if (loadingData && !userData) {
    // Show loader only on initial data fetch
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // --- Error State ---
  if (error && !loadingData) {
    // Show error only after loading attempt
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <AlertCircle size={40} color={theme.error} />
          <Text style={styles.errorText}>{error}</Text>
          {/* Optionally add a retry button for fetching profile data */}
          <TouchableOpacity onPress={fetchUserData} style={{ marginTop: 15 }}>
            <Text style={{ color: theme.primary, fontWeight: "bold" }}>
              {t("retry")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- Main Content ---
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContentContainer}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.profileCircle}>
            <Text style={styles.profileInitial}>{displayInitial}</Text>
          </View>
          <Text style={styles.username} numberOfLines={1} ellipsizeMode="tail">
            {displayName}
          </Text>
          <Text style={styles.email}>{displayEmail}</Text>
          {/* Display phone number only if successfully loaded */}
          {userData?.phone && <Text style={styles.phone}>{displayPhone}</Text>}
        </View>

        {/* Menu Options */}
        <View style={styles.menuContainer}>
          {/* Edit Profile */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleNavigate("EditProfile")}
          >
            <MenuIcon icon={Edit3} />
            <Text style={styles.menuText}>
              {t("profile_account_info") || "Edit Profile"}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {/* Scan History */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleNavigate("ScanHistory")}
          >
            <MenuIcon icon={History} />
            <Text style={styles.menuText}>{t("profile_scan_history")}</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {/* Language */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleNavigate("LanguageSelection")}
          >
            <MenuIcon icon={Globe} />
            <Text style={styles.menuText}>
              {t("language") || "Language"}
            </Text>{" "}
            {/* Add 'language' to strings.js */}
            {/* Optionally show current language */}
            {/* <Text style={styles.menuTextSecondary}>{currentLanguageName}</Text> */}
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {/* Settings - Link to existing Settings screen */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("Settings")}
          >
            <MenuIcon icon={Settings} />
            <Text style={styles.menuText}>{t("settings")}</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {/* Help Center */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleNavigate("HelpCenter")}
          >
            <MenuIcon icon={HelpCircle} />
            <Text style={styles.menuText}>{t("profile_help_center")}</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {/* App Version (Not interactive) */}
          <View style={styles.menuItem}>
            <MenuIcon icon={Info} />
            <Text style={styles.menuText}>
              {t("App Version") || "App Version"}
            </Text>{" "}
            {/* Add 'app_version' to strings.js */}
            <Text style={styles.menuTextSecondary}>{appVersion}</Text>
          </View>

          {/* Logout */}
          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemLast]}
            onPress={handleLogout}
          >
            <MenuIcon icon={LogOut} color={theme.logoutColor} />
            <Text style={styles.logoutText}>{t("logout")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;
