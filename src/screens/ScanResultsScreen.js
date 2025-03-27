import React, { useState } from "react"; // Removed useContext as useAuth is used
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import firebase from "firebase/compat/app";
import "firebase/compat/storage";
import "firebase/compat/firestore";
import { Ionicons } from "@expo/vector-icons";
// import { AuthContext } from "../../App"; // REMOVE THIS
import { useAuth } from "../context/AuthContext"; // IMPORT useAuth
import { diseaseDescriptions } from "../constants/plant_name_desc"; // Ensure this path is correct

const ScanResultsScreen = ({ route, navigation }) => {
  // Retrieve scan data from route parameters with defaults
  const {
    top5 = [],
    imageUri = null,
    bestLabel = "Unknown", // Provide a default label
    bestConfidence = 0, // Default confidence
    // timestamp from route param indicates viewing history, null means new scan
    timestamp: routeTimestamp = null,
    scanId = null, // Pass scanId if viewing history
  } = route.params || {};

  // const { user } = useContext(AuthContext); // REPLACE THIS
  const { user } = useAuth(); // USE THE HOOK
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false); // Separate state for upload

  // Check if this screen is showing a historical record based on timestamp/scanId
  const isHistoryView = !!routeTimestamp || !!scanId;

  // Get description from diseaseDescriptions mapping or fallback
  const description =
    diseaseDescriptions[bestLabel] ||
    `No detailed description available for ${bestLabel}. General plant care is advised.`;

  // Helper function to upload image to Firebase Storage and return the download URL
  const uploadImageAsync = async (uri) => {
    if (!uri.startsWith('file://')) {
        console.warn("uploadImageAsync: Provided URI might not be a local file URI:", uri);
        // Handle potential non-file URIs if necessary, otherwise proceed cautiously
    }
    setUploading(true);
    try {
      const response = await fetch(uri);
      if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const blob = await response.blob();

      // Generate a unique filename using user ID and timestamp
      const filename = `scans/${user?.uid || 'unknown_user'}/${Date.now()}-${uri.substring(uri.lastIndexOf("/") + 1)}`;
      console.log("Uploading image to:", filename);

      const storageRef = firebase.storage().ref().child(filename);
      const snapshot = await storageRef.put(blob);
      const downloadURL = await snapshot.ref.getDownloadURL();
      console.log("Upload successful! Download URL:", downloadURL);
      return downloadURL;
    } catch (error) {
      console.error("Error uploading image:", error);
      Alert.alert("Upload Error", `Failed to upload image: ${error.message || 'Please try again.'}`);
      throw error; // Re-throw error to be caught by handleSaveResult
    } finally {
       setUploading(false);
    }
  };

  // Function to save the scan result to Firestore
  const handleSaveResult = async () => {
    if (isHistoryView) {
        console.log("This is a history view, save button should not be visible or active.");
        return; // Should not be callable in history view
    }
    if (!user || !user.uid) { // More robust check for user and uid
      Alert.alert("Authentication Error", "You must be logged in to save results.");
      navigation.navigate("Login"); // Redirect to login?
      return;
    }

    setSaving(true);
    let uploadedImageUrl = imageUri; // Default to original URI if no upload happens or fails

    try {
      // Upload image ONLY if a local file imageUri exists (starts with file://)
      if (imageUri && imageUri.startsWith('file://')) {
        uploadedImageUrl = await uploadImageAsync(imageUri);
      } else if (imageUri) {
          console.log("Image URI is not a local file, using existing URI (if any) for saving:", imageUri);
          // Assuming imageUri might already be a URL if not starting with file://
      } else {
          console.log("No image URI provided for saving.");
          uploadedImageUrl = ""; // Ensure it's an empty string if no image
      }

      const scanData = {
        userId: user.uid,
        imageUri: uploadedImageUrl, // Use the potentially uploaded URL
        bestLabel,
        bestConfidence,
        top5: top5 || [], // Ensure top5 is an array
        timestamp: firebase.firestore.FieldValue.serverTimestamp(), // Always use server timestamp for new saves
        description: description, // Save the fetched description
      };

      console.log("Saving scan data to Firestore:", scanData);
      const docRef = await firebase.firestore().collection("recent_activity").add(scanData);
      console.log("Result saved successfully with ID:", docRef.id);

      Alert.alert("Success", "Scan result saved!");
      // Navigate back or to the main screen/history list
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate("Main", { screen: "Home" }); // Go to Home tab as fallback
      }

    } catch (error) {
      console.error("Error saving scan result:", error);
      Alert.alert(
        "Save Error",
        `An error occurred while saving: ${error.message || 'Please try again.'}`
      );
    } finally {
      setSaving(false);
    }
  };

  // Format the timestamp for display
  const displayTimestamp = routeTimestamp?.toDate
      ? routeTimestamp.toDate().toLocaleString()
      : (routeTimestamp ? new Date(routeTimestamp).toLocaleString() : null);


  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Display the captured image or a placeholder */}
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.fullImage} resizeMode="cover" />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="leaf" size={100} color="#DFFF00" />
          <Text style={styles.placeholderText}>No Image Available</Text>
        </View>
      )}

      <View style={styles.detailsContainer}>
        {/* Top Result */}
        <Text style={styles.diseaseTitle}>{bestLabel}</Text>
        <Text style={styles.confidenceText}>
          Confidence: {(bestConfidence * 100).toFixed(1)}% {/* Adjusted precision */}
        </Text>

        {/* Top 5 Predictions (conditionally rendered) */}
        {Array.isArray(top5) && top5.length > 0 && (
          <View style={styles.predictionContainer}>
            <Text style={styles.sectionTitle}>Other Possibilities</Text>
            {top5.map((prediction, index) => (
              <View key={index} style={styles.predictionRow}>
                <Text style={styles.predictionLabel}>{prediction.label}</Text>
                <Text style={styles.predictionConfidence}>
                  {(prediction.confidence * 100).toFixed(1)}% {/* Adjusted precision */}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.sectionTitle}>Description & Care</Text>
          <Text style={styles.descriptionText}>{description}</Text>
        </View>

        {/* Static Treatment Recommendations - Consider making dynamic */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>General Recommendations</Text>
          <Text style={styles.cardText}>
            Isolate the plant if possible. Remove severely affected parts using clean tools. Ensure proper watering, light, and air circulation. Consider organic treatments before chemical fungicides.
          </Text>
        </View>

        {/* Display Timestamp if viewing history */}
        {displayTimestamp && (
          <Text style={styles.timestampText}>
            Scanned on: {displayTimestamp}
          </Text>
        )}

        {/* Save Result Button - Only show for NEW scans (not history) */}
        {!isHistoryView && (
          <View style={styles.buttonContainer}>
             <TouchableOpacity
              style={[styles.button, (saving || uploading) && styles.buttonDisabled]}
              onPress={handleSaveResult}
              disabled={saving || uploading}
            >
              {saving ? (
                <ActivityIndicator color="#000" />
              ) : uploading ? (
                 <Text style={styles.buttonText}>Uploading Image...</Text>
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

// --- Styles --- (Additions/Modifications indicated)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  contentContainer: {
    paddingBottom: 50, // Increased padding at bottom
  },
  backButton: {
    position: "absolute",
    top: 50, // Adjusted for safe area
    left: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.6)", // Slightly darker background
    borderRadius: 25, // Circular
    padding: 8, // Adjusted padding
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: "100%",
    height: 350, // Slightly adjusted height
    // Removed border radius if not needed
  },
  imagePlaceholder: {
    width: "100%",
    height: 350,
    backgroundColor: "#1C1C1E", // Darker placeholder background
    justifyContent: "center",
    alignItems: "center",
  },
   placeholderText: { // Added style for placeholder text
      marginTop: 10,
      color: '#8E8E93',
      fontSize: 16,
  },
  detailsContainer: {
    padding: 20, // Uniform padding
    marginTop: -30, // Overlap image slightly for modern look
    backgroundColor: '#000000', // Ensure background covers image overlap
    borderTopLeftRadius: 20, // Rounded corners for the details section
    borderTopRightRadius: 20,
  },
  diseaseTitle: {
    fontSize: 26, // Larger title
    fontWeight: "bold",
    color: "#DFFF00",
    marginBottom: 5, // Reduced margin
    textAlign: 'center', // Center title
  },
  confidenceText: {
    fontSize: 16,
    color: "#E5E5EA", // Lighter grey
    marginBottom: 25, // Increased margin
    textAlign: 'center', // Center confidence
  },
  predictionContainer: {
    backgroundColor: "#1C1C1E", // Consistent dark card background
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  predictionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8, // Add vertical padding
    borderBottomWidth: 1, // Separator line
    borderBottomColor: '#3A3A3C', // Darker separator
  },
  predictionRowLast: { // Style for last item to remove border
      borderBottomWidth: 0,
  },
  predictionLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    flex: 1, // Allow label to wrap if long
    marginRight: 10,
  },
  predictionConfidence: {
    color: "#AEAEB2", // Grey for confidence
    fontSize: 15,
    fontWeight: '600', // Semi-bold
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 12, // Increased margin
  },
  descriptionContainer: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  descriptionText: {
    color: "#E5E5EA", // Lighter text color
    fontSize: 15, // Slightly larger font
    lineHeight: 22, // Improved line spacing
  },
  card: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8, // Increased margin
  },
  cardText: {
    fontSize: 15,
    color: "#E5E5EA",
    lineHeight: 21,
  },
  timestampText: {
    color: "#8E8E93", // Medium grey
    fontSize: 12,
    textAlign: "center",
    marginTop: 15, // Increased margin
    marginBottom: 20, // Added margin below
  },
  buttonContainer: { // Wrapper for button
      marginTop: 10,
      paddingHorizontal: 10, // Add horizontal padding if needed
  },
  button: {
    backgroundColor: "#DFFF00", // Primary action color
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: 'center', // Center content vertically
    flexDirection: 'row', // Allow icon/text if needed
    minHeight: 50, // Ensure consistent button height
  },
  buttonDisabled: { // Style for disabled button
    backgroundColor: "#555", // Grey out when disabled
  },
  buttonText: {
    color: "#000000", // Text color for primary button
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default ScanResultsScreen;