import React, { useState, useEffect } from "react"; // Added useEffect for potential cleanup later
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform, // Import Platform
} from "react-native";
import firebase from "firebase/compat/app";
import "firebase/compat/storage";
import "firebase/compat/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { diseaseDescriptions } from "../constants/plant_name_desc";
import Markdown from "react-native-markdown-display";

// --- Gemini LLM Configuration ---
// --- 🚨 EXTREMELY IMPORTANT SECURITY WARNING 🚨 ---
// DO NOT EVER COMMIT OR SHIP YOUR APP WITH THE API KEY HARDCODED LIKE THIS.
// This key WILL BE STOLEN if found in your app's code.
// For production, use a backend proxy server (e.g., Cloud Functions) to protect your key.
const GEMINI_API_KEY = "AIzaSyDEhRYRo_ajQdvHlEdm44vu_MSPSX5T5Vw"; // <-- PASTE YOUR KEY FOR TESTING ONLY
const GEMINI_MODEL_NAME = "gemini-2.0-flash"; // Using latest flash model
// --- End Gemini LLM Configuration ---

// Simple check if the key is still the placeholder
const isApiKeyPlaceholder = GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE";

const ScanResultsScreen = ({ route, navigation }) => {
  const {
    top5 = [],
    imageUri = null,
    bestLabel = "Unknown",
    bestConfidence = 0,
    timestamp: routeTimestamp = null,
    scanId = null,
  } = route.params || {};

  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // useRef to track mounted state if needed for complex cleanup (optional for now)
  // const isMounted = useRef(true);
  // useEffect(() => {
  //   isMounted.current = true;
  //   return () => { isMounted.current = false; }; // Cleanup on unmount
  // }, []);

  const isHistoryView = !!routeTimestamp || !!scanId;

  const description =
    diseaseDescriptions[bestLabel] ||
    `No detailed description available for ${bestLabel}. General plant care is advised.`;

  // --- Upload Image Function ---
  const uploadImageAsync = async (uri) => {
    // Basic check for non-file URIs
    if (!uri || !uri.startsWith("file://")) {
      console.warn("uploadImageAsync: Invalid or non-local file URI:", uri);
      // Decide handling: throw error or return null/empty string?
      // Let's throw to make the save function aware.
      throw new Error("Invalid image path provided for upload.");
    }

    setUploading(true);
    let downloadURL = null; // Initialize downloadURL

    try {
      // Fetch handles file URIs on React Native (iOS needs info.plist config for http)
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch image blob (status: ${response.status})`
        );
      }
      const blob = await response.blob();

      // More robust filename: handle potential special chars? For now, basic is okay.
      const filename = `scans/${user?.uid || "unknown_user"}/${Date.now()}-${uri
        .split("/")
        .pop()}`; // Use split().pop() for filename extraction
      console.log("Uploading image to:", filename);

      const storageRef = firebase.storage().ref().child(filename);

      // Add metadata for content type (good practice)
      const metadata = { contentType: blob.type || "image/jpeg" }; // Use blob type or default

      const snapshot = await storageRef.put(blob, metadata);
      downloadURL = await snapshot.ref.getDownloadURL();
      console.log("Upload successful! Download URL:", downloadURL);
      return downloadURL; // Return the URL on success
    } catch (error) {
      console.error("Error uploading image:", error);
      // Provide a more user-friendly message if possible
      const message =
        error.code === "storage/unauthorized"
          ? "Permission denied. Check storage rules."
          : error.message || "An unknown error occurred during upload.";
      Alert.alert("Upload Error", `Failed to upload image: ${message}`);
      throw error; // Re-throw error to be caught by handleSaveResult
    } finally {
      // Only set uploading to false if the component is still mounted (optional safety)
      // if (isMounted.current) {
      setUploading(false);
      // }
    }
  };

  // --- Save Result Function (with AI response) ---
  const handleSaveResult = async () => {
    if (isHistoryView) {
      // This should ideally be prevented by hiding the button, but double-check
      console.warn("Save action triggered on a history view. Aborting.");
      return;
    }
    if (!user || !user.uid) {
      Alert.alert(
        "Login Required",
        "You must be logged in to save scan results.",
        [{ text: "OK", onPress: () => navigation.navigate("Login") }] // Optionally navigate
      );
      return;
    }

    // **CRITICAL CHECK:** Prevent saving if AI is currently loading
    if (isAiLoading) {
      Alert.alert(
        "Please Wait",
        "AI Assistant is still generating advice. Please wait until it finishes before saving."
      );
      return;
    }

    setSaving(true);
    let uploadedImageUrl = imageUri; // Use existing URL if not uploading a local file

    try {
      // Upload image ONLY if a *local file* imageUri exists
      if (imageUri && imageUri.startsWith("file://")) {
        // uploadImageAsync will handle setting/unsetting 'uploading' state
        uploadedImageUrl = await uploadImageAsync(imageUri);
      } else if (
        imageUri &&
        (imageUri.startsWith("http://") || imageUri.startsWith("https://"))
      ) {
        console.log("Using existing remote image URI for saving:", imageUri);
        // Keep uploadedImageUrl = imageUri;
      } else {
        console.log("No valid image URI provided for saving.");
        uploadedImageUrl = ""; // Ensure it's an empty string or null if no image
      }

      // Prepare data for Firestore, including the AI response
      const scanData = {
        userId: user.uid,
        imageUri: uploadedImageUrl, // Use the final URL (uploaded or existing remote)
        bestLabel,
        bestConfidence,
        top5: top5 || [], // Ensure top5 is an array
        timestamp: firebase.firestore.FieldValue.serverTimestamp(), // Server time for consistency
        description: description, // Static description from constants
        aiGeneratedAdvice: aiResponse || null, // Save AI response, use null if empty
      };

      console.log("Saving scan data to Firestore:", scanData);
      const docRef = await firebase
        .firestore()
        .collection("recent_activity")
        .add(scanData);
      console.log("Result saved successfully with ID:", docRef.id);

      Alert.alert(
        "Success",
        "Scan result and AI advice (if generated) have been saved!"
      );

      // Navigate back or home after successful save
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        // Fallback navigation if cannot go back
        navigation.navigate("Main", { screen: "Home" });
      }
    } catch (error) {
      console.error("Error saving scan result:", error);
      // More specific error messages if possible
      let saveErrorMessage = error.message || "An unknown error occurred.";
      if (error.code) {
        // Check for Firestore error codes
        saveErrorMessage = `Database error (${error.code}). Please try again.`;
      } else if (error.message.includes("upload")) {
        // Check if error came from upload
        saveErrorMessage = `Image upload failed: ${error.message}`;
      }
      Alert.alert("Save Error", `Failed to save scan: ${saveErrorMessage}`);
    } finally {
      // Only set saving to false if the component is still mounted (optional safety)
      // if (isMounted.current) {
      setSaving(false);
      // }
    }
  };

  // --- Ask Gemini Function ---
  const handleAskGemini = async () => {
    // Prevent call if API key is the placeholder
    if (isApiKeyPlaceholder) {
      Alert.alert(
        "API Key Missing",
        "Developer: Please configure the Gemini API Key in the code before using this feature."
      );
      return;
    }
    // Prevent call if no valid disease detected
    if (!bestLabel || bestLabel === "Unknown") {
      Alert.alert(
        "Cannot Ask AI",
        "No specific disease was detected to ask about."
      );
      return;
    }
    // Prevent multiple simultaneous calls
    if (isAiLoading) {
      console.log("AI request already in progress.");
      return;
    }

    setIsAiLoading(true);
    setAiResponse(""); // Clear previous response immediately

    // Construct API URL (ensure model name is correct)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

    // Refined prompt for clarity and desired format
    const prompt = `You are an expert plant pathologist assistant. A plant has been identified with symptoms closely matching '${bestLabel}'.
Provide the following information for a home gardener, using Markdown formatting:
1.  **Brief Confirmation**: Briefly confirm the common signs of '${bestLabel}'.
2.  **Care Instructions**: Specific steps for managing an infected plant (watering, light, fertilization adjustments).
3.  **Prevention**: Key measures to prevent '${bestLabel}' in the future.
4.  **Organic Treatments**: Suggest 3 distinct organic treatment options, explaining how to apply them.

Keep the language clear and actionable.`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      safetySettings: [
        // Example: Adjust safety settings if needed
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
      generationConfig: {
        // Example: Control output parameters
        // temperature: 0.7, // Controls randomness (0=deterministic, 1=max creative)
        maxOutputTokens: 1024, // Limit response length
        // topP: 0.9, // Nucleus sampling
        // topK: 40, // Top-k sampling
      },
    };

    console.log("Sending request to Gemini for:", bestLabel);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        // Consider adding a timeout (requires AbortController, more complex)
      });

      // Use response.json() directly, but handle potential non-JSON errors first
      if (!response.ok) {
        let errorBodyText = await response.text(); // Get error text
        let errorMessage = `API Error (${response.status})`;
        try {
          const errorJson = JSON.parse(errorBodyText);
          errorMessage =
            errorJson.error?.message || errorBodyText || errorMessage;
        } catch (e) {
          errorMessage = errorBodyText || errorMessage; // Use raw text if JSON parse fails
        }
        console.error(`Gemini API Error (${response.status}): ${errorMessage}`);
        throw new Error(errorMessage); // Throw structured error
      }

      const data = await response.json();
      // console.log("Raw Gemini Response Data:", JSON.stringify(data, null, 2)); // DEBUG

      // Safer data extraction with optional chaining and checks
      let generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const blockReason = data?.promptFeedback?.blockReason;
      const finishReason = data?.candidates?.[0]?.finishReason;

      if (generatedText) {
        if (finishReason && finishReason !== "STOP") {
          console.warn(`Gemini response finish reason: ${finishReason}`);
          // Append a note if response was cut short, etc.
          if (finishReason === "MAX_TOKENS") {
            generatedText +=
              "\n\n*(Note: Response may have been shortened due to length limits.)*";
          } else if (finishReason !== "STOP") {
            generatedText += `\n\n*(Note: Response generation finished unexpectedly: ${finishReason})*`;
          }
        }
        setAiResponse(generatedText.trim());
      } else if (blockReason) {
        console.warn(`Gemini Response Blocked: ${blockReason}`);
        const blockMessage = `The AI's response was blocked due to safety settings (${blockReason}). Try rephrasing or contact support if this seems incorrect.`;
        setAiResponse(blockMessage); // Show block reason in UI
        Alert.alert("Response Blocked", blockMessage);
      } else {
        console.warn("Unexpected Gemini response structure:", data);
        setAiResponse(
          "Could not extract a valid response from the AI. Please try again."
        );
      }
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      // More user-friendly network or general error message
      const displayError = error.message?.includes("API Error")
        ? error.message // Show specific API error from Gemini
        : "Failed to connect to the AI Assistant. Please check your internet connection and try again.";
      Alert.alert("AI Error", displayError);
      setAiResponse(`*Error fetching advice: ${displayError}*`); // Show error in markdown format
    } finally {
      // Only set loading to false if the component is still mounted (optional safety)
      // if (isMounted.current) {
      setIsAiLoading(false);
      // }
    }
  };

  // --- Timestamp Formatting ---
  const displayTimestamp = routeTimestamp?.toDate
    ? routeTimestamp.toDate().toLocaleString()
    : routeTimestamp
    ? new Date(routeTimestamp).toLocaleString() // Handle if timestamp is not a Firestore Timestamp object
    : "N/A"; // Default if no timestamp

  // Determine overall button disabled state
  const saveButtonDisabled = saving || uploading || isAiLoading;
  const aiButtonDisabled =
    isAiLoading || !bestLabel || bestLabel === "Unknown" || isApiKeyPlaceholder;

  // --- Render ---
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled" // Dismiss keyboard on tap outside inputs if any
    >
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increase tap area
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
          } // Image load error
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

        {/* --- Ask AI Button --- */}
        {isApiKeyPlaceholder && ( // Show developer warning if key is missing
          <Text style={styles.warningText}>
            Developer: AI features disabled. Configure API Key.
          </Text>
        )}
        <TouchableOpacity
          style={[styles.aiButton, aiButtonDisabled && styles.buttonDisabled]}
          onPress={handleAskGemini}
          disabled={aiButtonDisabled}
        >
          {isAiLoading ? (
            <>
              <ActivityIndicator
                color="#FFFFFF"
                size="small"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.aiButtonText}>Getting AI Advice...</Text>
            </>
          ) : (
            <Text style={styles.aiButtonText}>
              {aiResponse ? "Ask AI Again" : "Ask AI for Care Tips"}
            </Text> // Change text based on whether response exists
          )}
        </TouchableOpacity>

        {/* --- AI Response Area --- */}
        {/* Show loader inline if loading, even if previous response exists */}
        {isAiLoading && (
          <View style={styles.aiLoadingInline}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.aiLoadingText}>
              AI Assistant is thinking...
            </Text>
          </View>
        )}

        {/* Only show response container if NOT loading AND response exists */}
        {!isAiLoading && aiResponse ? (
          <View style={styles.aiResponseContainer}>
            <Text style={styles.sectionTitle}>AI Assistant Advice</Text>
            <Markdown style={markdownStyles}>{aiResponse}</Markdown>
          </View>
        ) : null}
        {/* --- End AI Response Area --- */}

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
        {displayTimestamp !== "N/A" && ( // Only show if valid timestamp exists
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
                saveButtonDisabled && styles.buttonDisabled, // Use combined disabled state
              ]}
              onPress={handleSaveResult}
              disabled={saveButtonDisabled} // Use combined disabled state
            >
              {saving ? (
                <>
                  <ActivityIndicator
                    color="#000000"
                    size="small"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.buttonText}>Saving...</Text>
                </>
              ) : uploading ? (
                <>
                  <ActivityIndicator
                    color="#000000"
                    size="small"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.buttonText}>Uploading Image...</Text>
                </>
              ) : isAiLoading ? ( // Indicate *why* it's disabled if AI is loading
                <>
                  <Ionicons
                    name="hourglass-outline"
                    size={16}
                    color="#333"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.buttonTextDisabled}>Wait for AI...</Text>
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

// --- Markdown Styles --- (Keep as is or customize further)
const markdownStyles = StyleSheet.create({
  // Use StyleSheet.create for potential optimizations
  body: { color: "#E5E5EA", fontSize: 15, lineHeight: 22 },
  heading1: {
    color: "#DFFF00",
    fontSize: 20,
    marginTop: 10,
    marginBottom: 5,
    fontWeight: "bold",
  },
  heading2: {
    color: "#FFFFFF",
    fontSize: 18,
    marginTop: 8,
    marginBottom: 4,
    fontWeight: "bold",
  },
  heading3: {
    color: "#E5E5EA",
    fontSize: 16,
    marginTop: 6,
    marginBottom: 3,
    fontWeight: "bold",
  }, // Added heading 3
  strong: { fontWeight: "bold", color: "#FFFFFF" },
  em: { fontStyle: "italic", color: "#AEAEB2" }, // Style for italics
  bullet_list: { marginBottom: 10, marginTop: 5 },
  ordered_list: { marginBottom: 10, marginTop: 5 },
  list_item: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 5,
  },
  // Custom bullet point styling
  bullet_list_icon: {
    color: "#DFFF00",
    fontSize: Platform.OS === "ios" ? 18 : 16,
    marginRight: 8,
    lineHeight: 22,
  },
  // Custom number styling for ordered lists
  ordered_list_icon: {
    color: "#DFFF00",
    fontSize: 15,
    marginRight: 8,
    lineHeight: 22,
    fontWeight: "bold",
  },
  link: { color: "#64B5F6", textDecorationLine: "underline" },
  blockquote: {
    backgroundColor: "#2C2C2E",
    padding: 10,
    marginVertical: 5,
    borderRadius: 4,
    borderLeftColor: "#4CAF50",
    borderLeftWidth: 3,
  }, // Style blockquotes
  code_inline: {
    backgroundColor: "#2C2C2E",
    color: "#FFD600",
    paddingHorizontal: 4,
    borderRadius: 3,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  }, // Style inline code
  fence: {
    backgroundColor: "#2C2C2E",
    color: "#E5E5EA",
    padding: 10,
    marginVertical: 5,
    borderRadius: 4,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  }, // Style code blocks
  table: { borderWidth: 1, borderColor: "#555", marginBottom: 10 }, // Basic table styles
  th: {
    backgroundColor: "#333",
    padding: 5,
    fontWeight: "bold",
    color: "#FFF",
  },
  td: { borderWidth: 1, borderColor: "#555", padding: 5 },
});

// --- Component Styles ---
const styles = StyleSheet.create({
  // ... (Keep all your existing component styles: container, backButton, fullImage, etc.)
  container: { flex: 1, backgroundColor: "#000000" },
  contentContainer: { paddingBottom: 50 },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
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
    marginTop: -30,
    backgroundColor: "#000000",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  diseaseTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#DFFF00",
    marginBottom: 5,
    textAlign: "center",
  },
  confidenceText: {
    fontSize: 16,
    color: "#E5E5EA",
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
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#3A3A3C",
  },
  predictionRowLast: { borderBottomWidth: 0 },
  predictionLabel: { color: "#FFFFFF", fontSize: 15, flex: 1, marginRight: 10 },
  predictionConfidence: { color: "#AEAEB2", fontSize: 15, fontWeight: "600" },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  descriptionContainer: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  descriptionText: { color: "#E5E5EA", fontSize: 15, lineHeight: 22 },
  aiButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    minHeight: 50,
    marginBottom: 5,
    marginHorizontal: 10,
  }, // Reduced margin bottom slightly
  aiButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 5,
  },
  aiLoadingInline: {
    // Style for inline loader when AI is working
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginBottom: 10,
  },
  aiLoadingText: {
    color: "#AEAEB2",
    marginLeft: 10,
    fontSize: 14,
  },
  aiResponseContainer: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 20,
    marginTop: 5,
  }, // Consistent padding
  // aiResponseText removed as Markdown handles it
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
    marginBottom: 8,
  },
  cardText: { fontSize: 15, color: "#E5E5EA", lineHeight: 21 },
  timestampText: {
    color: "#8E8E93",
    fontSize: 12,
    textAlign: "center",
    marginTop: 15,
    marginBottom: 20,
  },
  buttonContainer: { marginTop: 10, paddingHorizontal: 10 },
  button: {
    backgroundColor: "#DFFF00",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    minHeight: 50,
  },
  buttonDisabled: { backgroundColor: "#555", opacity: 0.7 },
  buttonText: {
    color: "#000000",
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 5,
  },
  buttonTextDisabled: {
    // Specific style for disabled save button text when AI loading
    color: "#333",
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 5,
  },
  warningText: {
    // Style for developer warning
    color: "orange",
    textAlign: "center",
    fontSize: 12,
    marginBottom: 10,
    marginHorizontal: 10,
  },
});

export default ScanResultsScreen;
