// src/screens/HomeScreen.js
import React, { useState, useEffect, useCallback, useRef } from "react";
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
    // Avoid console warning for potentially valid null/undefined timestamps if list is empty initially
    // console.warn("Invalid timestamp type received:", typeof timestamp);
    return t("Recently") || "Recently";
  }
};

// --- Component: Recent Activity Item (Using React.memo for performance) ---
const RecentActivityItem = React.memo(({ item, onPress }) => {
  // Don't render if item or id is missing (safety check)
  if (!item || !item.id) return null;

  // Consistent theme colors for item - Define locally or pass via props if theme changes
  const theme = {
    itemBg: "#222222", // Slightly lighter than main bg for contrast
    iconBg: "rgba(191, 255, 0, 0.1)", // Primary color with low opacity
    iconColor: "#BFFF00", // Primary color
    textPrimary: "#EFEFEF", // Main text color
    textSecondary: "#999999", // Subdued text for time
  };

  return (
    <TouchableOpacity
      style={[styles.activityPostContainer, { backgroundColor: theme.itemBg }]}
      onPress={onPress}
      activeOpacity={0.7} // Standard touch feedback opacity
    >
      <View
        style={[
          styles.activityIconContainer,
          { backgroundColor: theme.iconBg },
        ]}
      >
        {/* Leaf icon representing a scan */}
        <Ionicons name="leaf-outline" size={26} color={theme.iconColor} />
      </View>
      <View style={styles.activityPostDetails}>
        {/* Display the best label identified in the scan */}
        <Text
          style={[styles.activityPostLabel, { color: theme.textPrimary }]}
          numberOfLines={1} // Prevent long labels from wrapping excessively
          ellipsizeMode="tail" // Add "..." if label is too long
        >
          {item.bestLabel || t("scan_results_title") || "Scan Result"}
        </Text>
        {/* Display formatted relative time */}
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
  const { user } = useAuth(); // Get current user from context
  const [recentActivities, setRecentActivities] = useState([]); // State for fetched scan data
  const [isLoading, setIsLoading] = useState(true); // Tracks initial load OR load after user change
  const [isRefreshing, setIsRefreshing] = useState(false); // Tracks pull-to-refresh state
  const [error, setError] = useState(null); // State for storing fetch errors
  const isFetchingRef = useRef(false); // Ref to prevent concurrent data fetches

  // Theme (consistent dark theme for the screen)
  const theme = {
    background: "#0A0A0A", // Very dark background
    text: "#EFEFEF", // Light text for high contrast
    textSecondary: "#AEAEB2", // Slightly dimmer text for subtitles
    primary: "#BFFF00", // Bright lime green primary accent
    card: "#1C1C1E", // Dark grey for card backgrounds
    error: "#FF9A9A", // Reddish color for error messages
    refreshControlBg: "#2C2C2E", // Background color for refresh spinner area
    buttonTextDark: "#111111", // Dark text for contrast on primary buttons
    placeholderIcon: "#888", // Grey color for placeholder icons
    retryButtonBackground: "#333", // Dark background for retry button
  };

  // --- Data Fetching Logic ---
  // useCallback ensures the function reference is stable unless dependencies change
  const fetchRecentActivities = useCallback(
    async (isManualRefresh = false) => {
      // If no user is logged in, clear data and stop loading
      if (!user?.uid) {
        setRecentActivities([]);
        setIsLoading(false);
        setIsRefreshing(false);
        setError(null);
        isFetchingRef.current = false; // Reset fetch flag
        console.log("HomeScreen: No user, cleared state.");
        return;
      }

      // Prevent concurrent fetches using the ref
      if (isFetchingRef.current) {
        console.log(
          "HomeScreen: Fetch skipped, another fetch already in progress."
        );
        // If manually refreshed while fetching, stop the spinner immediately
        if (isManualRefresh) setIsRefreshing(false);
        return;
      }

      // Mark that a fetch operation has started
      isFetchingRef.current = true;

      // Set appropriate VISUAL loading state based on context
      if (isManualRefresh) {
        setIsRefreshing(true); // Show pull-down spinner
        setError(null); // Clear previous errors on manual refresh
      } else {
        // On focus/initial load: show main loader ONLY if list is empty
        // This prevents the full loader from flashing if data already exists
        if (recentActivities.length === 0) {
          setIsLoading(true);
          setError(null); // Clear previous errors on initial load
        }
      }

      console.log(
        `HomeScreen: Fetching activities (Manual: ${isManualRefresh}) for user: ${user.uid}`
      );
      try {
        // Construct the Firestore query
        const queryRef = firebase
          .firestore()
          .collection("recent_activity") // Target the correct collection
          .where("userId", "==", user.uid) // Filter by the current user's ID
          .orderBy("timestamp", "desc") // Order by timestamp, newest first
          .limit(15); // Limit the number of results for performance

        // Execute the query
        const snapshot = await queryRef.get();

        // Process the query results
        const activities = snapshot.docs.map((doc) => {
          const data = doc.data();
          // Ensure timestamp is a valid Firestore Timestamp object or null
          return {
            id: doc.id, // Include the document ID
            ...data, // Spread the rest of the document data
            timestamp:
              data.timestamp instanceof firebase.firestore.Timestamp
                ? data.timestamp
                : null, // Validate timestamp type
          };
        });

        // Update the component's state with the fetched data
        setRecentActivities(activities);
        if (error) setError(null); // Clear any previous error on successful fetch

        if (snapshot.empty) {
          console.log("HomeScreen: No recent activities found for this user.");
        } else {
          console.log(`HomeScreen: Fetched ${activities.length} activities.`);
        }
      } catch (err) {
        // Handle potential errors during the fetch operation
        console.error("HomeScreen: Error fetching activities:", err);
        let userFriendlyError = t("error_loading_data"); // Default error message

        // Provide more specific error messages based on Firestore error codes
        if (err.code === "permission-denied")
          userFriendlyError = t("error_permission_denied") + " Check rules.";
        else if (err.code === "unauthenticated")
          userFriendlyError =
            t("login_prompt"); // Should ideally not happen if user check passed
        else if (err.message?.toLowerCase().includes("network error"))
          userFriendlyError = t("error_network");
        else if (err.code === "failed-precondition") {
          // This often indicates a missing Firestore index
          userFriendlyError = t("error_loading_data") + " (DB Index missing?)";
          console.warn(
            "Firestore Index likely missing for query: recent_activity / (userId ==, timestamp DESC)"
          );
        }
        setError(userFriendlyError); // Set the error state to display message
      } finally {
        // This block always runs, whether the fetch succeeded or failed
        console.log("HomeScreen: Fetch finished, resetting states.");
        // Reset visual loading indicators
        setIsLoading(false);
        setIsRefreshing(false);
        // Mark that the fetch operation has completed
        isFetchingRef.current = false;
      }
    },
    // Dependencies for useCallback: fetch function should be re-created if user or translation function changes
    [user?.uid, t]
  );

  // --- Effect for Screen Focus ---
  // useFocusEffect runs the callback when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log("HomeScreen Focused.");
      // Fetch data only if a user is logged in and no fetch is currently running
      if (user?.uid && !isFetchingRef.current) {
        console.log("HomeScreen: Triggering fetch on focus.");
        fetchRecentActivities(false); // Trigger a non-manual fetch
      } else if (!user?.uid) {
        // If user logged out while screen was potentially cached, clear the state
        setRecentActivities([]);
        setIsLoading(false);
        setIsRefreshing(false);
        setError(null);
        isFetchingRef.current = false; // Ensure flag is reset
      } else if (isFetchingRef.current) {
        console.log(
          "HomeScreen: Focus detected, but fetch already in progress."
        );
      }
      // Return cleanup function (optional)
      return () => {
        console.log("HomeScreen Unfocused.");
      };
      // Dependencies: re-run effect if user or fetch function reference changes
    }, [user?.uid, fetchRecentActivities])
  );

  // --- Pull-to-Refresh Handler ---
  // useCallback ensures this function reference is stable
  const onRefresh = useCallback(() => {
    console.log("HomeScreen: Pull-to-refresh triggered.");
    fetchRecentActivities(true); // Trigger a manual refresh fetch
  }, [fetchRecentActivities]); // Depends only on the stable fetch function reference

  // --- Navigation Functions ---
  // useCallback ensures stable function references for passing as props
  const navigateToScanResults = useCallback(
    (item) => {
      // Prepare parameters to pass to the ScanResults screen
      const params = {
        scanId: item.id,
        imageUri: item.imageUri,
        bestLabel: item.bestLabel,
        bestConfidence: item.bestConfidence,
        top5: item.top5,
        description: item.description,
        timestamp: item.timestamp, // Pass the Firestore Timestamp object directly
      };
      console.log("Navigating to ScanResults with params:", params.scanId);
      navigation.navigate("ScanResults", params);
    },
    [navigation] // Dependency: navigation object
  );

  const navigateToImageCapture = useCallback(() => {
    console.log("Navigating to ImageCaptureScreen.");
    navigation.navigate("ImageCaptureScreen");
  }, [navigation]); // Dependency: navigation object

  // --- Render Logic: Header Section ---
  const renderHeader = () => (
    <>
      {/* Greeting Section */}
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
          {/* Display user's first name, email prefix, or a default greeting */}
          {user?.displayName?.split(" ")[0] ||
            user?.email?.split("@")[0] ||
            t("home_gardener")}
        </Text>
      </View>

      {/* Call to Action Card */}
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
          onPress={navigateToImageCapture} // Navigate to scan screen on press
          activeOpacity={0.8}
        >
          <Ionicons
            name="scan-outline" // Use scan icon
            size={20}
            color={theme.buttonTextDark} // Dark icon for contrast on light button
          />
          <Text
            style={[styles.scanButtonText, { color: theme.buttonTextDark }]}
          >
            {t("home_scan_button")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recent Scans Section Title */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {t("home_recent_scans")}
      </Text>
    </>
  );

  // --- Render Logic: Main Content Area (Loading/Error/Empty/List) ---
  const renderContent = () => {
    // 1. Show initial loading indicator if isLoading is true
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

    // 2. Show error message if an error occurred (and not currently refreshing)
    if (error && !isRefreshing) {
      return (
        <View style={styles.centeredMessageContainer}>
          <Ionicons
            name="cloud-offline-outline" // Icon indicating connectivity issue or error
            size={50}
            color={theme.placeholderIcon}
          />
          <Text style={[styles.errorText, { color: theme.error }]}>
            {error} {/* Display the user-friendly error message */}
          </Text>
          {/* Provide a button to retry fetching */}
          <TouchableOpacity
            onPress={onRefresh} // Use the same refresh handler
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

    // 3. Show empty state message if no errors and the activity list is empty
    if (recentActivities.length === 0) {
      return (
        <View style={styles.centeredMessageContainer}>
          <Ionicons
            name="images-outline" // Icon suggesting lack of scans/images
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

    // 4. Otherwise, render the horizontal list of recent activities
    return (
      <FlatList
        data={recentActivities} // The fetched scan data
        renderItem={({ item }) => (
          // Use the memoized RecentActivityItem component
          <RecentActivityItem
            item={item}
            onPress={() => navigateToScanResults(item)} // Navigate on press
          />
        )}
        keyExtractor={(item) => item.id} // Use document ID as unique key
        horizontal // Make the list scroll horizontally
        showsHorizontalScrollIndicator={false} // Hide the scroll bar
        contentContainerStyle={styles.activityListContainer} // Styling for list container
        // Performance tuning props for FlatList
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={11}
      />
    );
  };

  // --- Main Component Return ---
  return (
    // Use ScrollView to enable Pull-to-Refresh
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContentContainer} // Allows content to grow for scrolling
      showsVerticalScrollIndicator={false}
      // Configure the RefreshControl component
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing} // Connects to the refreshing state
          onRefresh={onRefresh} // Calls the refresh handler when pulled
          colors={[theme.primary]} // Spinner color on Android
          tintColor={theme.primary} // Spinner color on iOS
          progressBackgroundColor={theme.refreshControlBg} // Background for the spinner area
        />
      }
    >
      {/* Render the static header section */}
      {renderHeader()}
      {/* Render the dynamic content area based on loading/error/data state */}
      {renderContent()}
    </ScrollView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1, // Take up all available space
  },
  scrollContentContainer: {
    paddingTop: Platform.OS === "ios" ? 20 : 15, // Add padding at the top
    paddingHorizontal: 18, // Horizontal padding for content
    paddingBottom: 90, // Padding at the bottom to avoid overlap with tab bar
    flexGrow: 1, // Ensure the container can grow to enable scrolling even with little content
  },
  headerContainer: {
    marginBottom: 25, // Space below the greeting
    paddingTop: Platform.OS === "ios" ? 40 : 15, // Extra top padding for iOS status bar/notch
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "500", // Medium weight
  },
  username: {
    fontSize: 26,
    fontWeight: "bold", // Bold username
    marginTop: 2, // Small space between subtitle and username
  },
  centeredMessageContainer: {
    // For Loading, Error, and Empty states
    flexGrow: 1, // Allow this container to take available vertical space
    justifyContent: "center", // Center content vertically
    alignItems: "center", // Center content horizontally
    paddingVertical: 50, // Vertical padding
    paddingHorizontal: 20, // Horizontal padding
    minHeight: 200, // Ensure it has some minimum height
  },
  loadingText: {
    marginTop: 15, // Space above loading text
    fontSize: 15,
  },
  errorText: {
    marginTop: 15, // Space above error text
    fontSize: 16,
    textAlign: "center", // Center align error text
    lineHeight: 22, // Improve readability
    marginBottom: 20, // Space below error text before retry button
  },
  retryButton: {
    paddingVertical: 10, // Vertical padding for touch area
    paddingHorizontal: 25, // Horizontal padding
    borderRadius: 20, // Rounded corners
    marginTop: 10, // Space above retry button
  },
  retryButtonText: {
    fontWeight: "600", // Semi-bold text
    fontSize: 15,
  },
  noActivityText: {
    marginTop: 15, // Space above main empty text
    fontSize: 17,
    fontWeight: "600", // Semi-bold
  },
  noActivitySubText: {
    marginTop: 5, // Space above sub-text
    fontSize: 14,
    textAlign: "center", // Center align sub-text
  },
  card: {
    padding: 20, // Inner padding for the card
    borderRadius: 16, // Rounded corners
    marginBottom: 30, // Space below the card
  },
  cardHeader: {
    flexDirection: "row", // Arrange icon and title horizontally
    alignItems: "center", // Align items vertically in the center
    marginBottom: 10, // Space below the card header
  },
  cardIcon: {
    marginRight: 10, // Space between icon and title
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "bold", // Bold card title
  },
  cardText: {
    fontSize: 15,
    marginBottom: 20, // Space below the card text
    lineHeight: 21, // Improve readability
  },
  scanButton: {
    flexDirection: "row", // Arrange icon and text horizontally
    alignItems: "center", // Align items vertically
    paddingVertical: 14, // Vertical padding
    paddingHorizontal: 25, // Horizontal padding
    borderRadius: 12, // Rounded corners
    justifyContent: "center", // Center content horizontally
    alignSelf: "stretch", // Make button take full width of card padding
    // Subtle shadow for depth
    shadowColor: "#BFFF00", // Shadow color matches primary
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6, // Elevation for Android shadow
  },
  scanButtonText: {
    marginLeft: 10, // Space between icon and text
    fontSize: 16,
    fontWeight: "bold", // Bold button text
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "bold", // Bold section titles
    marginBottom: 15, // Space below the section title
  },
  activityListContainer: {
    // Container for the horizontal FlatList items
    paddingLeft: 2, // Slight padding to avoid cutting off shadow on the left
    paddingRight: 20, // Ensure space on the right end of the list
    paddingVertical: 10, // Vertical padding around the list items
  },
  activityPostContainer: {
    // Individual item in the horizontal list
    borderRadius: 12, // Rounded corners
    width: screenWidth * 0.65, // Set width relative to screen size
    marginRight: 12, // Space between items in the list
    flexDirection: "row", // Arrange icon and details horizontally
    alignItems: "center", // Center items vertically
    padding: 14, // Inner padding
    overflow: "hidden", // Clip content like icon background
  },
  activityIconContainer: {
    padding: 10, // Padding around the icon
    borderRadius: 25, // Make it circular
    marginRight: 12, // Space between icon container and text details
  },
  activityPostDetails: {
    flex: 1, // Allow text details to take remaining width
    justifyContent: "center", // Center text vertically if needed
  },
  activityPostLabel: {
    fontSize: 15,
    fontWeight: "600", // Semi-bold label text
    marginBottom: 3, // Small space between label and time
  },
  activityPostTime: {
    fontSize: 12, // Smaller font size for the timestamp
  },
});

export default HomeScreen;
