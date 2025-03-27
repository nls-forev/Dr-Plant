import React, { useContext, useState } from "react";
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
import { AuthContext } from "../../App";
import { diseaseDescriptions } from "../constants/plant_name_desc";

const ScanResultsScreen = ({ route, navigation }) => {
  // Retrieve scan data from route parameters
  const {
    top5 = [],
    imageUri = null,
    bestLabel = "Leaf Spot",
    bestConfidence = 0.88,
    timestamp = null,
  } = route.params || {};

  const { user } = useContext(AuthContext);
  const [saving, setSaving] = useState(false);

  // Get description from diseaseDescriptions mapping or fallback
  const description =
    diseaseDescriptions[bestLabel] ||
    `No description available for ${bestLabel}.`;

  // Helper function to upload image to Firebase Storage and return the download URL
  const uploadImageAsync = async (uri) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      // Generate a filename from the URI (improve with unique IDs if needed)
      const filename = uri.substring(uri.lastIndexOf("/") + 1);
      const storageRef = firebase.storage().ref().child(`images/${filename}`);
      const snapshot = await storageRef.put(blob);
      const downloadURL = await snapshot.ref.getDownloadURL();
      console.log("Download URL:", downloadURL);
      return downloadURL;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw new Error("Image upload failed. Please try again.");
    }
  };

  // Function to save the scan result to Firestore
  const handleSaveResult = async () => {
    if (!user) {
      Alert.alert("Error", "User is not authenticated. Please log in again.");
      return;
    }
    setSaving(true);
    try {
      let uploadedImageUrl = "";
      // Upload image if an imageUri exists
      if (imageUri) {
        uploadedImageUrl = await uploadImageAsync(imageUri);
      }
      const scanData = {
        userId: user.uid,
        imageUri: uploadedImageUrl,
        bestLabel,
        bestConfidence,
        top5,
        // Save current server timestamp; you can modify if you want to use the passed timestamp
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        desc: description,
      };
      await firebase.firestore().collection("recent_activity").add(scanData);
      console.log("Result saved in firebase!");
      Alert.alert("Success", "Scan result saved successfully!");
      navigation.goBack();
    } catch (error) {
      console.error("Error saving scan result:", error);
      Alert.alert(
        "Save Error",
        "An error occurred while saving your scan result. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

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
        </View>
      )}

      <View style={styles.detailsContainer}>
        {/* Top Result */}
        <Text style={styles.diseaseTitle}>{bestLabel}</Text>
        <Text style={styles.confidenceText}>
          Confidence: {(bestConfidence * 100).toFixed(2)}%
        </Text>

        {/* Top 5 Predictions */}
        {top5.length > 0 && (
          <View style={styles.predictionContainer}>
            <Text style={styles.sectionTitle}>Top Predictions</Text>
            {top5.map((prediction, index) => (
              <View key={index} style={styles.predictionRow}>
                <Text style={styles.predictionLabel}>{prediction.label}</Text>
                <Text style={styles.predictionConfidence}>
                  {(prediction.confidence * 100).toFixed(2)}%
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.descriptionText}>{description}</Text>
        </View>

        {/* Treatment Recommendations */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Treatment Recommendations</Text>
          <Text style={styles.cardText}>
            Remove affected leaves. Ensure proper spacing for air circulation.
            Apply fungicide if necessary.
          </Text>
        </View>

        {/* Optional Timestamp */}
        {timestamp && (
          <Text style={styles.timestampText}>
            Scanned on:{" "}
            {timestamp.toDate
              ? timestamp.toDate().toLocaleString()
              : new Date(timestamp).toLocaleString()}
          </Text>
        )}

        {/* Save Result Button only when there is no timestamp (i.e. new scan result) */}
        {!timestamp && (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: "#DFFF00" }]}
              onPress={handleSaveResult}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={[styles.buttonText, { color: "#000" }]}>Save Result</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  backButton: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 10,
  },
  fullImage: {
    width: "100%",
    height: 400,
  },
  imagePlaceholder: {
    width: "100%",
    height: 400,
    backgroundColor: "#111111",
    justifyContent: "center",
    alignItems: "center",
  },
  detailsContainer: {
    marginTop: 20,
    padding: 10,
  },
  diseaseTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#DFFF00",
    marginBottom: 10,
  },
  confidenceText: {
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 20,
  },
  predictionContainer: {
    backgroundColor: "#111111",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  predictionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  predictionLabel: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  predictionConfidence: {
    color: "#AAAAAA",
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  descriptionContainer: {
    backgroundColor: "#111111",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  descriptionText: {
    color: "#AAAAAA",
    fontSize: 14,
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#111111",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 5,
  },
  cardText: {
    fontSize: 14,
    color: "#AAAAAA",
  },
  timestampText: {
    color: "#666666",
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  button: {
    flex: 1,
    backgroundColor: "#333333",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});

export default ScanResultsScreen;
