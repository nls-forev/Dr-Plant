// ScanResultsScreen.js
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";

const ScanResultsScreen = ({ route, navigation }) => {
  // Pull data from route params, including bestIndex
  const {
    top5 = [],
    imageUri = null,
    bestLabel = "Leaf Spot",
    bestConfidence = 0.88,
    bestIndex = -1,
  } = route.params || {};

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Removed header text so content goes up */}

      {/* Display the captured image */}
      {imageUri && (
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        </View>
      )}

      {/* Top Result Card */}
      <View style={styles.card}>
        <Text style={styles.diseaseTitle}>{bestLabel}</Text>
        <Text style={styles.confidence}>
          Confidence: {(bestConfidence * 100).toFixed(2)}%
        </Text>
        <Text style={styles.debugText}>Max Index: {bestIndex}</Text>
      </View>

      {/* Top 5 Predictions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top 5 Predictions</Text>
        {top5.map((item, index) => (
          <View key={index} style={styles.top5Row}>
            <Text style={styles.top5Label}>{item.label}</Text>
            <Text style={styles.top5Confidence}>
              {(item.confidence * 100).toFixed(2)}%
            </Text>
          </View>
        ))}
      </View>

      {/* Description */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Description</Text>
        <Text style={styles.cardText}>
          Your plant shows signs of {bestLabel}, which is a common plant disease.
        </Text>
      </View>

      {/* Treatment Recommendations */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Treatment Recommendations</Text>
        <Text style={styles.cardText}>
          Remove affected leaves. Ensure proper spacing for air circulation.
          Apply fungicide if necessary.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, { marginRight: 10 }]}
          onPress={() => navigation.navigate("Scan")}
        >
          <Text style={styles.buttonText}>Scan Another</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#DFFF00" }]}
          onPress={() => {
            // TODO: implement save logic
            console.log("Saving result...");
          }}
        >
          <Text style={[styles.buttonText, { color: "#000" }]}>Save Result</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default ScanResultsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
  },
  card: {
    backgroundColor: "#111111",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  diseaseTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#DFFF00",
    marginBottom: 5,
  },
  confidence: {
    fontSize: 14,
    color: "#FFFFFF",
  },
  debugText: {
    fontSize: 12,
    color: "#AAAAAA",
    marginTop: 5,
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
  top5Row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  top5Label: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  top5Confidence: {
    color: "#AAAAAA",
    fontSize: 14,
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
