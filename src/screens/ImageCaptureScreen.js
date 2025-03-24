import React, { useState, useEffect } from "react";
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

// Initialize TF.js React Native backend
import "@tensorflow/tfjs-react-native";

// Since the model is now for cat and dog, we only have two classes.
const CLASS_NAMES = ["Cat", "Dog"];

const ImageCaptureScreen = () => {
  const { theme } = useTheme();
  const [imageSource, setImageSource] = useState(null);
  const navigation = useNavigation();
  const [isPredicting, setIsPredicting] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [model, setModel] = useState(null);

  // Load the model when the component mounts
  useEffect(() => {
    const loadModel = async () => {
      try {
        // Ensure TensorFlow is ready
        await tf.ready();

        // IMPORTANT: This requires you to have .bin in Metro's assetExts.
        const loadedModel = await tf.loadLayersModel(
          bundleResourceIO(
            require("../../assets/model_js/model.json"),
            [require("../../assets/model_js/weights.bin")]
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
      }
    };

    loadModel();
  }, []);

  // Preprocess the image for the model (assumes 224x224 input size)
  const preprocessImage = async (uri) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const rawImageData = Buffer.from(base64, "base64");
      const { width, height, data } = jpeg.decode(rawImageData, {
        useTArray: true,
      });

      // Remove alpha channel (convert RGBA to RGB)
      const numPixels = width * height;
      const values = new Uint8Array(numPixels * 3);
      for (let i = 0; i < numPixels; i++) {
        values[i * 3] = data[i * 4]; // Red channel
        values[i * 3 + 1] = data[i * 4 + 1]; // Green channel
        values[i * 3 + 2] = data[i * 4 + 2]; // Blue channel
      }

      // Create a tensor from the RGB values
      const imgTensor = tf.tensor3d(values, [height, width, 3], "float32");

      // Resize and normalize the image (assuming the model expects 224x224 input)
      const resized = tf.image.resizeBilinear(imgTensor, [224, 224]);
      const normalized = resized.div(255.0);

      // Add a batch dimension: [1, height, width, channels]
      return normalized.expandDims(0);
    } catch (error) {
      throw new Error("Image preprocessing failed: " + error.message);
    }
  };

  // Perform prediction using the loaded model
  const handleRawPredict = async () => {
    if (!imageSource) {
      Alert.alert("No Image", "Please select or capture an image first");
      return;
    }
    if (!model) {
      Alert.alert("Model Error", "Model is not loaded yet");
      return;
    }

    try {
      setIsPredicting(true);
      setPrediction(null);

      const inputTensor = await preprocessImage(imageSource.uri);
      const predictionTensor = model.predict(inputTensor);

      // Apply softmax to convert logits into probabilities
      const softmaxOutput = predictionTensor.softmax();
      const predictionArray = await softmaxOutput.data();
      
      // Dispose tensors to free memory
      tf.dispose([inputTensor, predictionTensor, softmaxOutput]);

      // Get prediction information
      const predictions = Array.from(predictionArray);
      const maxIndex = predictions.indexOf(Math.max(...predictions));
      const maxConfidence = predictions[maxIndex];

      const result = {
        class: CLASS_NAMES[maxIndex],
        confidence: maxConfidence,
        rawSoftmax: predictions, // raw probability output
      };

      setPrediction(result);
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
      Alert.alert(
        "Permission required",
        "Camera permission is needed to take photos"
      );
      return false;
    }
    return true;
  };

  // Request media library permission
  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Media library permission is needed to select photos"
      );
      return false;
    }
    return true;
  };

  // Capture image using camera
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

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const source = { uri: result.assets[0].uri };
        setImageSource(source);
        setPrediction(null);
      }
    } catch (error) {
      console.error("Error capturing image:", error);
      Alert.alert("Error", "Failed to capture image: " + error.message);
    }
  };

  // Choose image from library
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

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const source = { uri: result.assets[0].uri };
        setImageSource(source);
        setPrediction(null);
      }
    } catch (error) {
      console.error("Error selecting image:", error);
      Alert.alert("Error", "Failed to select image: " + error.message);
    }
  };

  // Format image path for debug info
  const formatImagePath = (path) => {
    if (!path) return "";
    const parts = path.split("/");
    return parts[parts.length - 1];
  };

  // Styles
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
  });

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.title}>Cat vs. Dog Detection</Text>

      <TouchableOpacity
        style={styles.imagePreview}
        onPress={handleCaptureImage}
      >
        {imageSource ? (
          <Image
            source={imageSource}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.imagePlaceholderText}>
            Tap to Select Image
          </Text>
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
          <Button
            title="Choose from Library"
            onPress={handleChooseFromLibrary}
          />
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

      {prediction && (
        <View style={styles.predictionContainer}>
          <Text style={styles.predictionTitle}>Prediction Results</Text>
          <Text style={[styles.predictionText, { fontWeight: "bold" }]}>
            Detected: {prediction.class}
          </Text>
          <Text style={styles.predictionText}>
            Confidence: {(prediction.confidence * 100).toFixed(2)}%
          </Text>
          <Text style={[styles.predictionTitle, { marginTop: 15, fontSize: 16 }]}>
            Raw Softmax Output
          </Text>
          <View style={styles.rawOutputContainer}>
            {prediction.rawSoftmax.map((confidence, idx) => (
              <View key={idx} style={styles.predictionRow}>
                <Text style={styles.classText}>
                  {CLASS_NAMES[idx]}
                </Text>
                <Text style={styles.confidenceText}>
                  {(confidence * 100).toFixed(2)}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default ImageCaptureScreen;
