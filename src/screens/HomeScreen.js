import React, { useState, useEffect, useContext } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { useAuth } from "../context/AuthContext"; // IMPORT useAuth (or AuthContext) FROM THE NEW FILE

const screenWidth = Dimensions.get("window").width;

// Helper function to format timestamps (keep as is)
const formatTimestamp = (date) => {
  // ... (your existing formatTimestamp function)
  const now = new Date();
  const diffMinutes = Math.round((now - date) / (1000 * 60));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hr ago`;
  return date.toLocaleDateString();
};

// Updated RecentActivityItem component (keep as is)
const RecentActivityItem = ({ item, onPress }) => {
  // ... (your existing RecentActivityItem component)
   return (
    <TouchableOpacity style={styles.activityPostContainer} onPress={onPress}>
      <Ionicons name="leaf" size={40} color="#DFFF00" />
      <View style={styles.activityPostDetails}>
        <Text
          style={styles.activityPostLabel}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.bestLabel || 'Scan Result'} {/* Added fallback text */}
        </Text>
        <Text style={styles.activityPostTime}>
          {item.timestamp ? formatTimestamp(item.timestamp.toDate()) : "Recently"}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
    </TouchableOpacity>
  );
};

const HomeScreen = () => {
  const navigation = useNavigation();
  // const { user } = useContext(AuthContext); // Replace if using useAuth hook
  const { user } = useAuth(); // Use the custom hook to get user
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch recent activities from Firebase Firestore
  const fetchRecentActivities = async () => {
    // No user? Clear activities, stop loading/refreshing.
    if (!user) {
      console.log("HomeScreen: No user logged in, clearing activities.");
      setRecentActivities([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setLoading(true); // Ensure loading is true when fetching starts
    console.log(`HomeScreen: Fetching activities for user ${user.uid}`);
    try {
      const snapshot = await firebase
        .firestore()
        .collection("recent_activity") // Ensure this collection name matches Firestore
        .where("userId", "==", user.uid)
        .orderBy("timestamp", "desc")
        .limit(10)
        .get();

      const activities = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // Ensure timestamp exists and is a Firestore Timestamp before calling toDate()
        timestamp: doc.data().timestamp && typeof doc.data().timestamp.toDate === 'function'
                   ? doc.data().timestamp
                   : null // Or provide a default Date if appropriate
      }));
      console.log(`HomeScreen: Fetched ${activities.length} activities.`);
      setRecentActivities(activities);
    } catch (error) {
      console.error("HomeScreen: Error fetching recent activities:", error);
      // Optionally, show an error message to the user
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Effect to fetch data when user changes (e.g., login/logout) or component mounts
  useEffect(() => {
    // Added listener for focus to refetch when navigating back to the screen
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log("HomeScreen focused, fetching activities...");
      fetchRecentActivities();
    });

    // Initial fetch or fetch on user change
    fetchRecentActivities();

    // Cleanup function to remove listener
    return unsubscribeFocus;
  }, [user, navigation]); // Depend on user and navigation

  // Pull-to-refresh handler
  const onRefresh = () => {
    console.log("HomeScreen: Refresh triggered.");
    setRefreshing(true);
    fetchRecentActivities(); // fetchRecentActivities already handles setting refreshing to false
  };

  // Render each activity item in the FlatList
  const renderRecentActivity = ({ item }) => (
    <RecentActivityItem
      item={item}
      // Pass necessary data to ScanResults, consider just passing the ID if data is large
      onPress={() => navigation.navigate("ScanResults", { scanId: item.id, ...item })}
    />
  );

  // Loading state indicator
  if (loading && !refreshing) { // Don't show full screen loader during pull-to-refresh
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DFFF00" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#DFFF00"]} // Color of the refresh indicator
          tintColor={"#DFFF00"} // Color for iOS
          progressBackgroundColor={"#333333"} // Background for Android
        />
      }
    >
      <Text style={styles.title}>Dr. Plant</Text>
      <Text style={styles.subtitle}>Hello,</Text>
      <Text style={styles.username}>
        {/* Robust user name display */}
        {user?.displayName || user?.email?.split("@")[0] || "User"}
      </Text>

      {/* Discover Plants Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Discover Plants</Text>
        <Text style={styles.cardText}>
          Scan your plants to identify diseases and get treatment recommendations.
        </Text>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => navigation.navigate("Scan")} // Ensure 'Scan' matches your Tab Navigator screen name
        >
          <Ionicons name="camera" size={20} color="#000000" />
          <Text style={styles.scanButtonText}>Scan Plant</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Activity Section */}
      <Text style={styles.sectionTitle}>Recent Activity</Text>
      {recentActivities.length > 0 ? (
        <FlatList
          data={recentActivities}
          renderItem={renderRecentActivity}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          // Added padding for better spacing
          contentContainerStyle={{ paddingHorizontal: 5, paddingVertical: 10 }}
        />
      ) : (
         // Show message only if not loading and no activities
        !loading && <Text style={styles.noActivityText}>No recent scans found. Pull down to refresh or scan a new plant!</Text>
      )}

      {/* Extra spacing for scrolling might not be needed with ScrollView's contentContainerStyle paddingBottom */}
      {/* <View style={{ height: 60 }} /> */}
    </ScrollView>
  );
};

// Styles (keep as is, minor adjustments suggested below)
const styles = StyleSheet.create({
  container: {
    flex: 1, // Make sure container takes full height
    backgroundColor: "#000000",
  },
  contentContainer: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 80, // Increased padding at the bottom for better spacing above tab bar
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: "#FFFFFF",
  },
  username: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#DFFF00", // Your theme accent color
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#1C1C1E", // Slightly different dark shade for cards
    padding: 15,
    borderRadius: 12, // Slightly larger radius
    marginBottom: 25, // Increased spacing
    shadowColor: "#000", // Optional: Add shadow for depth
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5, // for Android shadow
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 5, // Added spacing
  },
  cardText: {
    fontSize: 14,
    color: "#AEAEB2", // Lighter grey for text
    marginBottom: 15, // Increased spacing
    lineHeight: 20, // Improve readability
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DFFF00", // Your theme accent color
    paddingVertical: 12, // Slightly taller button
    paddingHorizontal: 20,
    borderRadius: 8, // Rounded corners
    justifyContent: "center",
    alignSelf: 'center', // Center button in card
    marginTop: 5, // Add some space above
  },
  scanButtonText: {
    marginLeft: 8, // Increased spacing
    fontSize: 16,
    fontWeight: "600", // Semi-bold
    color: "#000000",
  },
  sectionTitle: {
    fontSize: 20, // Slightly larger section title
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 15, // Increased spacing
  },
  activityPostContainer: {
    backgroundColor: "#1C1C1E", // Match card background
    borderRadius: 10,
    width: screenWidth * 0.55, // Slightly wider items
    // height: 90, // Slightly taller items
    marginRight: 15, // Increased spacing between items
    flexDirection: "row",
    alignItems: "center",
    padding: 12, // Uniform padding
    shadowColor: "#000", // Optional shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  activityPostDetails: {
    flex: 1, // Take available space
    marginLeft: 12, // Increased spacing
    justifyContent: 'center', // Center content vertically
  },
  activityPostLabel: {
    color: "#FFFFFF",
    fontSize: 15, // Slightly adjusted size
    fontWeight: "600", // Semi-bold
    marginBottom: 4, // Spacing between label and time
  },
  activityPostTime: {
    color: "#AEAEB2", // Match card text color
    fontSize: 12,
  },
  noActivityText: {
    color: "#AEAEB2",
    textAlign: "center",
    marginTop: 20,
    marginHorizontal: 10, // Add horizontal margin
    fontStyle: 'italic', // Italicize for emphasis
  },
});

export default HomeScreen;