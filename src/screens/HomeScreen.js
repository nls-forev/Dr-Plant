import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { AuthContext } from "../../App";

const screenWidth = Dimensions.get("window").width;

// Helper function to format timestamps
const formatTimestamp = (date) => {
  const now = new Date();
  const diffMinutes = Math.round((now - date) / (1000 * 60));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hr ago`;
  return date.toLocaleDateString();
};

const RecentActivityItem = ({ item, onPress }) => {
  return (
    <TouchableOpacity style={styles.activityPostContainer} onPress={onPress}>
      {item.imageUri ? (
        <Image
          source={{ uri: item.imageUri }}
          style={styles.activityImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.activityImagePlaceholder}>
          <Ionicons name="leaf" size={50} color="#DFFF00" />
        </View>
      )}
      <View style={styles.activityPostDetails}>
        <Text style={styles.activityPostLabel}>{item.bestLabel}</Text>
        <Text style={styles.activityPostConfidence}>
          Confidence: {(item.bestConfidence * 100).toFixed(2)}%
        </Text>
        <Text style={styles.activityPostTime}>
          {item.timestamp
            ? formatTimestamp(item.timestamp.toDate())
            : "Recently"}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const HomeScreen = () => {
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch recent activities from Firebase Firestore
  const fetchRecentActivities = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const snapshot = await firebase
        .firestore()
        .collection("recent_activity")
        .where("userId", "==", user.uid)
        .orderBy("timestamp", "desc")
        .limit(10)
        .get();

      const activities = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRecentActivities(activities);
    } catch (error) {
      console.error("Error fetching recent activities:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRecentActivities();
  }, [user]);

  // Pull-to-refresh handler
  const onRefresh = () => {
    setRefreshing(true);
    fetchRecentActivities();
  };

  // Render each activity item in the FlatList
  const renderRecentActivity = ({ item }) => (
    <RecentActivityItem
      item={item}
      onPress={() => navigation.navigate("ScanResults", { ...item })}
    />
  );

  if (loading) {
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
      // Pull-to-refresh is now on the ScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#DFFF00"]}
        />
      }
    >
      <Text style={styles.title}>Dr. Plant</Text>
      <Text style={styles.subtitle}>Hello,</Text>
      <Text style={styles.username}>
        {user?.displayName || user?.email?.split("@")[0] || "Demo User"}
      </Text>

      {/* Discover Plants Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Discover Plants</Text>
        <Text style={styles.cardText}>
          Scan your plants to identify diseases and get treatment
          recommendations.
        </Text>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => navigation.navigate("Scan")}
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
          // Remove refreshControl from FlatList
          contentContainerStyle={{ paddingLeft: 10, paddingRight: 20 }}
        />
      ) : (
        <Text style={styles.noActivityText}>No recent scans</Text>
      )}

      {/* Extra content or spacing at the bottom to allow vertical scrolling */}
      <View style={{ height: 60 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000000",
  },
  contentContainer: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40, // extra space so we can scroll down
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
    color: "#DFFF00",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#111111",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  cardText: {
    fontSize: 14,
    color: "#AAAAAA",
    marginBottom: 10,
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DFFF00",
    padding: 10,
    borderRadius: 5,
    justifyContent: "center",
  },
  scanButtonText: {
    marginLeft: 5,
    fontSize: 16,
    fontWeight: "bold",
    color: "#000000",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  activityPostContainer: {
    backgroundColor: "#111111",
    borderRadius: 10,
    // Make the card take up about 70% of the screen width
    width: screenWidth * 0.7,
    marginRight: 10,
    overflow: "hidden",
  },
  activityImage: {
    width: "100%",
    height: 160,
  },
  activityImagePlaceholder: {
    width: "100%",
    height: 160,
    backgroundColor: "#222222",
    justifyContent: "center",
    alignItems: "center",
  },
  activityPostDetails: {
    padding: 10,
  },
  activityPostLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  activityPostConfidence: {
    color: "#AAAAAA",
    fontSize: 14,
    marginTop: 4,
  },
  activityPostTime: {
    color: "#AAAAAA",
    fontSize: 12,
    marginTop: 5,
  },
  noActivityText: {
    color: "#AAAAAA",
    textAlign: "center",
    marginTop: 20,
  },
});

export default HomeScreen;
