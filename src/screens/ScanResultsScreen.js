// ScanResultsScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform, // Keep Platform if used in markdown or styles
} from "react-native";
import firebase from "firebase/compat/app"; // Keep for Firestore/Storage
import "firebase/compat/storage"; // For image upload
import "firebase/compat/firestore"; // For saving results
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { diseaseDescriptions } from "../constants/plant_name_desc";
// Removed Markdown import as it's no longer used here
// Removed Gemini related constants and imports

const ScanResultsScreen = ({ route, navigation }) => {
  const {
    top5 = [],
    imageUri = null,
    bestLabel = "Unknown",
    bestConfidence = 0,
    timestamp: routeTimestamp = null, // Timestamp from previous save (history view)
    scanId = null, // ID from previous save (history view)
    // Removed aiGeneratedAdvice from route params if it was ever passed
  } = route.params || {};

  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Removed AI-related state: aiResponse, isAiLoading

  // Determine if this screen is showing a previously saved result
  const isHistoryView = !!routeTimestamp || !!scanId;

  const description =
    diseaseDescriptions[bestLabel] ||
    `No detailed description available for ${bestLabel}. General plant care is advised.`;

  // --- Upload Image Function --- (Keep as is)
  const uploadImageAsync = async (uri) => {
    if (!uri || !uri.startsWith("file://")) {
      console.warn("uploadImageAsync: Invalid or non-local file URI:", uri);
      throw new Error("Invalid image path provided for upload.");
    }
    setUploading(true);
    let downloadURL = null;
    try {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch image blob (status: ${response.status})`
        );
      }
      const blob = await response.blob();
      const filename = `scans/${user?.uid || "unknown_user"}/${Date.now()}-${uri
        .split("/")
        .pop()}`;
      const storageRef = firebase.storage().ref().child(filename);
      const metadata = { contentType: blob.type || "image/jpeg" };
      const snapshot = await storageRef.put(blob, metadata);
      downloadURL = await snapshot.ref.getDownloadURL();
      return downloadURL;
    } catch (error) {
      console.error("Error uploading image:", error);
      const message =
        error.code === "storage/unauthorized"
          ? "Permission denied. Check storage rules."
          : error.message || "An unknown error occurred during upload.";
      Alert.alert("Upload Error", `Failed to upload image: ${message}`);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  // --- Save Result Function (WITHOUT AI response) ---
  const handleSaveResult = async () => {
    if (isHistoryView) {
      console.warn("Save action triggered on a history view. Aborting.");
      return;
    }
    if (!user || !user.uid) {
      Alert.alert(
        "Login Required",
        "You must be logged in to save scan results.",
        [{ text: "OK", onPress: () => navigation.navigate("Login") }]
      );
      return;
    }

    // Removed check for isAiLoading

    setSaving(true);
    let uploadedImageUrl = imageUri;

    try {
      // Upload image ONLY if a *local file* imageUri exists
      if (imageUri && imageUri.startsWith("file://")) {
        uploadedImageUrl = await uploadImageAsync(imageUri);
      } else if (
        imageUri &&
        (imageUri.startsWith("http://") || imageUri.startsWith("https://"))
      ) {
        console.log("Using existing remote image URI for saving:", imageUri);
      } else {
        console.log("No valid image URI provided for saving.");
        uploadedImageUrl = null; // Explicitly set to null if no image
      }

      // Prepare data for Firestore, **WITHOUT AI advice**
      const scanData = {
        userId: user.uid,
        imageUri: uploadedImageUrl,
        bestLabel,
        bestConfidence,
        top5: top5 || [],
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        description: description,
        // REMOVED: aiGeneratedAdvice field
      };

      console.log("Saving scan data to Firestore:", scanData);
      const docRef = await firebase
        .firestore()
        .collection("recent_activity") // Ensure this matches collection name used elsewhere
        .add(scanData);
      console.log("Result saved successfully with ID:", docRef.id);

      Alert.alert("Success", "Scan result has been saved!");

      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate("Main", { screen: "Home" });
      }
    } catch (error) {
      console.error("Error saving scan result:", error);
      let saveErrorMessage = error.message || "An unknown error occurred.";
      if (error.code) {
        saveErrorMessage = `Database error (${error.code}). Please try again.`;
      } else if (error.message.includes("upload")) {
        saveErrorMessage = `Image upload failed: ${error.message}`;
      }
      Alert.alert("Save Error", `Failed to save scan: ${saveErrorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // --- REMOVED: handleAskGemini function ---

  // --- Timestamp Formatting --- (Keep as is)
  const displayTimestamp = routeTimestamp?.toDate
    ? routeTimestamp.toDate().toLocaleString()
    : routeTimestamp
    ? new Date(routeTimestamp).toLocaleString()
    : "N/A";

  // Determine overall button disabled state (simplified)
  const saveButtonDisabled = saving || uploading;

  // --- Render ---
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Image Display */}
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.fullImage}
          resizeMode="cover"
          onError={(e) =>
            console.warn("Failed to load image:", e.nativeEvent.error)
          }
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="leaf" size={100} color="#DFFF00" />
          <Text style={styles.placeholderText}>No Image Available</Text>
        </View>
      )}

      <View style={styles.detailsContainer}>
        {/* Top Result */}
        <Text style={styles.diseaseTitle} selectable={true}>
          {bestLabel}
        </Text>
        <Text style={styles.confidenceText}>
          Confidence: {(bestConfidence * 100).toFixed(1)}%
        </Text>

        {/* Top 5 Predictions */}
        {Array.isArray(top5) && top5.length > 0 && (
          <View style={styles.predictionContainer}>
            <Text style={styles.sectionTitle}>Other Possibilities</Text>
            {top5.map((prediction, index) => (
              <View
                key={index}
                style={[
                  styles.predictionRow,
                  index === top5.length - 1 ? styles.predictionRowLast : null,
                ]}
              >
                <Text style={styles.predictionLabel} selectable={true}>
                  {prediction.label}
                </Text>
                <Text style={styles.predictionConfidence}>
                  {(prediction.confidence * 100).toFixed(1)}%
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Description from constant */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.descriptionText} selectable={true}>
            {description}
          </Text>
        </View>

        {/* --- REMOVED: Ask AI Button and Response Area --- */}

        {/* General Recommendations Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>General Recommendations</Text>
          <Text style={styles.cardText} selectable={true}>
            Isolate the plant if possible. Remove severely affected parts using
            clean tools. Ensure proper watering, light, and air circulation.
            Consider organic treatments before chemical fungicides.
          </Text>
        </View>

        {/* Timestamp */}
        {displayTimestamp !== "N/A" && (
          <Text style={styles.timestampText}>
            Scanned on: {displayTimestamp}
          </Text>
        )}

        {/* Save Button */}
        {!isHistoryView && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                saveButtonDisabled && styles.buttonDisabled,
              ]}
              onPress={handleSaveResult}
              disabled={saveButtonDisabled}
            >
              {saving ? (
                <>
                  <ActivityIndicator
                    color="#000000"
                    size="small"
                    style={styles.buttonActivityIndicator}
                  />
                  <Text style={styles.buttonText}>Saving...</Text>
                </>
              ) : uploading ? (
                <>
                  <ActivityIndicator
                    color="#000000"
                    size="small"
                    style={styles.buttonActivityIndicator}
                  />
                  <Text style={styles.buttonText}>Uploading Image...</Text>
                </>
              ) : (
                <Text style={styles.buttonText}>Save to My Scans</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

// --- REMOVED: markdownStyles --- (unless used elsewhere, but not in this file anymore)

// --- Component Styles ---
// Keep your existing styles, just remove styles related to AI components
// if they are not used by other elements.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  contentContainer: { paddingBottom: 50 },
  backButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40, // Adjusted for typical safe area
    left: 15,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 25,
    padding: 8,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  fullImage: { width: "100%", height: 350 },
  imagePlaceholder: {
    width: "100%",
    height: 350,
    backgroundColor: "#1C1C1E",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: { marginTop: 10, color: "#8E8E93", fontSize: 16 },
  detailsContainer: {
    padding: 20,
    marginTop: -30, // Pulls details over the image slightly
    backgroundColor: "#000000",
    borderTopLeftRadius: 24, // Smoother curve
    borderTopRightRadius: 24,
  },
  diseaseTitle: {
    fontSize: 26, // Slightly larger
    fontWeight: "bold", // Already bold
    color: "#DFFF00", // Your brand color
    marginBottom: 8, // Increased spacing
    textAlign: "center",
  },
  confidenceText: {
    fontSize: 16,
    color: "#AEAEB2", // Lighter gray
    marginBottom: 25,
    textAlign: "center",
  },
  predictionContainer: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  predictionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10, // More spacing
    borderBottomWidth: 1,
    borderBottomColor: "#3A3A3C",
  },
  predictionRowLast: { borderBottomWidth: 0 },
  predictionLabel: { color: "#FFFFFF", fontSize: 15, flex: 1, marginRight: 10 },
  predictionConfidence: { color: "#AEAEB2", fontSize: 15, fontWeight: "600" },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600", // Semi-bold
    color: "#E5E5EA", // Light gray/white
    marginBottom: 12,
  },
  descriptionContainer: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  descriptionText: {
    color: "#E5E5EA",
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16, // Smaller than section title
    fontWeight: "600", // Semi-bold
    color: "#FFFFFF",
    marginBottom: 8,
  },
  cardText: { fontSize: 15, color: "#E5E5EA", lineHeight: 21 },
  timestampText: {
    color: "#8E8E93",
    fontSize: 12,
    textAlign: "center",
    marginTop: 15, // Ensure it's spaced from content above
    marginBottom: 20, // Space before button
  },
  buttonContainer: {
    marginTop: 10, // Added space above button if timestamp exists
    paddingHorizontal: 10, // Keep consistent padding
  },
  button: {
    backgroundColor: "#DFFF00",
    paddingVertical: 16, // Slightly taller button
    borderRadius: 12, // More rounded corners
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    minHeight: 52, // Taller min height
    // Shadow for elevation (iOS)
    shadowColor: "#DFFF00",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    // Elevation for Android
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: "#5A6A00", // Darker shade of primary
    opacity: 0.8,
    elevation: 0, // Remove shadow when disabled
    shadowOpacity: 0,
  },
  buttonActivityIndicator: {
    marginRight: 10,
  },
  buttonText: {
    color: "#000000",
    fontWeight: "bold",
    fontSize: 16,
    // Removed marginLeft, center text better
  },
  // Removed AI related styles: aiButton, aiButtonText, aiLoadingInline, aiLoadingText, aiResponseContainer, buttonTextDisabled, warningText
});

export default ScanResultsScreen;
