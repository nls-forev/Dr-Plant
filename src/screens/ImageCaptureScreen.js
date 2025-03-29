// src/screens/ImageCaptureScreen.js
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  Linking,
  Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import * as FileSystem from "expo-file-system";
import * as tf from "@tensorflow/tfjs";
import { decodeJpeg } from "@tensorflow/tfjs-react-native"; // bundleResourceIO is now in modelLoader
import "@tensorflow/tfjs-react-native"; // Ensure backend is registered
import { CLASS_NAMES } from "../constants/plant_name_desc"; // Adjust path
import { t } from "../localization/strings"; // Adjust path
import { Ionicons, Feather } from "@expo/vector-icons"; // Using Feather for X icon

// Import the model loader utility
import {
  getModel,
  isModelLoading,
  getModelError,
  retryLoadModel,
} from "../utils/modelLoader"; // Adjust path

const { width: screenWidth } = Dimensions.get("window");
const IMAGE_SIZE = screenWidth * 0.85; // Make image area slightly larger
const TENSOR_INPUT_SIZE = 224; // Model's expected input size

const ImageCaptureScreen = () => {
  // --- Theme ---
  const theme = {
    background: "#0A0A0A",
    text: "#EFEFEF",
    textSecondary: "#AEAEB2",
    primary: "#BFFF00", // Lime green accent
    primaryDisabled: "#5A6A00",
    inputBackground: "#1C1C1E", // Dark grey for placeholders/inputs
    error: "#FF6B6B", // Softer red for errors
    buttonTextDark: "#111111",
    placeholderIcon: "#666", // Slightly darker placeholder icon
    card: "#1A1A1A", // Very dark card background
    border: "#2C2C2E", // Subtle border color
    buttonSecondaryBg: "#2C2C2E", // Background for secondary buttons
    buttonSecondaryText: "#EFEFEF",
  };

  // --- State & Hooks ---
  const navigation = useNavigation();
  const [imageSource, setImageSource] = useState(null); // { uri: string }
  const [isPredicting, setIsPredicting] = useState(false);
  const [modelStatus, setModelStatus] = useState({
    // Combined model status state
    loading: isModelLoading(),
    error: getModelError(),
  });
  const isMounted = useRef(true);

  // --- Effect for Mount/Unmount Tracking ---
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // --- Effect to Trigger Initial Model Load (if needed) & Update Status ---
  useFocusEffect(
    useCallback(() => {
      console.log("ImageCaptureScreen Focused");
      // Update status from loader on focus
      if (isMounted.current) {
        setModelStatus({ loading: isModelLoading(), error: getModelError() });
      }

      // Trigger loading only if it hasn't started and there's no error
      if (!isModelLoading() && !getModelError()) {
        getModel()
          .catch((error) => {
            // Catch error here if initial load fails and update local state
            console.error("Initial model load trigger failed:", error);
            if (isMounted.current) {
              setModelStatus({ loading: false, error: error });
            }
          })
          .finally(() => {
            // Update status again after attempt finishes
            if (isMounted.current) {
              setModelStatus({
                loading: isModelLoading(),
                error: getModelError(),
              });
            }
          });
      }
    }, []) // Empty dependency array: run on focus
  );

  // --- Permissions ---
  const requestPermission = useCallback(
    async (permissionType) => {
      let status;
      let permissionName = "";
      try {
        if (permissionType === "camera") {
          permissionName = "Camera";
          const result = await ImagePicker.requestCameraPermissionsAsync();
          status = result.status;
        } else {
          permissionName = "Media Library";
          const result =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          status = result.status;
        }

        if (status !== "granted") {
          Alert.alert(
            t("error_permission_denied"),
            t("permission_required_message", { permission: permissionName }), // Add translation like "Permission required for {permission}"
            [
              { text: t("cancel"), style: "cancel" },
              { text: t("settings"), onPress: () => Linking.openSettings() }, // Deeplink to settings
            ]
          );
          return false;
        }
        return true;
      } catch (e) {
        console.error(`Error requesting ${permissionName} permission:`, e);
        Alert.alert(t("error"), t("error_permission_request")); // Add translation
        return false;
      }
    },
    [t]
  ); // Include t in dependencies

  // --- Image Processing ---
  const preprocessImage = async (uri) => {
    try {
      console.log("Preprocessing image:", uri);
      const imgB64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const imgBuffer = tf.util.encodeString(imgB64, "base64").buffer;
      const raw = new Uint8Array(imgBuffer);
      let imgTensor = decodeJpeg(raw); // Use TFJS JPEG decoder

      const processed = tf.tidy(() => {
        // Resize and normalize the image tensor
        const resized = tf.image
          .resizeBilinear(imgTensor, [TENSOR_INPUT_SIZE, TENSOR_INPUT_SIZE])
          .toFloat();
        // Normalize: Assuming model expects 0-1 range
        const normalized = resized.div(255.0);
        // Expand dimensions to add batch size of 1
        return normalized.expandDims(0);
      });

      tf.dispose(imgTensor); // Dispose the raw tensor
      console.log("Preprocessing successful.");
      return processed;
    } catch (error) {
      console.error("Image Preprocessing Error:", error);
      throw new Error(
        t("error_image_preprocess") || "Failed to process image."
      );
    }
  };

  // --- Prediction Handler ---
  const handlePredict = async () => {
    if (!imageSource?.uri) {
      Alert.alert(t("error"), t("img_capture_select_first")); // More specific message
      return;
    }
    if (isPredicting || modelStatus.loading || modelStatus.error) {
      console.log("Prediction skipped: busy, loading, or error state.");
      return; // Prevent prediction if busy, loading, or model error
    }

    setIsPredicting(true); // Set busy state
    let tensor = null;
    let modelInstance = null;

    try {
      console.log("Attempting to get model instance...");
      modelInstance = await getModel(); // Ensure model is loaded/get instance
      if (!modelInstance)
        throw new Error("Model instance is null after getModel call."); // Should not happen if getModel works

      console.log("Preprocessing image for prediction...");
      tensor = await preprocessImage(imageSource.uri);
      if (!tensor) throw new Error("Preprocessing returned null tensor.");

      console.log("Running prediction...");
      const prediction = modelInstance.predict(tensor); // Use the loaded model
      let values;
      try {
        // Asynchronously get the prediction data
        values = await prediction.data();
      } catch (e) {
        console.error("Error getting prediction data:", e);
        throw new Error(
          t("error_prediction_process") ||
            "Error processing prediction results."
        );
      } finally {
        if (prediction) tf.dispose(prediction); // Dispose prediction tensor
      }

      if (!CLASS_NAMES || CLASS_NAMES.length === 0)
        throw new Error("Class names configuration missing.");

      // Process prediction results
      const results = Array.from(values)
        .map((confidence, index) => ({
          label: CLASS_NAMES[index]?.replace(/_/g, " ") || `Unknown ${index}`,
          confidence: Number(confidence.toFixed(4)), // Format confidence
        }))
        .sort((a, b) => b.confidence - a.confidence) // Sort by confidence descending
        .slice(0, 5); // Take top 5 results

      console.log("Top 5 Prediction Results:", results);

      // Check if any meaningful prediction was made
      if (results.length === 0 || results[0].confidence < 0.1) {
        // Adjust threshold if needed
        Alert.alert(t("scan_results_title"), t("scan_low_confidence")); // Add translation
        // Still navigate, but ScanResultsScreen should handle low confidence display
      }

      // Navigate to results screen
      navigation.navigate("ScanResults", {
        top5: results,
        imageUri: imageSource.uri,
        bestLabel: results[0]?.label || t("Unknown"),
        bestConfidence: results[0]?.confidence || 0,
      });
    } catch (error) {
      console.error("Prediction failed:", error);
      Alert.alert(t("error"), error.message || t("error_prediction"));
    } finally {
      if (tensor) tf.dispose(tensor); // Dispose input tensor
      if (isMounted.current) setIsPredicting(false); // Reset busy state
    }
  };

  // --- Image Picker Handlers ---
  const handlePickImage = useCallback(
    async (useCamera = false) => {
      const permissionType = useCamera ? "camera" : "library";
      const granted = await requestPermission(permissionType);
      if (!granted) return; // Stop if permission not granted

      const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8, // Balance quality and size
        allowsEditing: false, // Keep original image usually better for analysis
      };

      let result;
      try {
        if (useCamera) {
          result = await ImagePicker.launchCameraAsync(options);
        } else {
          result = await ImagePicker.launchImageLibraryAsync(options);
        }

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const selectedUri = result.assets[0].uri;
          if (isMounted.current) {
            console.log("Image selected/captured:", selectedUri);
            setImageSource({ uri: selectedUri }); // Update the image source state
          }
        }
      } catch (error) {
        console.error("Image Picker Error:", error);
        Alert.alert(
          t(useCamera ? "error_camera" : "error_library"),
          error.message || t("error_general")
        );
      }
    },
    [requestPermission, t]
  ); // Include t

  // --- Retry Model Load ---
  const handleRetryLoad = () => {
    setModelStatus({ loading: true, error: null }); // Show loading state immediately
    retryLoadModel()
      .catch((error) => {
        console.error("Retry model load failed:", error);
        if (isMounted.current) setModelStatus({ loading: false, error: error });
      })
      .finally(() => {
        // Update status again after attempt finishes
        if (isMounted.current) {
          setModelStatus({ loading: isModelLoading(), error: getModelError() });
        }
      });
  };

  // --- Component Styles ---
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContainer: {
      flexGrow: 1,
      alignItems: "center",
      paddingTop: Platform.OS === "ios" ? 40 : 30, // More top padding
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    imageContainer: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      borderRadius: 20, // More rounded
      backgroundColor: theme.inputBackground,
      marginBottom: 30, // Increased space below image
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
      position: "relative", // For close button positioning
    },
    imagePlaceholderContent: { alignItems: "center", padding: 20 },
    imagePlaceholderText: {
      color: theme.textSecondary,
      marginTop: 15,
      textAlign: "center",
      fontSize: 16,
      lineHeight: 22,
    },
    image: { width: "100%", height: "100%" },
    clearImageButton: {
      position: "absolute",
      top: 10,
      right: 10,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      borderRadius: 15,
      padding: 6,
      zIndex: 10,
    },
    buttonRow: {
      flexDirection: "row",
      justifyContent: "space-between", // Space out buttons
      width: "100%",
      maxWidth: 450, // Limit max width
      marginBottom: 25, // Space below the row
    },
    choiceButton: {
      backgroundColor: theme.buttonSecondaryBg,
      flexDirection: "row",
      paddingVertical: 14,
      paddingHorizontal: 15, // Adjust padding
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
      flex: 1, // Make buttons share space
      marginHorizontal: 5, // Add space between buttons
    },
    choiceButtonText: {
      color: theme.buttonSecondaryText,
      fontSize: 15,
      fontWeight: "500",
      marginLeft: 8,
    },
    analysisButtonContainer: {
      width: "100%",
      maxWidth: 450,
      marginTop: 10, // Space above analysis button
      alignItems: "center", // Center button if needed
    },
    analysisButton: {
      backgroundColor: theme.primary,
      flexDirection: "row",
      paddingVertical: 18, // Make primary button taller
      paddingHorizontal: 20,
      borderRadius: 14, // Slightly more rounded
      alignItems: "center",
      justifyContent: "center",
      minWidth: "80%", // Ensure decent width
      alignSelf: "center", // Center horizontally
      shadowColor: theme.primary, // Add glow effect
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 8,
    },
    analysisButtonDisabled: {
      backgroundColor: theme.primaryDisabled,
      shadowOpacity: 0,
      elevation: 0,
    },
    analysisButtonText: {
      color: theme.buttonTextDark,
      fontSize: 17, // Larger font
      fontWeight: "bold",
      marginLeft: 12,
    },
    statusContainer: {
      width: "90%",
      maxWidth: 450,
      marginTop: 30, // More space above status
      paddingVertical: 20,
      paddingHorizontal: 15,
      borderRadius: 12,
      backgroundColor: theme.card,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    statusText: {
      color: theme.textSecondary,
      marginTop: 12,
      textAlign: "center",
      fontSize: 15,
    },
    errorText: {
      color: theme.error,
      marginTop: 12,
      textAlign: "center",
      fontSize: 15,
      fontWeight: "500",
      lineHeight: 21,
    },
    retryButtonText: {
      color: theme.primary,
      fontWeight: "600",
      fontSize: 15,
      padding: 5, // Add padding for easier tap target
    },
  });

  // --- Derived State ---
  // Determine if the main analysis button should be enabled
  const canPredict =
    imageSource && !modelStatus.loading && !modelStatus.error && !isPredicting;

  // --- Render ---
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContainer}
      keyboardShouldPersistTaps="handled" // Helps with taps on buttons while keyboard might be involved
      showsVerticalScrollIndicator={false}
    >
      {/* Image Display/Placeholder */}
      <View style={styles.imageContainer}>
        {imageSource ? (
          <>
            <Image
              source={imageSource}
              style={styles.image}
              resizeMode="cover"
            />
            {/* Clear Image Button */}
            <TouchableOpacity
              style={styles.clearImageButton}
              onPress={() => setImageSource(null)} // Clear the image state
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increase tappable area
            >
              <Feather name="x" size={18} color={theme.text} />
            </TouchableOpacity>
          </>
        ) : (
          // Placeholder prompts user action
          <TouchableOpacity
            style={styles.imagePlaceholderContent}
            onPress={() => handlePickImage(false)} // Default to gallery on placeholder tap
            activeOpacity={0.7}
          >
            <Ionicons
              name="image-outline"
              size={100} // Larger icon
              color={theme.placeholderIcon}
            />
            <Text style={styles.imagePlaceholderText}>
              {t("img_capture_tap_select_gallery")} {/* More specific text */}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Action Buttons: Camera / Gallery */}
      <View style={styles.buttonRow}>
        {/* Choose from Library Button */}
        <TouchableOpacity
          style={styles.choiceButton}
          onPress={() => handlePickImage(false)} // False for library
          disabled={isPredicting} // Disable while predicting
        >
          <Ionicons
            name="images-outline"
            size={20}
            color={theme.buttonSecondaryText}
          />
          <Text style={styles.choiceButtonText}>
            {t("img_capture_choose_library")}
          </Text>
        </TouchableOpacity>

        {/* Take Photo Button */}
        <TouchableOpacity
          style={styles.choiceButton}
          onPress={() => handlePickImage(true)} // True for camera
          disabled={isPredicting}
        >
          <Ionicons
            name="camera-outline"
            size={20}
            color={theme.buttonSecondaryText}
          />
          <Text style={styles.choiceButtonText}>
            {t("img_capture_take_photo")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Analysis Button Container */}
      <View style={styles.analysisButtonContainer}>
        {/* Start Analysis Button - Primary Action */}
        <TouchableOpacity
          style={[
            styles.analysisButton,
            !canPredict && styles.analysisButtonDisabled, // Apply disabled style
          ]}
          onPress={handlePredict}
          disabled={!canPredict} // Disable onPress if not ready
          activeOpacity={0.8}
        >
          {isPredicting ? (
            <ActivityIndicator size="small" color={theme.buttonTextDark} />
          ) : (
            <Ionicons
              name="analytics-outline"
              size={24}
              color={theme.buttonTextDark}
            />
          )}
          <Text style={styles.analysisButtonText}>
            {isPredicting
              ? t("img_capture_analyzing")
              : t("img_capture_start_analysis")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Model Status Display */}
      {(modelStatus.loading || modelStatus.error) && (
        <View style={styles.statusContainer}>
          {modelStatus.loading && (
            <>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={styles.statusText}>
                {t("img_capture_loading_model")}
              </Text>
            </>
          )}
          {modelStatus.error &&
            !modelStatus.loading && ( // Show error only if not also loading
              <>
                <Ionicons
                  name="warning-outline"
                  size={24}
                  color={theme.error}
                />
                <Text style={styles.errorText}>
                  {modelStatus.error.message || t("error_model_load")}
                </Text>
                {/* Provide a retry button */}
                <TouchableOpacity
                  onPress={handleRetryLoad}
                  style={{ marginTop: 15 }}
                >
                  <Text style={styles.retryButtonText}>{t("retry")}</Text>
                </TouchableOpacity>
              </>
            )}
        </View>
      )}
    </ScrollView>
  );
};

export default ImageCaptureScreen;
