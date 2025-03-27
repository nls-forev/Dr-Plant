import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import Button from "../components/Button";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../hooks/useTheme";
import { useNavigation } from "@react-navigation/native";
import * as FileSystem from "expo-file-system";
import * as tf from "@tensorflow/tfjs";
import { bundleResourceIO } from "@tensorflow/tfjs-react-native";
import * as jpeg from "jpeg-js";
import { CLASS_NAMES } from "../constants/plant_name_desc";
import "@tensorflow/tfjs-react-native"; // Initialize TF.js React Native backend

// (Optional) For reloading the entire app:
import * as Updates from "expo-updates";

const ImageCaptureScreen = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();

  const [imageSource, setImageSource] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [model, setModel] = useState(null);
  const [loadingModel, setLoadingModel] = useState(false);

  // 1. Define a reusable loadModel function
  const loadModel = useCallback(async () => {
    try {
      setLoadingModel(true);
      await tf.ready();

      // Load your TFJS model
      const loadedModel = await tf.loadLayersModel(
        bundleResourceIO(
          require("../../assets/tfjs_model/model.json"),
          [
            require("../../assets/tfjs_model/group1-shard1of5.bin"),
            require("../../assets/tfjs_model/group1-shard2of5.bin"),
            require("../../assets/tfjs_model/group1-shard3of5.bin"),
            require("../../assets/tfjs_model/group1-shard4of5.bin"),
            require("../../assets/tfjs_model/group1-shard5of5.bin"),
          ]
        )
      );

      setModel(loadedModel);
      console.log("Model loaded successfully");
    } catch (error) {
      console.error("Error loading model:", error);
      Alert.alert(
        "Model Load Failed",
        "Unable to load the prediction model: " + error.message
      );
    } finally {
      setLoadingModel(false);
    }
  }, []);

  // 2. Load the model once component mounts
  useEffect(() => {
    loadModel();
  }, [loadModel]);

  // 3. Optionally reload the entire Expo app
  const reloadApp = async () => {
    try {
      await Updates.reloadAsync();
    } catch (error) {
      Alert.alert("Reload Error", "Failed to reload app: " + error.message);
    }
  };

  // Preprocess image: decode, resize to 224x224, normalize [0..1]
  const preprocessImage = async (uri) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const rawImageData = Buffer.from(base64, "base64");
      const { width, height, data } = jpeg.decode(rawImageData, {
        useTArray: true,
      });

      // Convert RGBA -> RGB
      const numPixels = width * height;
      const values = new Uint8Array(numPixels * 3);
      for (let i = 0; i < numPixels; i++) {
        values[i * 3] = data[i * 4];
        values[i * 3 + 1] = data[i * 4 + 1];
        values[i * 3 + 2] = data[i * 4 + 2];
      }

      const imgTensor = tf.tensor3d(values, [height, width, 3], "float32");
      const resized = tf.image.resizeBilinear(imgTensor, [224, 224]);
      const normalized = resized.div(255.0);
      return normalized.expandDims(0);
    } catch (error) {
      throw new Error("Image preprocessing failed: " + error.message);
    }
  };

  // Perform inference with the loaded model
  const handleRawPredict = async () => {
    if (!imageSource) {
      Alert.alert("No Image", "Please select or capture an image first.");
      return;
    }
    if (!model) {
      Alert.alert("Model Error", "Model not loaded. Try reloading the model.");
      return;
    }

    try {
      setIsPredicting(true);

      const inputTensor = await preprocessImage(imageSource.uri);
      const predictionTensor = model.predict(inputTensor);
      const predictionArray = await predictionTensor.data();

      tf.dispose([inputTensor, predictionTensor]);

      // Convert Float32Array -> normal JS array
      const probabilities = Array.from(predictionArray);

      // Create array of { label, confidence }
      const labelConfidencePairs = probabilities.map((confidence, idx) => ({
        label: CLASS_NAMES[idx].replace(/_/g, " "),
        confidence,
      }));

      // Sort descending, take top 5
      labelConfidencePairs.sort((a, b) => b.confidence - a.confidence);
      const top5 = labelConfidencePairs.slice(0, 5);
      const bestResult = top5[0];
      bestResult.label = bestResult.label.replace("   ", " ");

      // Navigate to ScanResults
      navigation.navigate("ScanResults", {
        top5,
        imageUri: imageSource.uri,
        bestLabel: bestResult.label,
        bestConfidence: bestResult.confidence,
      });
    } catch (error) {
      console.error("Prediction error:", error);
      Alert.alert(
        "Prediction Failed",
        "Error during image prediction: " + error.message
      );
    } finally {
      setIsPredicting(false);
    }
  };

  // Request camera permission
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Camera permission is needed.");
      return false;
    }
    return true;
  };

  // Capture with camera
  const handleCaptureImage = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const source = { uri: result.assets[0].uri };
        setImageSource(source);
      }
    } catch (error) {
      console.error("Error capturing image:", error);
      Alert.alert("Error", "Failed to capture image: " + error.message);
    }
  };

  // Request media library permission
  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Library permission is needed.");
      return false;
    }
    return true;
  };

  // Choose from library
  const handleChooseFromLibrary = async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const source = { uri: result.assets[0].uri };
        setImageSource(source);
      }
    } catch (error) {
      console.error("Error selecting image:", error);
      Alert.alert("Error", "Failed to select image: " + error.message);
    }
  };

  // Helper for debug info
  const formatImagePath = (path) => {
    if (!path) return "";
    const parts = path.split("/");
    return parts[parts.length - 1];
  };

  // ---------- STYLES ----------
  const styles = StyleSheet.create({
    scrollContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    contentContainer: {
      padding: 20,
      alignItems: "center",
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.text,
      marginTop: 20,
      marginBottom: 20,
      textAlign: "center",
    },
    imagePreview: {
      width: 200,
      height: 200,
      backgroundColor: theme.secondary,
      marginBottom: 20,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 10,
      overflow: "hidden",
    },
    imagePlaceholderText: {
      color: theme.text,
      textAlign: "center",
      padding: 10,
    },
    buttonContainer: {
      width: "80%",
      marginTop: 20,
    },
    captureButton: {
      marginBottom: 10,
    },
    debugInfo: {
      fontSize: 12,
      color: theme.text,
      opacity: 0.7,
      marginTop: 10,
      paddingHorizontal: 20,
      textAlign: "center",
    },
    predictionContainer: {
      width: "90%",
      marginTop: 20,
      padding: 15,
      backgroundColor: theme.card,
      borderRadius: 10,
      alignItems: "center",
    },
    predictionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 10,
    },
    predictionText: {
      fontSize: 16,
      color: theme.text,
      marginVertical: 5,
      textAlign: "center",
    },
    loadingText: {
      color: theme.text,
      marginTop: 10,
    },
    rawOutputContainer: {
      width: "100%",
      marginTop: 10,
      padding: 10,
      backgroundColor: theme.secondary,
      borderRadius: 8,
    },
    predictionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      paddingVertical: 5,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(0,0,0,0.1)",
    },
    classText: {
      flex: 3,
      fontSize: 14,
      color: theme.text,
    },
    confidenceText: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      textAlign: "right",
    },
    reloadContainer: {
      marginTop: 20,
      alignItems: "center",
    },
  });

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.title}>Plant Disease Detection</Text>

      <TouchableOpacity style={styles.imagePreview} onPress={handleCaptureImage}>
        {imageSource ? (
          <Image
            source={imageSource}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.imagePlaceholderText}>Tap to Select Image</Text>
        )}
      </TouchableOpacity>

      {imageSource && (
        <Text style={styles.debugInfo}>
          Image captured: {formatImagePath(imageSource.uri)}
        </Text>
      )}

      <View style={styles.buttonContainer}>
        <View style={styles.captureButton}>
          <Button title="Take a Photo" onPress={handleCaptureImage} />
        </View>
        <View style={styles.captureButton}>
          <Button title="Choose from Library" onPress={handleChooseFromLibrary} />
        </View>
        <Button
          title={isPredicting ? "Analyzing..." : "Predict"}
          onPress={handleRawPredict}
          disabled={!imageSource || isPredicting || !model}
        />
      </View>

      {isPredicting && (
        <View style={styles.predictionContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Analyzing image...</Text>
        </View>
      )}

      {/* If the model isn't loaded or there's an error, show reload options */}
      {!model && !loadingModel && (
        <View style={styles.reloadContainer}>
          <Text style={{ color: theme.text, marginBottom: 10 }}>
            Model not loaded. Try reloading:
          </Text>
          <Button title="Reload Model" onPress={loadModel} />
          {/* OR reload entire app (optional) */}
          <View style={{ marginTop: 10 }}>
            <Button title="Reload App" onPress={reloadApp} />
          </View>
        </View>
      )}

      {loadingModel && (
        <View style={styles.reloadContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading model...</Text>
        </View>
      )}
    </ScrollView>
  );
};

export default ImageCaptureScreen;
