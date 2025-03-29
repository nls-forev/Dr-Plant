// src/screens/ImageCaptureScreen.js (MODIFIED VERSION)
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
import { useNavigation } from "@react-navigation/native";
import * as FileSystem from "expo-file-system";
import * as tf from "@tensorflow/tfjs";
import { bundleResourceIO, decodeJpeg } from "@tensorflow/tfjs-react-native";
import { CLASS_NAMES } from "../constants/plant_name_desc"; // Ensure path is correct
import "@tensorflow/tfjs-react-native";
import { t } from "../localization/strings"; // Ensure path is correct
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants"; // Keep if using for version or other constants

const { width: screenWidth } = Dimensions.get("window");

const ImageCaptureScreen = () => {
  // --- Theme --- (Consistent dark theme)
  const theme = {
    background: "#0A0A0A",
    text: "#EFEFEF",
    textSecondary: "#AEAEB2",
    primary: "#BFFF00",
    primaryDisabled: "#5A6A00",
    inputBackground: "#1C1C1E",
    error: "#FF9A9A",
    buttonTextDark: "#111111",
    placeholderIcon: "#888",
    card: "#1C1C1E",
    border: "#2C2C2E",
  };

  // --- State & Hooks ---
  const navigation = useNavigation();
  const [imageSource, setImageSource] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [model, setModel] = useState(null);
  const [loadingModel, setLoadingModel] = useState(true);
  const [modelError, setModelError] = useState(null);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState(null);
  const [libraryPermissionStatus, setLibraryPermissionStatus] = useState(null);
  const isMounted = useRef(true);

  // --- Permissions ---
  const requestCameraPermission = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (isMounted.current) setCameraPermissionStatus(status);
      return status === "granted";
    } catch (e) {
      Alert.alert(t("error"), t("error_permission_denied"));
      return false;
    }
  }, []);
  const requestLibraryPermission = useCallback(async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (isMounted.current) setLibraryPermissionStatus(status);
      return status === "granted";
    } catch (e) {
      Alert.alert(t("error"), t("error_permission_denied"));
      return false;
    }
  }, []);
  useEffect(() => {
    const check = async () => {
      const cs = await ImagePicker.getCameraPermissionsAsync();
      const ls = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (isMounted.current) {
        setCameraPermissionStatus(cs.status);
        setLibraryPermissionStatus(ls.status);
      }
    };
    check();
    return () => {
      isMounted.current = false;
    };
  }, []);

  // --- Model Loading ---
  const loadModel = useCallback(async () => {
    if (model || modelError) return;
    setLoadingModel(true);
    setModelError(null);
    try {
      await tf.ready();
      const mj = require("../../assets/tfjs_model/model.json");
      const mw = [
        require("../../assets/tfjs_model/group1-shard1of5.bin"),
        require("../../assets/tfjs_model/group1-shard2of5.bin"),
        require("../../assets/tfjs_model/group1-shard3of5.bin"),
        require("../../assets/tfjs_model/group1-shard4of5.bin"),
        require("../../assets/tfjs_model/group1-shard5of5.bin"),
      ];
      const lm = await tf.loadLayersModel(bundleResourceIO(mj, mw));
      if (isMounted.current) setModel(lm);
      else lm.dispose();
    } catch (e) {
      if (isMounted.current) setModelError(t("error_model_load"));
      console.error("Model Load Err:", e);
    } finally {
      if (isMounted.current) setLoadingModel(false);
    }
  }, [model, modelError]);
  useEffect(() => {
    loadModel();
  }, [loadModel]);

  // --- Image Processing ---
  const preprocessImage = async (uri) => {
    try {
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const buf = tf.util.encodeString(b64, "base64").buffer;
      const raw = new Uint8Array(buf);
      const imgTensor = decodeJpeg(raw);
      const processed = tf.tidy(() => {
        const r = tf.image.resizeBilinear(imgTensor, [224, 224]).toFloat();
        const n = r.div(255.0);
        return n.expandDims(0);
      });
      tf.dispose(imgTensor);
      return processed;
    } catch (e) {
      console.error("Preprocess Err:", e);
      throw new Error(t("error_prediction") + " " + t("error_general"));
    }
  };

  // --- Prediction Handler ---
  const handlePredict = async () => {
    if (!imageSource?.uri) {
      Alert.alert(t("error"), t("img_capture_tap_select"));
      return;
    }
    if (!model) {
      Alert.alert(
        t("error"),
        loadingModel
          ? t("img_capture_loading_model")
          : modelError || t("error_model_load")
      );
      return;
    }
    if (isPredicting) return;
    setIsPredicting(true);
    let tensor = null;
    try {
      tensor = await preprocessImage(imageSource.uri);
      if (!tensor) throw new Error("Preprocess null tensor.");
      const prediction = model.predict(tensor);
      let values;
      try {
        values = await prediction.data();
      } catch (e) {
        throw new Error(t("error_prediction") + " " + t("error_general"));
      } finally {
        if (prediction) tf.dispose(prediction);
      }
      if (!CLASS_NAMES || CLASS_NAMES.length === 0)
        throw new Error("Class names missing.");
      const results = Array.from(values)
        .map((c, i) => ({
          label: CLASS_NAMES[i]?.replace(/_/g, " ") || "?",
          confidence: Number(c.toFixed(4)),
        }))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);
      if (results.length === 0 || results[0].confidence < 0.1) {
        Alert.alert(
          t("scan_results_title"),
          "Analysis complete, confidence low. Check image quality."
        );
      }
      navigation.navigate("ScanResults", {
        top5: results,
        imageUri: imageSource.uri,
        bestLabel: results[0]?.label || "?",
        bestConfidence: results[0]?.confidence || 0,
      });
    } catch (e) {
      Alert.alert(t("error"), e.message || t("error_prediction"));
    } finally {
      if (tensor) tf.dispose(tensor);
      if (isMounted.current) setIsPredicting(false);
    }
  };

  // --- Image Picker Handlers ---
  const handleCaptureImage = useCallback(async () => {
    let granted = cameraPermissionStatus === "granted";
    if (!granted) granted = await requestCameraPermission();
    if (!granted) {
      Alert.alert(
        t("error_permission_denied"),
        t("img_capture_permission_needed"),
        [
          { text: t("cancel") },
          { text: t("settings"), onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length > 0) {
        if (isMounted.current) setImageSource({ uri: result.assets[0].uri });
      }
    } catch (error) {
      Alert.alert(t("error_camera"), error.message || t("error_general"));
    }
  }, [cameraPermissionStatus, requestCameraPermission]);

  const handleChooseFromLibrary = useCallback(async () => {
    // Handles tap on placeholder
    let granted = libraryPermissionStatus === "granted";
    if (!granted) granted = await requestLibraryPermission();
    if (!granted) {
      Alert.alert(t("error_permission_denied"), "Library access needed.", [
        { text: t("cancel") },
        { text: t("settings"), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length > 0) {
        if (isMounted.current) setImageSource({ uri: result.assets[0].uri });
      }
    } catch (error) {
      Alert.alert(t("error_library"), error.message || t("error_general"));
    }
  }, [libraryPermissionStatus, requestLibraryPermission]);

  // --- Component Styles ---
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContainer: {
      flexGrow: 1,
      alignItems: "center",
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 50,
    },
    imageContainer: {
      width: screenWidth * 0.8,
      height: screenWidth * 0.8,
      borderRadius: 16,
      backgroundColor: theme.inputBackground,
      marginBottom: 20,
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    imagePlaceholderContent: { alignItems: "center", padding: 20 },
    imagePlaceholderText: {
      color: theme.textSecondary,
      marginTop: 10,
      textAlign: "center",
      fontSize: 15,
    },
    image: { width: "100%", height: "100%" },
    tipsContainer: {
      width: "90%",
      maxWidth: 400,
      padding: 15,
      backgroundColor: theme.card,
      borderRadius: 12,
      marginBottom: 25,
    },
    tipsHeader: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 8,
      textAlign: "center",
    },
    tipsText: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    buttonRow: { width: "90%", maxWidth: 400, alignSelf: "center", gap: 15 },
    button: {
      backgroundColor: theme.card,
      flexDirection: "row",
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    buttonPrimary: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "600",
      marginLeft: 10,
    },
    buttonTextPrimary: { color: theme.buttonTextDark },
    statusContainer: {
      width: "90%",
      maxWidth: 400,
      marginTop: 25,
      padding: 15,
      borderRadius: 12,
      backgroundColor: theme.card,
      alignItems: "center",
    },
    statusText: {
      color: theme.textSecondary,
      marginTop: 10,
      textAlign: "center",
      fontSize: 15,
    },
    errorText: {
      color: theme.error,
      marginTop: 10,
      textAlign: "center",
      fontSize: 15,
      fontWeight: "500",
    },
  });

  // --- Button State ---
  const canPredict = imageSource && model && !loadingModel && !modelError;

  // --- Render ---
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContainer}
      keyboardShouldPersistTaps="handled"
    >
      {/* Image Display/Placeholder */}
      <TouchableOpacity
        style={styles.imageContainer}
        onPress={handleChooseFromLibrary}
        disabled={isPredicting}
        activeOpacity={0.7}
      >
        {imageSource ? (
          <Image source={imageSource} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholderContent}>
            <Ionicons
              name="image-outline"
              size={80}
              color={theme.placeholderIcon}
            />
            <Text style={styles.imagePlaceholderText}>
              {t("img_capture_tap_select")}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Tips Section */}
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsHeader}>Tips for Good Scans</Text>
        <Text style={styles.tipsText}>
          Use good light. Focus on leaves/stems. Avoid blur.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        {/* Take Photo Button */}
        <TouchableOpacity
          style={[styles.button, { borderColor: theme.textSecondary }]}
          onPress={handleCaptureImage}
          disabled={isPredicting}
        >
          <Ionicons
            name="camera-outline"
            size={22}
            color={theme.textSecondary}
          />
          <Text style={[styles.buttonText, { color: theme.textSecondary }]}>
            {t("img_capture_take_photo")}
          </Text>
        </TouchableOpacity>

        {/* Start Analysis Button */}
        <TouchableOpacity
          style={[
            styles.button,
            styles.buttonPrimary,
            (!canPredict || isPredicting) && styles.buttonDisabled,
          ]}
          onPress={handlePredict}
          disabled={!canPredict || isPredicting}
        >
          {isPredicting ? (
            <ActivityIndicator size="small" color={theme.buttonTextDark} />
          ) : (
            <Ionicons
              name="analytics-outline"
              size={22}
              color={theme.buttonTextDark}
            />
          )}
          <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
            {isPredicting
              ? t("img_capture_analyzing")
              : t("img_capture_start_analysis")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Model Status */}
      {(loadingModel || modelError) && (
        <View style={styles.statusContainer}>
          {loadingModel && (
            <>
              {" "}
              <ActivityIndicator size="large" color={theme.primary} />{" "}
              <Text style={styles.statusText}>
                {t("img_capture_loading_model")}
              </Text>{" "}
            </>
          )}
          {modelError && (
            <>
              {" "}
              <Ionicons
                name="warning-outline"
                size={30}
                color={theme.error}
              />{" "}
              <Text style={styles.errorText}>{modelError}</Text>{" "}
              <TouchableOpacity onPress={loadModel} style={{ marginTop: 10 }}>
                <Text style={{ color: theme.primary, fontWeight: "600" }}>
                  {t("retry")}
                </Text>
              </TouchableOpacity>{" "}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
};

export default ImageCaptureScreen;
