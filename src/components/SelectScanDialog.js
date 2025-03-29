// src/components/SelectScanDialog.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Image,
  Modal, // Import Modal
  TouchableWithoutFeedback, // To prevent closing when tapping inside dialog
  Platform,
} from "react-native";
import { useAuth } from "../context/AuthContext"; // Adjust path if needed
import { db } from "../firebase/firebaseInit"; // Adjust path if needed
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { t } from "../localization/strings"; // Adjust path if needed
import { formatDistanceToNowStrict } from "date-fns";
import { X, AlertCircle, Image as ImageIcon } from "lucide-react-native";

// --- Helper: Time Formatting --- (Copied from SelectScanScreen)
const formatTimestamp = (timestamp) => {
  if (timestamp && typeof timestamp.toDate === "function") {
    try {
      return formatDistanceToNowStrict(timestamp.toDate(), { addSuffix: true });
    } catch (error) {
      return t("Recently") || "Recently";
    }
  } else if (timestamp instanceof Date) {
    try {
      return formatDistanceToNowStrict(timestamp, { addSuffix: true });
    } catch (error) {
      return t("Recently") || "Recently";
    }
  } else {
    return t("Recently") || "Recently";
  }
};

const SelectScanDialog = ({ isVisible, onClose, onScanSelect, theme }) => {
  const { user } = useAuth();
  const [scans, setScans] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // Start false, load on visible
  const [error, setError] = useState(null);

  // Fetch Scans - Modified to fetch only when visible and needed
  const fetchScans = useCallback(async () => {
    if (!user?.uid) {
      setError(t("login_required"));
      setIsLoading(false);
      return;
    }
    // Only fetch if dialog is becoming visible and scans are not loaded yet
    if (scans.length > 0) {
      setIsLoading(false); // Already have data
      return;
    }

    console.log("Fetching scans for dialog...");
    setIsLoading(true);
    setError(null);
    try {
      const scansQuery = query(
        collection(db, "recent_activity"),
        where("userId", "==", user.uid),
        orderBy("timestamp", "desc")
      );
      const snapshot = await getDocs(scansQuery);
      const fetchedScans = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp:
            data.timestamp instanceof Timestamp ? data.timestamp : null,
        };
      });
      setScans(fetchedScans);
    } catch (err) {
      console.error("Error fetching scans for dialog:", err);
      let userFriendlyError = t("error_loading_data");
      // Add more specific error handling if needed (like in SelectScanScreen)
      setError(userFriendlyError);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, scans.length]); // Depend on scans.length to refetch if empty

  // Effect to trigger fetch when dialog becomes visible
  useEffect(() => {
    if (isVisible) {
      fetchScans();
    } else {
      // Optional: Clear state when dialog closes to force refresh next time?
      // setScans([]);
      // setError(null);
    }
  }, [isVisible, fetchScans]);

  // Handle Selecting a Scan
  const handleSelectScan = (scanData) => {
    // Prepare data to pass back (same as before)
    const dataToPass = {
      scanId: scanData.id,
      bestLabel: scanData.bestLabel,
      bestConfidence: scanData.bestConfidence,
      imageUri: scanData.imageUri,
      description: scanData.description,
      top5: scanData.top5,
    };
    onScanSelect(dataToPass); // Pass data to the callback
    onClose(); // Close the dialog
  };

  // Render Item
  const renderScanItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.itemContainer, { backgroundColor: theme.card }]}
      onPress={() => handleSelectScan(item)}
      activeOpacity={0.7}
    >
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
            onPress={fetchScans} // Allow retry
            style={[
              styles.retryButton,
              { backgroundColor: theme.retryButtonBackground || "#333" },
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
        style={styles.listStyle} // Added style for max height
      />
    );
  };

  return (
    <Modal
      animationType="fade" // Or 'slide'
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose} // Important for Android back button
    >
      {/* Background Dimmer */}
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPressOut={onClose} // Close when tapping outside
      >
        {/* Dialog Content Wrapper - Prevents taps inside from closing */}
        <TouchableWithoutFeedback>
          <View
            style={[
              styles.dialogContainer,
              { backgroundColor: theme.headerBackground || "#101010" },
            ]}
          >
            {/* Header */}
            <View
              style={[styles.dialogHeader, { borderBottomColor: theme.border }]}
            >
              <Text style={[styles.dialogTitle, { color: theme.text }]}>
                {t("chat_attach_scan")}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Body */}
            <View style={styles.dialogBody}>{renderBody()}</View>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
};

// --- Styles --- (Adapted from SelectScanScreen and Modal needs)
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center", // Center vertically
    alignItems: "center", // Center horizontally
    backgroundColor: "rgba(0, 0, 0, 0.6)", // Dim background
    paddingHorizontal: 20, // Add some horizontal padding
  },
  dialogContainer: {
    width: "100%", // Take full width within padding
    maxWidth: 500, // Max width for larger screens
    maxHeight: "80%", // Limit height
    borderRadius: 15,
    overflow: "hidden", // Clip content to rounded borders
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  dialogHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: "600",
    flex: 1, // Allow title to take space
    textAlign: "center", // Center title
    marginLeft: 30, // Offset for close button space
  },
  closeButton: {
    padding: 5,
    width: 30, // Smaller touch target okay here
    alignItems: "flex-end",
  },
  dialogBody: {
    // Let FlatList handle scrolling/height within the maxHeight of dialogContainer
  },
  listStyle: {
    // Styles for the FlatList itself if needed (e.g., padding)
  },
  listContentContainer: {
    padding: 15,
    paddingBottom: 20, // Extra padding at bottom
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  thumbnailContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },
  thumbnail: { width: "100%", height: "100%" },
  detailsContainer: { flex: 1 },
  itemLabel: { fontSize: 15, fontWeight: "500", marginBottom: 3 },
  itemTimestamp: { fontSize: 12 },
  centerFlex: {
    // For Loading/Error/Empty states inside the dialog body
    paddingVertical: 40,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    marginTop: 15,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 21,
  },
  emptyText: { marginTop: 15, fontSize: 15, textAlign: "center" },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 20,
    marginTop: 20,
  },
  retryButtonText: { fontWeight: "600", fontSize: 14 },
});

export default SelectScanDialog;
