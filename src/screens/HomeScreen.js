// src/screens/HomeScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Dimensions,
  Platform,
  Alert, // Keep Alert for potential critical errors if needed
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { useAuth } from "../context/AuthContext"; // Ensure path is correct
import { formatDistanceToNowStrict } from "date-fns";
import { t } from "../localization/strings"; // Ensure path is correct

const screenWidth = Dimensions.get("window").width;

// --- Helper: Time Formatting ---
const formatTimestamp = (timestamp) => {
  // Check if it's a Firestore Timestamp object
  if (timestamp && typeof timestamp.toDate === "function") {
    try {
      const date = timestamp.toDate();
      return formatDistanceToNowStrict(date, { addSuffix: true });
    } catch (error) {
      console.error("Error formatting Firestore timestamp:", error);
      return t("Recently") || "Recently";
    }
  }
  // Handle if it's already a JS Date object
  else if (timestamp instanceof Date) {
    try {
      return formatDistanceToNowStrict(timestamp, { addSuffix: true });
    } catch (error) {
      console.error("Error formatting Date object:", error);
      return t("Recently") || "Recently";
    }
  }
  // Fallback for null, undefined, or other types
  else {
    console.warn("Invalid timestamp type received:", typeof timestamp);
    return t("Recently") || "Recently";
  }
};

// --- Component: Recent Activity Item (Using React.memo) ---
const RecentActivityItem = React.memo(({ item, onPress }) => {
  if (!item || !item.id) return null;

  // Consistent theme colors for item
  const theme = {
    itemBg: "#222222",
    iconBg: "rgba(191, 255, 0, 0.1)",
    iconColor: "#BFFF00",
    textPrimary: "#EFEFEF",
    textSecondary: "#999999",
  };

  return (
    <TouchableOpacity
      style={[styles.activityPostContainer, { backgroundColor: theme.itemBg }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.activityIconContainer,
          { backgroundColor: theme.iconBg },
        ]}
      >
        <Ionicons name="leaf-outline" size={26} color={theme.iconColor} />
      </View>
      <View style={styles.activityPostDetails}>
        <Text
          style={[styles.activityPostLabel, { color: theme.textPrimary }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.bestLabel || t("scan_results_title") || "Scan Result"}
        </Text>
        <Text style={[styles.activityPostTime, { color: theme.textSecondary }]}>
          {formatTimestamp(item.timestamp)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// --- Component: HomeScreen ---
const HomeScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [recentActivities, setRecentActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Tracks initial load OR load after user change
  const [isRefreshing, setIsRefreshing] = useState(false); // Tracks pull-to-refresh OR focus-refresh
  const [error, setError] = useState(null);

  // Theme (consistent dark theme)
  const theme = {
    background: "#0A0A0A",
    text: "#EFEFEF",
    textSecondary: "#AEAEB2",
    primary: "#BFFF00",
    card: "#1C1C1E",
    error: "#FF9A9A",
    refreshControlBg: "#2C2C2E",
    buttonTextDark: "#111111",
    placeholderIcon: "#888",
    retryButtonBackground: "#333",
  };

  // --- Data Fetching Logic ---
  const fetchRecentActivities = useCallback(
    async (isManualRefresh = false) => {
      if (!user?.uid) {
        setRecentActivities([]);
        setIsLoading(false);
        setIsRefreshing(false);
        setError(null);
        return;
      }

      // Prevent concurrent fetches unless forced by manual pull-down
      if (!isManualRefresh && (isLoading || isRefreshing)) {
        console.log("HomeScreen: Fetch skipped, already in progress.");
        return;
      }

      // Set appropriate loading/refreshing state
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        // On focus/initial: Show full loader only if list is empty
        if (recentActivities.length === 0) setIsLoading(true);
        // Optional: else setIsRefreshing(true); // show spinner on focus too
      }
      setError(null); // Clear previous errors

      console.log(
        `HomeScreen: Fetching activities (Manual: ${isManualRefresh})`
      );
      try {
        const queryRef = firebase
          .firestore()
          .collection("recent_activity")
          .where("userId", "==", user.uid)
          .orderBy("timestamp", "desc")
          .limit(15); // Fetch recent items
        const snapshot = await queryRef.get();

        // Process snapshot and update state consistently
        const activities = snapshot.docs.map((doc) => {
          const data = doc.data();
          // Ensure timestamp is a valid Firestore Timestamp or null
          return {
            id: doc.id,
            ...data,
            timestamp:
              data.timestamp instanceof firebase.firestore.Timestamp
                ? data.timestamp
                : null,
          };
        });
        setRecentActivities(activities); // Update state even if empty
        if (snapshot.empty) {
          console.log("HomeScreen: No activities found.");
        }
      } catch (err) {
        console.error("HomeScreen: Error fetching activities:", err);
        let userFriendlyError = t("error_loading_data");
        if (err.code === "permission-denied")
          userFriendlyError = t("error_permission_denied") + " Check rules.";
        else if (err.code === "unauthenticated")
          userFriendlyError = t("login_prompt");
        else if (err.message?.toLowerCase().includes("network error"))
          userFriendlyError = t("error_network");
        else if (err.code === "failed-precondition") {
          userFriendlyError = t("error_loading_data") + " (DB Index missing?)";
          console.warn(
            "Firestore Index likely missing for query: recent_activity / (userId ==, timestamp DESC)"
          );
        }
        setError(userFriendlyError);
      } finally {
        // Always reset both loading indicators
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user?.uid, isLoading, isRefreshing]
  ); // Include loading states in dependencies to prevent overlap

  // --- Effect for Focus & User Change ---
  useFocusEffect(
    useCallback(() => {
      console.log("HomeScreen Focused.");
      if (user) {
        // Trigger fetch, internal checks prevent overlap
        fetchRecentActivities(false);
      } else {
        // Clear state if no user
        setRecentActivities([]);
        setIsLoading(false);
        setIsRefreshing(false);
        setError(null);
      }
      return () => {}; // No cleanup needed
    }, [user, fetchRecentActivities]) // Depend on user and the memoized fetch function
  );

  // --- Pull-to-Refresh Handler ---
  const onRefresh = useCallback(() => {
    fetchRecentActivities(true);
  }, [fetchRecentActivities]);

  // --- Navigation ---
  const navigateToScanResults = useCallback(
    (item) => {
      // Pass necessary data, ensure timestamp is handled correctly by target screen or stringified
      const params = {
        scanId: item.id,
        imageUri: item.imageUri,
        bestLabel: item.bestLabel,
        bestConfidence: item.bestConfidence,
        top5: item.top5,
        description: item.description,
        // Pass timestamp as Firestore Timestamp object if ScanResultsScreen handles it,
        // otherwise convert to milliseconds or ISO string
        timestamp: item.timestamp, // Assuming ScanResults can handle the object via route.params.timestamp.toDate()
      };
      navigation.navigate("ScanResults", params);
    },
    [navigation]
  );
  const navigateToImageCapture = useCallback(() => {
    navigation.navigate("ImageCaptureScreen");
  }, [navigation]);

  // --- Render Logic ---
  const renderHeader = () => (
    <>
      <View
        style={[styles.headerContainer, { backgroundColor: theme.background }]}
      >
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {t("home_hello")}
        </Text>
        <Text
          style={[styles.username, { color: theme.text }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {user?.displayName?.split(" ")[0] ||
            user?.email?.split("@")[0] ||
            t("home_gardener")}
        </Text>
      </View>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <Ionicons
            name="leaf-outline"
            size={22}
            color={theme.primary}
            style={styles.cardIcon}
          />
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            {t("home_discover_plants")}
          </Text>
        </View>
        <Text style={[styles.cardText, { color: theme.textSecondary }]}>
          {t("home_discover_text")}
        </Text>
        <TouchableOpacity
          style={[styles.scanButton, { backgroundColor: theme.primary }]}
          onPress={navigateToImageCapture}
          activeOpacity={0.8}
        >
          <Ionicons
            name="scan-outline"
            size={20}
            color={theme.buttonTextDark}
          />
          <Text
            style={[styles.scanButtonText, { color: theme.buttonTextDark }]}
          >
            {t("home_scan_button")}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {t("home_recent_scans")}
      </Text>
    </>
  );

  const renderContent = () => {
    // Show initial loading indicator first
    if (isLoading) {
      return (
        <View style={styles.centeredMessageContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {t("home_loading_data")}
          </Text>
        </View>
      );
    }
    // Then show error if it exists (and not refreshing)
    if (error) {
      return (
        <View style={styles.centeredMessageContainer}>
          <Ionicons
            name="cloud-offline-outline"
            size={50}
            color={theme.placeholderIcon}
          />
          <Text style={[styles.errorText, { color: theme.error }]}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={onRefresh}
            style={[
              styles.retryButton,
              { backgroundColor: theme.retryButtonBackground },
            ]}
          >
            <Text style={[styles.retryButtonText, { color: theme.text }]}>
              {t("retry")}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    // Then show empty state if no error and list is empty
    if (recentActivities.length === 0) {
      return (
        <View style={styles.centeredMessageContainer}>
          <Ionicons
            name="images-outline"
            size={50}
            color={theme.placeholderIcon}
          />
          <Text style={[styles.noActivityText, { color: theme.text }]}>
            {t("home_no_scans")}
          </Text>
          <Text
            style={[styles.noActivitySubText, { color: theme.textSecondary }]}
          >
            {t("home_no_scans_subtext")}
          </Text>
        </View>
      );
    }
    // Otherwise, render the list
    return (
      <FlatList
        data={recentActivities}
        renderItem={({ item }) => (
          <RecentActivityItem
            item={item}
            onPress={() => navigateToScanResults(item)}
          />
        )}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.activityListContainer}
        initialNumToRender={5} // Performance tuning
        maxToRenderPerBatch={5}
        windowSize={11}
      />
    );
  };

  // --- Main Component Return ---
  return (
    // Use ScrollView primarily for the Pull-to-Refresh functionality
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing} // Controlled by isRefreshing state
          onRefresh={onRefresh} // Triggers manual fetch
          colors={[theme.primary]} // Android spinner color
          tintColor={theme.primary} // iOS spinner color
          progressBackgroundColor={theme.refreshControlBg}
        />
      }
    >
      {renderHeader()}
      {/* Render content based on state */}
      {renderContent()}
    </ScrollView>
  );
};

// --- Styles --- (Keep refined styles)
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContentContainer: {
    paddingTop: Platform.OS === "ios" ? 20 : 15,
    paddingHorizontal: 18,
    paddingBottom: 90,
    flexGrow: 1,
  },
  headerContainer: {
    marginBottom: 25,
    paddingTop: Platform.OS === "ios" ? 40 : 15,
  },
  subtitle: { fontSize: 18, fontWeight: "500" },
  username: { fontSize: 26, fontWeight: "bold", marginTop: 2 },
  centeredMessageContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
    paddingHorizontal: 20,
    minHeight: 200,
  },
  loadingText: { marginTop: 15, fontSize: 15 },
  errorText: {
    marginTop: 15,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 20,
    marginTop: 10,
  },
  retryButtonText: { fontWeight: "600", fontSize: 15 },
  noActivityText: { marginTop: 15, fontSize: 17, fontWeight: "600" },
  noActivitySubText: { marginTop: 5, fontSize: 14 },
  card: { padding: 20, borderRadius: 16, marginBottom: 30 },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  cardIcon: { marginRight: 10 },
  cardTitle: { fontSize: 19, fontWeight: "bold" },
  cardText: { fontSize: 15, marginBottom: 20, lineHeight: 21 },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 25,
    borderRadius: 12,
    justifyContent: "center",
    alignSelf: "stretch",
    shadowColor: "#BFFF00",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  scanButtonText: { marginLeft: 10, fontSize: 16, fontWeight: "bold" },
  sectionTitle: { fontSize: 21, fontWeight: "bold", marginBottom: 15 },
  activityListContainer: {
    paddingLeft: 2,
    paddingRight: 20,
    paddingVertical: 10,
  },
  activityPostContainer: {
    borderRadius: 12,
    width: screenWidth * 0.65,
    marginRight: 12,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    overflow: "hidden",
  },
  activityIconContainer: { padding: 10, borderRadius: 25, marginRight: 12 },
  activityPostDetails: { flex: 1, justifyContent: "center" },
  activityPostLabel: { fontSize: 15, fontWeight: "600", marginBottom: 3 },
  activityPostTime: { fontSize: 12 },
});

export default HomeScreen;
