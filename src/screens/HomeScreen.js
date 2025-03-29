import React, { useState, useEffect, useCallback } from "react"; // Added useCallback
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
  Platform, // Import Platform
  Alert, // Import Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native"; // Added useFocusEffect
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { useAuth } from "../context/AuthContext"; // Ensure path is correct
import { formatDistanceToNowStrict } from "date-fns"; // Using date-fns for robust time formatting

const screenWidth = Dimensions.get("window").width;

// --- Helper: Time Formatting ---
const formatTimestamp = (timestamp) => {
  if (!timestamp || typeof timestamp.toDate !== "function") {
    return "Recently"; // Fallback if timestamp is invalid
  }
  try {
    const date = timestamp.toDate();
    // Using date-fns for better relative time strings
    return formatDistanceToNowStrict(date, { addSuffix: true });
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return "Recently";
  }
};

// --- Component: Recent Activity Item ---
// Use React.memo for potential performance optimization if list gets very long
// or item rendering becomes complex.
const RecentActivityItem = React.memo(({ item, onPress }) => {
  // Basic check for item validity
  if (!item || !item.id) return null;

  return (
    <TouchableOpacity
      style={styles.activityPostContainer}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.activityIconContainer}>
        <Ionicons name="leaf-outline" size={26} color="#BFFF00" />{" "}
        {/* Outline variant */}
      </View>
      <View style={styles.activityPostDetails}>
        <Text
          style={styles.activityPostLabel}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.bestLabel || "Scan Result"}
        </Text>
        <Text style={styles.activityPostTime}>
          {formatTimestamp(item.timestamp)}
        </Text>
      </View>
      {/* Optional: chevron only if interaction expected, removed for cleaner look */}
      {/* <Ionicons name="chevron-forward" size={20} color="#666" /> */}
    </TouchableOpacity>
  );
});

// --- Component: HomeScreen ---
const HomeScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [recentActivities, setRecentActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Tracks initial load
  const [isRefreshing, setIsRefreshing] = useState(false); // Tracks pull-to-refresh
  const [error, setError] = useState(null); // Tracks fetch errors

  // --- Data Fetching Logic ---
  const fetchRecentActivities = useCallback(
    async (isManualRefresh = false) => {
      if (!user) {
        // console.log("HomeScreen: No user logged in.");
        setRecentActivities([]);
        setIsLoading(false);
        setIsRefreshing(false);
        setError(null); // Clear error on logout
        return;
      }

      // Set appropriate loading state
      if (!isManualRefresh && !recentActivities.length) {
        // Only show full loader initially
        setIsLoading(true);
      } else if (isManualRefresh) {
        setIsRefreshing(true);
      }
      setError(null); // Clear previous errors on new fetch attempt

      // console.log(`HomeScreen: Fetching activities for user ${user.uid}`);
      try {
        const snapshot = await firebase
          .firestore()
          .collection("recent_activity")
          .where("userId", "==", user.uid)
          .orderBy("timestamp", "desc")
          .limit(15) // Fetch slightly more items
          .get();

        if (snapshot.empty && recentActivities.length === 0) {
          console.log("HomeScreen: No activities found for user.");
          setRecentActivities([]); // Ensure empty state if no docs
        } else {
          const activities = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            // Timestamp validation included in map
            timestamp:
              doc.data().timestamp &&
              typeof doc.data().timestamp.toDate === "function"
                ? doc.data().timestamp
                : null,
          }));
          // console.log(`HomeScreen: Fetched ${activities.length} activities.`);
          setRecentActivities(activities); // Update state
        }
      } catch (err) {
        console.error("HomeScreen: Error fetching recent activities:", err);
        // Set user-friendly error message
        if (err.code === "permission-denied") {
          setError(
            "Oops! We couldn't access your activity. Please check your connection or try again later."
          );
        } else {
          setError(
            "Hmm, something went wrong while loading your scans. Pull down to refresh."
          );
        }
        // Optionally show an Alert for critical errors
        // Alert.alert("Load Failed", "Could not fetch recent scans. Please ensure you are connected to the internet.");
      } finally {
        // Always turn off loading indicators
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user, recentActivities.length]
  ); // Include recentActivities.length to adjust initial loading logic

  // --- Effect for Focus & User Change ---
  // useFocusEffect is often better for focus-related data fetching than addListener
  useFocusEffect(
    useCallback(() => {
      // console.log("HomeScreen focused, fetching activities if user exists...");
      if (user) {
        // Fetch data, but don't treat it as a manual refresh unless triggered by pull-down
        // We don't necessarily want the refresh indicator spinning every time the screen focuses.
        fetchRecentActivities(false);
      } else {
        // Clear state if user logs out while screen might be cached
        setRecentActivities([]);
        setIsLoading(false);
        setError(null);
      }

      // No specific cleanup needed here unless subscribing to something else
      return () => {
        // console.log("HomeScreen unfocused");
      };
    }, [user, fetchRecentActivities]) // Depend on user and the fetch function itself
  );

  // --- Pull-to-Refresh Handler ---
  const onRefresh = () => {
    // console.log("HomeScreen: Pull-to-refresh triggered.");
    fetchRecentActivities(true); // Call fetch with manual refresh flag
  };

  // --- Navigation ---
  const navigateToScanResults = useCallback(
    (item) => {
      // Pass only necessary data, especially if item contains large fields
      navigation.navigate("ScanResults", {
        scanId: item.id,
        // Pass other fields needed by ScanResults screen
        imageUri: item.imageUri,
        bestLabel: item.bestLabel,
        bestConfidence: item.bestConfidence,
        top5: item.top5,
        timestamp: item.timestamp, // Make sure timestamp is serializable if needed, or refetch in ScanResults using ID
        description: item.description,
      });
    },
    [navigation]
  );

  const navigateToImageCapture = useCallback(() => {
    navigation.navigate("ImageCaptureScreen"); // Ensure name matches your route
  }, [navigation]);

  // --- Render Logic ---

  const renderHeader = () => (
    <>
      {/* Replaced title with a more subtle header potentially */}
      {/* <Text style={styles.title}>Dr. Plant</Text> */}
      <View style={styles.headerContainer}>
        <Text style={styles.subtitle}>Hello,</Text>
        <Text style={styles.username} numberOfLines={1} ellipsizeMode="tail">
          {user?.displayName?.split(" ")[0] ||
            user?.email?.split("@")[0] ||
            "Gardener"}
        </Text>
        {/* Maybe add an icon button here later? */}
      </View>

      {/* Discover Plants Section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons
            name="leaf-outline"
            size={22}
            color="#DFFF00"
            style={styles.cardIcon}
          />
          <Text style={styles.cardTitle}>Discover Plants</Text>
        </View>
        <Text style={styles.cardText}>
          Scan your plants to identify potential issues and receive care
          guidance.
        </Text>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={navigateToImageCapture}
          activeOpacity={0.8}
        >
          <Ionicons name="scan-outline" size={20} color="#111" />
          <Text style={styles.scanButtonText}>Scan Plant Now</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Activity Title */}
      <Text style={styles.sectionTitle}>Recent Scans</Text>
    </>
  );

  const renderContent = () => {
    // 1. Initial Loading State
    if (isLoading) {
      return (
        <View style={styles.centeredMessageContainer}>
          <ActivityIndicator size="large" color="#DFFF00" />
          <Text style={styles.loadingText}>Loading your garden data...</Text>
        </View>
      );
    }

    // 2. Error State
    if (error && !isRefreshing) {
      // Don't show full error during refresh attempt
      return (
        <View style={styles.centeredMessageContainer}>
          <Ionicons name="cloud-offline-outline" size={50} color="#888" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // 3. Empty State (No Activities)
    if (recentActivities.length === 0) {
      return (
        <View style={styles.centeredMessageContainer}>
          <Ionicons name="images-outline" size={50} color="#888" />
          <Text style={styles.noActivityText}>No recent scans found.</Text>
          <Text style={styles.noActivitySubText}>
            Start by scanning a plant!
          </Text>
        </View>
      );
    }

    // 4. Success State (Show Activities)
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
      />
    );
  };

  return (
    // Use ScrollView to allow pulling down the entire content including the header
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          colors={["#BFFF00"]} // Spinner color for Android
          tintColor={"#BFFF00"} // Spinner color for iOS
          progressBackgroundColor={"#2C2C2E"}
        />
      }
    >
      {renderHeader()}
      {renderContent()}
    </ScrollView>
  );
};

// --- Styles --- (Refined for a more professional look)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A", // Slightly off-black
  },
  scrollContentContainer: {
    paddingTop: Platform.OS === "ios" ? 60 : 30, // Adjust for status bar
    paddingHorizontal: 18,
    paddingBottom: 90, // Space above bottom tab bar
    flexGrow: 1, // Ensures ScrollView content can fill space if short
  },
  // --- Header ---
  headerContainer: {
    marginBottom: 25,
  },
  subtitle: {
    fontSize: 18, // Was 18
    color: "#AEAEB2", // Lighter grey
    fontWeight: "500",
  },
  username: {
    fontSize: 26, // Increased size
    fontWeight: "bold",
    color: "#EFEFEF", // Near white, less harsh than pure white
    marginTop: 2,
  },
  // --- Loading, Error, Empty States ---
  centeredMessageContainer: {
    flexGrow: 1, // Takes available space in ScrollView
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50, // Add vertical padding
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 15,
    color: "#AEAEB2",
  },
  errorText: {
    marginTop: 15,
    fontSize: 16,
    color: "#FF9A9A", // Lighter red for error text
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#333",
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 20,
  },
  retryButtonText: {
    color: "#EFEFEF",
    fontWeight: "600",
    fontSize: 15,
  },
  noActivityText: {
    marginTop: 15,
    fontSize: 17,
    fontWeight: "600",
    color: "#E0E0E0",
  },
  noActivitySubText: {
    marginTop: 5,
    fontSize: 14,
    color: "#AEAEB2",
  },
  // --- Scan Card ---
  card: {
    backgroundColor: "#1C1C1E",
    padding: 20, // Increased padding
    borderRadius: 16, // More rounded
    marginBottom: 30,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  cardIcon: {
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 19, // Slightly larger
    fontWeight: "bold", // Bold
    color: "#FFFFFF",
  },
  cardText: {
    fontSize: 15,
    color: "#C7C7CC", // Slightly lighter grey
    marginBottom: 20, // More space before button
    lineHeight: 21,
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#BFFF00", // Theme accent
    paddingVertical: 14, // Taller button
    paddingHorizontal: 25,
    borderRadius: 12, // More rounded button
    justifyContent: "center",
    alignSelf: "stretch", // Make button full width of card padding
    // Shadow for elevation
    shadowColor: "#BFFF00",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  scanButtonText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: "bold",
    color: "#111111", // Dark text on light button
  },
  // --- Recent Scans Section ---
  sectionTitle: {
    fontSize: 21, // Larger
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 15,
  },
  activityListContainer: {
    paddingLeft: 2, // Start list near edge
    paddingRight: 20, // Ensure last item has space on right
    paddingVertical: 10, // Add vertical padding
  },
  activityPostContainer: {
    backgroundColor: "#222222", // Slightly darker card for items
    borderRadius: 12,
    width: screenWidth * 0.65, // Wider items
    // height: 85, // Fixed height can be problematic, let content dictate
    marginRight: 12,
    flexDirection: "row",
    alignItems: "center",
    padding: 14, // Good padding
    overflow: "hidden", // Prevent shadow clipping issues if any
  },
  activityIconContainer: {
    backgroundColor: "rgba(191, 255, 0, 0.1)", // Subtle background for icon
    padding: 10,
    borderRadius: 25, // Circle
    marginRight: 12,
  },
  activityPostDetails: {
    flex: 1,
    justifyContent: "center",
  },
  activityPostLabel: {
    color: "#EFEFEF",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 3,
  },
  activityPostTime: {
    color: "#999999", // Darker grey for timestamp
    fontSize: 12,
  },
});

export default HomeScreen;
