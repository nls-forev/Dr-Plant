// src/screens/ScanResultsScreen.js
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  Share,
  Dimensions,
} from "react-native";
import firebase from "firebase/compat/app";
import "firebase/compat/storage";
import "firebase/compat/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext"; // Ensure path is correct
import { diseaseDescriptions } from "../constants/plant_name_desc"; // Ensure path is correct
import { t } from "../localization/strings"; // Ensure path is correct
import { useNavigation } from "@react-navigation/native";
import Markdown from "react-native-markdown-display"; // For AI description display

// --- Gemini Config for Description Fetch ---
// 🚨 IMPORTANT: Use environment variables or a secure config method for API keys!
const GEMINI_API_KEY_DESC = "AIzaSyDEhRYRo_ajQdvHlEdm44vu_MSPSX5T5Vw"; // Replace with your actual key or env var
const GEMINI_MODEL_NAME_DESC = "gemini-1.5-flash";
// Stricter check for placeholder/invalid key
const isApiKeyValidDesc =
  GEMINI_API_KEY_DESC &&
  GEMINI_API_KEY_DESC !== "YOUR_DESC_API_KEY" &&
  GEMINI_API_KEY_DESC.length > 30;

const { width: screenWidth } = Dimensions.get("window");

const ScanResultsScreen = ({ route }) => {
  const navigation = useNavigation();
  const {
    top5 = [],
    imageUri = null,
    bestLabel = t("Unknown") || "Unknown",
    bestConfidence = 0,
    timestamp: routeTimestamp = null, // Timestamp from DB for history items
    scanId = null, // ID from DB for history items
  } = route.params || {};

  // --- Theme --- (Assuming the theme object is correctly defined)
  const theme = {
    background: "#0A0A0A",
    text: "#EFEFEF",
    textSecondary: "#AEAEB2",
    primary: "#BFFF00",
    primaryDisabled: "#5A6A00",
    card: "#1C1C1E",
    border: "#3A3A3C",
    error: "#FF9A9A",
    buttonTextDark: "#111111",
    placeholderIcon: "#888",
    aiDescriptionBg: "#2C2C2E",
  };

  // --- State ---
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const isMounted = useRef(true);
  const [aiDescription, setAiDescription] = useState(""); // State to hold fetched AI description
  const [isFetchingDescription, setIsFetchingDescription] = useState(false);
  const [descriptionError, setDescriptionError] = useState(null);

  // --- Computed Values ---
  const isHistoryView = !!scanId; // Determines if we are viewing a saved result
  // Get static description from local map, or null if not found
  const staticDescription = diseaseDescriptions[bestLabel] || null;
  // Determine if AI description is needed (only for new scans where static is missing and label is valid)
  const needsAiDescription =
    !staticDescription &&
    bestLabel &&
    bestLabel !== t("Unknown") &&
    !isHistoryView;

  // --- Mount Effect ---
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // --- Fetch AI Description ---
  const fetchDescriptionFromAI = useCallback(async () => {
    if (!isApiKeyValidDesc) {
      console.error(
        "AI Description Fetch Aborted: Invalid or missing API Key."
      );
      if (isMounted.current) setDescriptionError(t("error_api_key_missing"));
      return;
    }
    if (!bestLabel || bestLabel === t("Unknown")) {
      console.log("AI Description Fetch Aborted: No valid disease label.");
      return; // Expected, no error state needed
    }
    if (!isMounted.current) return;

    console.log(`Attempting to fetch AI description for: "${bestLabel}"`);
    setIsFetchingDescription(true);
    setDescriptionError(null);
    setAiDescription("");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_NAME_DESC}:generateContent?key=${GEMINI_API_KEY_DESC}`;
    const prompt = `Provide a concise description for the plant disease "${bestLabel}". Include:\n1. Key visual symptoms (e.g., spots, wilting, color changes).\n2. Common causes or favorable conditions (e.g., humidity, specific pathogens).\n3. General impact on the plant.\nFormat using Markdown (e.g., bold keywords with **). Keep the total length under 150 words. Avoid introductory/concluding pleasantries.`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
      ],
      generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
    };

    try {
      console.log("Sending request to Gemini API...");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const responseBodyText = await response.text();
      console.log("Gemini Raw Response Status:", response.status);
      // Limit log length for potentially long responses
      console.log(
        "Gemini Raw Response Body:",
        responseBodyText.substring(0, 500) +
          (responseBodyText.length > 500 ? "..." : "")
      );

      let data;
      try {
        data = JSON.parse(responseBodyText);
      } catch (parseError) {
        console.error("Failed to parse Gemini JSON response:", parseError);
        throw new Error(
          `API returned non-JSON response (Status: ${response.status})`
        );
      }

      if (!response.ok) {
        const errorMsg =
          data?.error?.message || `API Error (${response.status})`;
        console.error(`Gemini API Error: ${errorMsg}`, data.error);
        throw new Error(errorMsg);
      }

      const blockReason = data?.promptFeedback?.blockReason;
      if (blockReason) {
        console.warn(
          `AI Response Blocked. Reason: ${blockReason}`,
          data.promptFeedback
        );
        throw new Error(t("chat_ai_blocked", { reason: blockReason }));
      }

      const candidate = data?.candidates?.[0];
      const generatedText = candidate?.content?.parts?.[0]?.text;
      const finishReason = candidate?.finishReason;
      console.log("Gemini Finish Reason:", finishReason);

      if (generatedText?.trim()) {
        let finalText = generatedText.trim();
        if (
          finishReason &&
          finishReason !== "STOP" &&
          finishReason !== "NULL"
        ) {
          console.warn(`Gemini description finish reason was: ${finishReason}`);
          if (finishReason === "MAX_TOKENS") finalText += "\n*(...)*";
          else if (finishReason === "SAFETY")
            throw new Error(t("chat_ai_blocked", { reason: "SAFETY" }));
          else if (finishReason === "RECITATION")
            throw new Error("AI response issue: Recitation");
        }
        console.log(
          "Successfully fetched AI Description:",
          finalText.substring(0, 100) + "..."
        );
        if (isMounted.current) setAiDescription(finalText); // <<< SET STATE
      } else {
        console.warn(
          "AI response missing text content without clear block reason:",
          data
        );
        throw new Error(
          t("scan_result_fetch_desc_error") + " (Empty AI Response)"
        );
      }
    } catch (error) {
      console.error("Detailed Error fetching AI description:", error);
      if (isMounted.current) {
        let displayError = t("scan_result_fetch_desc_error");
        if (error.message?.includes("API key not valid"))
          displayError = t("error_api_key_invalid");
        else if (error.message?.includes("quota"))
          displayError = t("error_quota_exceeded");
        else if (error.message?.includes("blocked"))
          displayError = error.message;
        else if (error.message)
          displayError += ` (${error.message.substring(0, 60)}...)`;
        setDescriptionError(displayError);
      }
    } finally {
      if (isMounted.current) setIsFetchingDescription(false);
    }
  }, [bestLabel]); // Dependency: only refetch if label changes

  // --- Effect to Trigger Description Fetch ---
  useEffect(() => {
    console.log(
      `Checking conditions to fetch AI desc: needs=${needsAiDescription}, isHistory=${isHistoryView}, fetching=${isFetchingDescription}, hasDesc=${!!aiDescription}, hasError=${!!descriptionError}`
    );
    // Trigger only if needed, not history, not already fetching, and no result/error yet
    if (
      needsAiDescription &&
      !isFetchingDescription &&
      !aiDescription &&
      !descriptionError
    ) {
      fetchDescriptionFromAI();
    }
  }, [
    needsAiDescription,
    isHistoryView,
    fetchDescriptionFromAI,
    aiDescription,
    isFetchingDescription,
    descriptionError,
  ]);

  // --- Upload Image Function --- (Keep the existing robust function)
  const uploadImageAsync = useCallback(
    async (uri) => {
      if (!uri || !uri.startsWith("file://"))
        throw new Error(t("error_uploading_image") + " (Invalid path)");
      if (!user?.uid) throw new Error(t("login_required"));
      if (isMounted.current) setUploading(true);
      try {
        const response = await fetch(uri);
        if (!response.ok)
          throw new Error(`Fetch blob failed (${response.status})`);
        const blob = await response.blob();
        const filename = `scans/${user.uid}/${Date.now()}-${
          uri.split("/").pop()?.split("?")[0] || "image.jpg"
        }`;
        const storageRef = firebase.storage().ref().child(filename);
        const metadata = { contentType: blob.type || "image/jpeg" };
        const snapshot = await storageRef.put(blob, metadata);
        return await snapshot.ref.getDownloadURL();
      } catch (error) {
        console.error("Upload Err:", error);
        let msg = t("error_uploading_image");
        if (error.code === "storage/unauthorized")
          msg = t("error_permission_denied") + " Check rules.";
        else if (error.code === "storage/canceled") msg = "Upload cancelled.";
        else if (error.message?.includes("Network")) msg = t("error_network");
        else if (error.message)
          msg += ` (${error.message.substring(0, 50)}...)`;
        throw new Error(msg);
      } finally {
        if (isMounted.current) setUploading(false);
      }
    },
    [user]
  );

  // --- Save Result Function ---
  const handleSaveResult = useCallback(async () => {
    if (isHistoryView || !user || saving || uploading) return;
    if (isMounted.current) setSaving(true);
    let uploadedImageUrl = imageUri;
    try {
      if (imageUri && imageUri.startsWith("file://")) {
        uploadedImageUrl = await uploadImageAsync(imageUri);
      } else if (!imageUri?.startsWith("http")) {
        uploadedImageUrl = null; // Handle cases where URI might be invalid
      }

      // Save static description if available, otherwise save fetched AI description, else null
      const descriptionToSave = staticDescription || aiDescription || null;

      console.log(
        "Saving scan result with description:",
        descriptionToSave ? `"${descriptionToSave.substring(0, 50)}..."` : null
      );

      const scanData = {
        userId: user.uid,
        imageUri: uploadedImageUrl,
        bestLabel,
        bestConfidence,
        top5: top5 || [],
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        description: descriptionToSave, // <-- Save the determined description
      };
      await firebase.firestore().collection("recent_activity").add(scanData);
      Alert.alert(t("success"), t("scan_result_save_success"));
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate("Main", { screen: "Home" });
    } catch (error) {
      console.error("Save Error:", error);
      let msg = error.message || t("error_saving_data");
      if (typeof msg !== "string") msg = t("error_saving_data");
      else if (msg.includes("permission-denied"))
        msg = t("error_permission_denied") + " Save failed.";
      Alert.alert(t("error"), msg);
    } finally {
      if (isMounted.current) setSaving(false);
    }
  }, [
    isHistoryView,
    user,
    saving,
    uploading,
    imageUri,
    bestLabel,
    bestConfidence,
    top5,
    staticDescription,
    aiDescription, // <-- Added aiDescription dependency
    navigation,
    uploadImageAsync,
  ]);

  // --- Timestamp Formatting ---
  const displayTimestamp = routeTimestamp?.toDate
    ? routeTimestamp.toDate().toLocaleString()
    : routeTimestamp
    ? new Date(routeTimestamp).toLocaleString()
    : null;

  // --- Share Functionality ---
  const handleShare = useCallback(async () => {
    try {
      // Prioritize AI desc, then static, then a generic "no description" message
      const descriptionToShare =
        aiDescription ||
        staticDescription ||
        t("scan_result_no_description_available");
      const messageParts = [
        `*${t("appName")} - ${t("scan_results_title")}*`,
        `*${t("chat_disease")}* ${bestLabel} (${(bestConfidence * 100).toFixed(
          1
        )}%)`,
        `*${t("scan_result_description")}*`,
        descriptionToShare,
        `\n_${t("scan_result_scanned_on")}: ${displayTimestamp || "N/A"}_`,
      ];
      if (imageUri && imageUri.startsWith("http"))
        messageParts.push(`\nImage: ${imageUri}`);
      await Share.share({ message: messageParts.join("\n") });
    } catch (error) {
      Alert.alert(t("error"), "Could not share result.");
    }
  }, [
    bestLabel,
    bestConfidence,
    staticDescription,
    aiDescription,
    displayTimestamp,
    imageUri,
    t, // Added t to dependencies
  ]);

  // Button disabled state
  const saveButtonDisabled = saving || uploading;

  // --- Render ---
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Buttons */}
      <View style={styles.headerButtons}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleShare}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="share-social-outline" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Image Display */}
      <View style={styles.imageOuterContainer}>
        {imageUri && !imageLoadError ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.fullImage}
            resizeMode="cover"
            onError={(e) => {
              console.warn("Img load err:", e.nativeEvent.error);
              setImageLoadError(true);
            }}
          />
        ) : (
          <View
            style={[styles.imagePlaceholder, { backgroundColor: theme.card }]}
          >
            <Ionicons
              name="leaf-outline"
              size={80}
              color={theme.placeholderIcon}
            />
            <Text
              style={[styles.placeholderText, { color: theme.textSecondary }]}
            >
              {imageLoadError ? "Image Error" : "No Image"}
            </Text>
          </View>
        )}
      </View>

      {/* Details Section */}
      <View
        style={[styles.detailsContainer, { backgroundColor: theme.background }]}
      >
        {/* Top Result */}
        <Text
          style={[styles.diseaseTitle, { color: theme.primary }]}
          selectable={true}
        >
          {bestLabel}
        </Text>
        <Text style={[styles.confidenceText, { color: theme.textSecondary }]}>
          {t("scan_result_confidence")}: {(bestConfidence * 100).toFixed(1)}%
        </Text>

        {/* Top 5 Predictions */}
        {Array.isArray(top5) && top5.length > 1 && (
          <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t("scan_result_other_possibilities")}
            </Text>
            {top5.slice(1, 5).map((p, i) => (
              <View
                key={`pred-${i}`}
                style={[
                  styles.predictionRow,
                  { borderBottomColor: theme.border },
                  i === Math.min(top5.length, 4) - 2
                    ? styles.predictionRowLast
                    : null,
                ]}
              >
                <Text
                  style={[styles.predictionLabel, { color: theme.text }]}
                  selectable={true}
                >
                  {p.label}
                </Text>
                <Text
                  style={[
                    styles.predictionConfidence,
                    { color: theme.textSecondary },
                  ]}
                >
                  {(p.confidence * 100).toFixed(1)}%
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Description Section - Updated Logic */}
        <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t("scan_result_description")}
          </Text>
          {isFetchingDescription ? (
            <View style={styles.descriptionLoadingContainer}>
              <ActivityIndicator color={theme.primary} />
              <Text
                style={[
                  styles.descriptionStatusText,
                  { color: theme.textSecondary },
                ]}
              >
                {t("scan_result_fetching_description")}
              </Text>
            </View>
          ) : descriptionError ? (
            <View style={styles.descriptionLoadingContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color={theme.error}
                style={{ marginRight: 8 }}
              />
              <Text
                style={[styles.descriptionStatusText, { color: theme.error }]}
                selectable={true}
              >
                {descriptionError}
              </Text>
            </View>
          ) : aiDescription ? ( // Show AI description if fetched
            <Markdown style={markdownStylesDesc(theme)}>
              {aiDescription}
            </Markdown>
          ) : staticDescription ? ( // Show static description if AI not needed/fetched but static exists
            <Text
              style={[styles.descriptionText, { color: theme.textSecondary }]}
              selectable={true}
            >
              {staticDescription}
            </Text>
          ) : (
            // Fallback if no description is available at all
            <Text
              style={[
                styles.descriptionText,
                { color: theme.textSecondary, fontStyle: "italic" },
              ]}
              selectable={true}
            >
              {t("scan_result_no_description_available")}
            </Text>
          )}
        </View>

        {/* General Recommendations */}
        <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t("scan_result_recommendations")}
          </Text>
          <Text
            style={[styles.cardText, { color: theme.textSecondary }]}
            selectable={true}
          >
            {t("scan_result_recommendations_text")}
          </Text>
        </View>

        {/* Timestamp */}
        {displayTimestamp && (
          <Text style={[styles.timestampText, { color: theme.textSecondary }]}>
            {t("scan_result_scanned_on")} {displayTimestamp}
          </Text>
        )}

        {/* Save Button */}
        {!isHistoryView && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: theme.primary },
                saveButtonDisabled && [
                  styles.buttonDisabled,
                  { backgroundColor: theme.primaryDisabled },
                ],
              ]}
              onPress={handleSaveResult}
              disabled={saveButtonDisabled}
              activeOpacity={0.7}
            >
              {saving || uploading ? (
                <>
                  <ActivityIndicator
                    color={theme.buttonTextDark}
                    size="small"
                    style={styles.buttonActivityIndicator}
                  />
                  <Text
                    style={[styles.buttonText, { color: theme.buttonTextDark }]}
                  >
                    {uploading
                      ? t("scan_result_uploading")
                      : t("scan_result_saving")}
                  </Text>
                </>
              ) : (
                <Text
                  style={[styles.buttonText, { color: theme.buttonTextDark }]}
                >
                  {t("scan_result_save_button")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

// --- Styles --- (Keep refined styles from previous iteration)
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContentContainer: { paddingBottom: 50, flexGrow: 1 },
  headerButtons: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    left: 0,
    right: 0,
    paddingHorizontal: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 10,
  },
  iconButton: {
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 8,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  imageOuterContainer: {
    width: "100%",
    height: screenWidth * 0.9,
    backgroundColor: "#101010",
  }, // Added bg color
  fullImage: { width: "100%", height: "100%" },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: { marginTop: 10, fontSize: 16 },
  detailsContainer: {
    padding: 20,
    paddingTop: 30,
    marginTop: -40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 5,
  }, // Removed explicit background color here
  diseaseTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 5,
    textAlign: "center",
  },
  confidenceText: { fontSize: 16, marginBottom: 30, textAlign: "center" },
  sectionCard: { borderRadius: 16, padding: 18, marginBottom: 20 },
  sectionTitle: { fontSize: 19, fontWeight: "600", marginBottom: 15 },
  predictionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  }, // Use hairlineWidth
  predictionRowLast: { borderBottomWidth: 0 },
  predictionLabel: { fontSize: 16, flex: 1, marginRight: 15 },
  predictionConfidence: { fontSize: 15, fontWeight: "600" },
  descriptionText: { fontSize: 15, lineHeight: 23 },
  descriptionLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: 10,
    minHeight: 50,
  }, // Align left, add minHeight
  descriptionStatusText: { fontSize: 15, marginLeft: 10, flexShrink: 1 }, // Allow text to wrap
  cardText: { fontSize: 15, lineHeight: 22 },
  timestampText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 25,
  },
  buttonContainer: { paddingHorizontal: 10, marginTop: 10 },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    minHeight: 52,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.7, elevation: 0, shadowOpacity: 0 },
  buttonActivityIndicator: { marginRight: 10 },
  buttonText: { fontWeight: "bold", fontSize: 16 },
});

// --- Markdown Styles for AI Description --- (Keep from previous iteration)
const markdownStylesDesc = (theme) =>
  StyleSheet.create({
    body: { color: theme.textSecondary, fontSize: 15, lineHeight: 23 },
    strong: { fontWeight: "bold", color: theme.text },
    bullet_list_icon: {
      marginRight: 8,
      color: theme.primary,
      marginTop: 8,
      height: 6,
      width: 6,
      borderRadius: 3,
      backgroundColor: theme.primary,
    },
    list_item: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginVertical: 4,
    },
    // Add other markdown elements as needed (e.g., em, link)
  });

export default ScanResultsScreen;
