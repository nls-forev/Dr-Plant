// src/screens/SelectScanScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Image, // To display scan thumbnail
  Platform,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebaseInit"; // Ensure correct path
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from "firebase/firestore"; // Import Timestamp
import { useNavigation } from "@react-navigation/native";
import { t } from "../localization/strings"; // Ensure correct path
import { formatDistanceToNowStrict } from "date-fns";
import { X, AlertCircle, Image as ImageIcon } from "lucide-react-native";

// --- Helper: Time Formatting ---
const formatTimestamp = (timestamp) => {
  // Check if it's a Firestore Timestamp object
  if (timestamp && typeof timestamp.toDate === "function") {
    try {
      const date = timestamp.toDate();
      // Using date-fns for better relative time strings
      // Consider adding locale support later
      return formatDistanceToNowStrict(date, { addSuffix: true });
    } catch (error) {
      console.error("Error formatting Firestore timestamp:", error);
      return t("Recently") || "Recently";
    }
  }
  // Handle if it's already a JS Date object (less likely from Firestore v9+)
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

const SelectScanScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [scans, setScans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Theme
  const theme = {
    background: "#0A0A0A",
    headerBackground: "#101010",
    text: "#EFEFEF",
    textSecondary: "#AEAEB2",
    primary: "#BFFF00",
    card: "#1C1C1E",
    border: "#2C2C2E",
    error: "#FF9A9A",
    placeholderIcon: "#888",
    retryButtonBackground: "#333",
  };

  // Fetch Scans
  const fetchScans = useCallback(async () => {
    if (!user?.uid) {
      setError(t("login_required"));
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const scansQuery = query(
        collection(db, "recent_activity"),
        where("userId", "==", user.uid),
        orderBy("timestamp", "desc")
        // limit(50) // Optional limit
      );
      const snapshot = await getDocs(scansQuery);
      const fetchedScans = snapshot.docs.map((doc) => {
        const data = doc.data();
        // Ensure timestamp is correctly handled (it should be Firestore Timestamp)
        return {
          id: doc.id,
          ...data,
          // Keep timestamp as Firestore Timestamp object for reliable comparison/formatting
          timestamp:
            data.timestamp instanceof Timestamp ? data.timestamp : null,
          // Convert other necessary fields if needed, ensure serializability if passing complex objects
        };
      });
      setScans(fetchedScans);
    } catch (err) {
      console.error("Error fetching scans for selection:", err);
      let userFriendlyError = t("error_loading_data");
      if (err.code === "permission-denied") {
        userFriendlyError = t("error_permission_denied");
      } else if (err.code === "unauthenticated") {
        userFriendlyError = t("login_required");
      } else if (err.code === "failed-precondition") {
        userFriendlyError = t("error_loading_data") + " (DB Index missing?)";
        console.warn(
          "Firestore Index likely missing for query: recent_activity / (userId ==, timestamp DESC)"
        );
      }
      setError(userFriendlyError);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  // Handle Selecting a Scan
  const handleSelectScan = (scanData) => {
    // Prepare data to pass back - ensure it's serializable if complex
    const dataToPass = {
      scanId: scanData.id,
      bestLabel: scanData.bestLabel,
      bestConfidence: scanData.bestConfidence,
      imageUri: scanData.imageUri, // Pass URI, can be fetched again if needed
      description: scanData.description,
      top5: scanData.top5, // Pass top5 array
      // Don't pass the raw Firestore timestamp object directly if it causes issues
      // Pass as ISO string or milliseconds if needed, but formatTimestamp handles the object
      // timestamp: scanData.timestamp?.toMillis(), // Example: Pass milliseconds
    };

    // Navigate back to ChatScreen and pass the selected data
    navigation.navigate({
      name: "ChatScreen",
      params: { selectedScanData: dataToPass }, // Pass the prepared object
      merge: true, // Merge params with existing ones on ChatScreen
    });
  };

  // Render Item
  const renderScanItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.itemContainer, { backgroundColor: theme.card }]}
      onPress={() => handleSelectScan(item)}
      activeOpacity={0.7}
    >
      {/* Thumbnail */}
      <View
        style={[
          styles.thumbnailContainer,
          { backgroundColor: theme.background },
        ]}
      >
        {item.imageUri ? (
          <Image
            source={{ uri: item.imageUri }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <ImageIcon size={24} color={theme.placeholderIcon} />
        )}
      </View>
      {/* Details */}
      <View style={styles.detailsContainer}>
        <Text
          style={[styles.itemLabel, { color: theme.text }]}
          numberOfLines={1}
        >
          {item.bestLabel || t("Unknown")}
        </Text>
        <Text style={[styles.itemTimestamp, { color: theme.textSecondary }]}>
          {formatTimestamp(item.timestamp)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Render Content (Loading/Error/Empty/List)
  const renderBody = () => {
    if (isLoading) {
      return (
        <ActivityIndicator
          style={styles.centerFlex}
          size="large"
          color={theme.primary}
        />
      );
    }
    if (error) {
      return (
        <View style={styles.centerFlex}>
          <AlertCircle size={40} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={fetchScans}
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
    if (scans.length === 0) {
      return (
        <View style={styles.centerFlex}>
          <ImageIcon size={50} color={theme.placeholderIcon} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {t("home_no_scans")}
          </Text>
        </View>
      );
    }
    return (
      <FlatList
        data={scans}
        renderItem={renderScanItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContentContainer}
      />
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.headerBackground }]}
    >
      {/* Custom Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={{ width: 40 }} /> {/* Spacer to balance close button */}
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t("chat_attach_scan")}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
        >
          <X size={26} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
      {/* Body */}
      <View
        style={[styles.bodyContainer, { backgroundColor: theme.background }]}
      >
        {renderBody()}
      </View>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  bodyContainer: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "600" },
  closeButton: { padding: 5, width: 40, alignItems: "flex-end" },
  listContentContainer: { padding: 15 },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  thumbnailContainer: {
    width: 55,
    height: 55,
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },
  thumbnail: { width: "100%", height: "100%" },
  detailsContainer: { flex: 1 },
  itemLabel: { fontSize: 16, fontWeight: "500", marginBottom: 4 },
  itemTimestamp: { fontSize: 13 },
  centerFlex: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    marginTop: 15,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyText: { marginTop: 15, fontSize: 16, textAlign: "center" },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 20,
    marginTop: 20,
  },
  retryButtonText: { fontWeight: "600", fontSize: 15 },
});

export default SelectScanScreen;
