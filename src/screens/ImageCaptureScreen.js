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
import { Camera } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../hooks/useTheme";
import { useNavigation } from "@react-navigation/native";
import * as FileSystem from "expo-file-system";
import * as tf from "@tensorflow/tfjs";
import { bundleResourceIO } from "@tensorflow/tfjs-react-native";
import * as jpeg from "jpeg-js";
import { CLASS_NAMES } from "../constants/plant_name_desc";
import "@tensorflow/tfjs-react-native";

const ImageCaptureScreen = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [imageSource, setImageSource] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [model, setModel] = useState(null);
  const [loadingModel, setLoadingModel] = useState(true);
  const [cameraPermission, setCameraPermission] = useState(null);

  // Model loading with proper asset handling
  const loadModel = useCallback(async () => {
    try {
      setLoadingModel(true);
      await tf.ready();

      const model = await tf.loadLayersModel(
        bundleResourceIO(require("../../assets/tfjs_model/model.json"), [
          require("../../assets/tfjs_model/group1-shard1of5.bin"),
          require("../../assets/tfjs_model/group1-shard2of5.bin"),
          require("../../assets/tfjs_model/group1-shard3of5.bin"),
          require("../../assets/tfjs_model/group1-shard4of5.bin"),
          require("../../assets/tfjs_model/group1-shard5of5.bin"),
        ])
      );

      setModel(model);
      console.log("Model loaded successfully");
    } catch (error) {
      console.error("Model load error:", error);
      Alert.alert(
        "Model Error",
        "Failed to load prediction model. Please restart the app."
      );
    } finally {
      setLoadingModel(false);
    }
  }, []);

  useEffect(() => {
    loadModel();
    checkCameraPermission();
  }, []);

  const checkCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setCameraPermission(status === "granted");
  };

  const preprocessImage = async (uri) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const rawImageData = Buffer.from(base64, "base64");
      const { width, height, data } = jpeg.decode(rawImageData, {
        useTArray: true,
      });

      return tf.tidy(() => {
        // Convert RGBA to RGB
        const rgbData = new Uint8Array(width * height * 3);
        for (let i = 0; i < width * height; i++) {
          rgbData[i * 3] = data[i * 4];
          rgbData[i * 3 + 1] = data[i * 4 + 1];
          rgbData[i * 3 + 2] = data[i * 4 + 2];
        }

        const tensor = tf.tensor3d(rgbData, [height, width, 3], "float32");
        const resized = tf.image.resizeBilinear(tensor, [224, 224]);
        const normalized = resized.div(255.0);
        return normalized.expandDims(0);
      });
    } catch (error) {
      throw new Error("Image processing failed: " + error.message);
    }
  };

  const handlePredict = async () => {
    if (!imageSource || !model || isPredicting) return;

    try {
      setIsPredicting(true);
      const tensor = await preprocessImage(imageSource.uri);
      const prediction = model.predict(tensor);
      const values = await prediction.data();

      const results = Array.from(values)
        .map((confidence, index) => ({
          label: CLASS_NAMES[index]?.replace(/_/g, " ") || `Class ${index}`,
          confidence: Number(confidence.toFixed(4)),
        }))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);

      navigation.navigate("ScanResults", {
        top5: results,
        imageUri: imageSource.uri,
        bestLabel: results[0].label,
        bestConfidence: results[0].confidence,
      });
    } catch (error) {
      Alert.alert("Prediction Error", error.message);
    } finally {
      setIsPredicting(false);
      tf.disposeVariables();
    }
  };

  const handleCaptureImage = async () => {
    if (!cameraPermission) {
      Alert.alert("Permission required", "Camera access is needed");
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (!result.canceled && result.assets?.length > 0) {
        setImageSource({ uri: result.assets[0].uri });
      }
    } catch (error) {
      Alert.alert("Camera Error", error.message);
    }
  };

  const handleChooseFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (!result.canceled && result.assets?.length > 0) {
        setImageSource({ uri: result.assets[0].uri });
      }
    } catch (error) {
      Alert.alert("Library Error", error.message);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      padding: 20,
    },
    scrollContainer: {
      flex: 1,
    },
    contentContainer: {
      alignItems: "center",
      paddingBottom: 40,
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.text,
      marginVertical: 20,
      textAlign: "center",
    },
    imageContainer: {
      width: 250,
      height: 250,
      borderRadius: 15,
      backgroundColor: theme.secondary,
      marginBottom: 20,
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
    },
    image: {
      width: "100%",
      height: "100%",
    },
    buttonRow: {
      width: "100%",
      maxWidth: 400,
      gap: 10,
    },
    predictionContainer: {
      width: "100%",
      marginTop: 20,
      padding: 15,
      borderRadius: 10,
      backgroundColor: theme.card,
    },
    loadingText: {
      color: theme.text,
      marginTop: 10,
      textAlign: "center",
    },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.title}>Plant Disease Detection</Text>

      <TouchableOpacity
        style={styles.imageContainer}
        onPress={handleChooseFromLibrary}
      >
        {imageSource ? (
          <Image
            source={imageSource}
            style={styles.image}
            resizeMode="contain"
          />
        ) : (
          <Text style={{ color: theme.text, textAlign: "center" }}>
            Tap to select an image
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={{
            backgroundColor: theme.primary,
            padding: 15,
            borderRadius: 10,
            alignItems: "center",
          }}
          onPress={handleCaptureImage}
        >
          <Text style={{ color: "white", fontWeight: "bold" }}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: theme.primary,
            padding: 15,
            borderRadius: 10,
            alignItems: "center",
          }}
          onPress={handleChooseFromLibrary}
        >
          <Text style={{ color: "white", fontWeight: "bold" }}>
            Choose from Library
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: isPredicting ? theme.secondary : theme.primary,
            padding: 15,
            borderRadius: 10,
            alignItems: "center",
            opacity: imageSource && model ? 1 : 0.6,
          }}
          onPress={handlePredict}
          disabled={!imageSource || isPredicting || !model}
        >
          <Text style={{ color: "white", fontWeight: "bold" }}>
            {isPredicting ? "Analyzing..." : "Start Analysis"}
          </Text>
        </TouchableOpacity>
      </View>

      {loadingModel && (
        <View style={styles.predictionContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading AI model...</Text>
        </View>
      )}

      {!model && !loadingModel && (
        <View style={styles.predictionContainer}>
          <Text style={{ color: theme.text, textAlign: "center" }}>
            Model failed to load. Please restart the app.
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

export default ImageCaptureScreen;
