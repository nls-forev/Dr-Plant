// src/screens/ChatScreen.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Keyboard,
  SafeAreaView,
  Image, // Import Image for preview
  ActionSheetIOS, // For iOS attach options
} from "react-native";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { useAuth } from "../context/AuthContext"; // Adjust path if needed
import { db, firebase } from "../firebase/firebaseInit"; // Adjust path if needed
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
  where,
  getDocs,
  Timestamp, // Keep Timestamp for type checking if needed
} from "firebase/firestore";
import Markdown from "react-native-markdown-display";
import {
  Send,
  XCircle,
  CheckCircle,
  AlertCircle,
  Paperclip,
  Image as ImageIcon, // Use alias for Image icon from lucide
  X as XIcon, // Use alias for X icon from lucide
} from "lucide-react-native";
import {
  useRoute,
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";
import { t } from "../localization/strings"; // Assuming strings.js is set up correctly
import SelectScanDialog from "../components/SelectScanDialog"; // Adjust path if needed
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";

// --- Configuration & Constants ---
// 🚨 IMPORTANT: Replace with your actual API key, preferably from a secure configuration (e.g., environment variables)
const GEMINI_API_KEY = "AIzaSyDEhRYRo_ajQdvHlEdm44vu_MSPSX5T5Vw";
const GEMINI_MODEL_NAME = "gemini-1.5-flash"; // Supports text and vision
const USER_ROLE = "user";
const MODEL_ROLE = "model";
const MAX_CHAT_TITLE_LENGTH = 35;
const CHATS_COLLECTION = "ai_chats";
const MESSAGES_SUBCOLLECTION = "messages";
const isApiKeyPlaceholder =
  !GEMINI_API_KEY ||
  GEMINI_API_KEY.includes("YOUR_API_KEY") || // Check for placeholder text
  GEMINI_API_KEY.length < 30; // Basic length check

// --- Gemini Safety Settings ---
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

const ChatScreen = () => {
  // --- Hooks ---
  const { user } = useAuth();
  const route = useRoute();
  const navigation = useNavigation();
  const flatListRef = useRef(null);
  const editInputRef = useRef(null);
  const isMounted = useRef(true);
  const scanDataProcessed = useRef(false); // For handling initial loadScanData param

  // --- Route Params ---
  const {
    chatId: initialChatId,
    initialTitle,
    loadScanData,
  } = route.params || {};

  // --- Theme ---
  // Using a fixed dark theme as defined before
  const theme = {
    background: "#0A0A0A",
    headerBackground: "#101010",
    text: "#EFEFEF",
    textSecondary: "#AEAEB2",
    primary: "#BFFF00",
    primaryDisabled: "#5A6A00",
    inputBackground: "#1C1C1E",
    inputPlaceholder: "#8E8E93",
    userBubble: "#BFFF00",
    userBubbleText: "#111111",
    aiBubble: "#2C2C2E",
    aiBubbleText: "#E5E5EA",
    error: "#FF9A9A", // Adjusted for better visibility on dark
    errorBackground: "rgba(255, 90, 90, 0.1)", // Adjusted for better visibility
    deleteButton: "#FF6B6B",
    deleteButtonDisabled: "#888",
    confirmButton: "#BFFF00",
    confirmButtonDisabled: "#5A6A00",
    editedIndicator: "#999",
    optimisticIndicator: "#AAA",
    iconDefault: "#AEAEB2",
    iconDisabled: "#555",
    border: "#2C2C2E",
  };

  // --- State ---
  const [genAI, setGenAI] = useState(null);
  const [chatModel, setChatModel] = useState(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(!!initialChatId);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null); // Holds error messages for display
  const [currentChatId, setCurrentChatId] = useState(initialChatId);
  const [currentTitle, setCurrentTitle] = useState(
    initialChatId ? initialTitle || t("chat_new_chat") : t("chat_new_chat")
  );
  const [messages, setMessages] = useState([]); // Array of chat messages
  const [inputText, setInputText] = useState(""); // Current text in the input field
  const [editingMessageId, setEditingMessageId] = useState(null); // ID of message being edited
  const [editText, setEditText] = useState(""); // Text content while editing
  const [isSelectScanDialogVisible, setIsSelectScanDialogVisible] =
    useState(false); // Controls the saved scan selection dialog
  const [pendingScanData, setPendingScanData] = useState(null); // Holds { text, imageUri } for context from saved scans
  const [attachedImageUri, setAttachedImageUri] = useState(null); // URI for newly attached image from gallery/camera

  // --- Effects ---
  // Track component mount state
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Initialize Gemini AI Model
  useEffect(() => {
    if (isApiKeyPlaceholder) {
      if (isMounted.current) setError("Dev: Invalid API Key"); // Provide dev-specific error
      return;
    }
    try {
      const ai = new GoogleGenerativeAI(GEMINI_API_KEY);
      // Get the multimodal model with safety settings
      const model = ai.getGenerativeModel({
        model: GEMINI_MODEL_NAME,
        safetySettings,
      });
      if (isMounted.current) {
        console.log("Gemini AI Model Initialized Successfully.");
        setGenAI(ai);
        setChatModel(model);
      }
    } catch (err) {
      if (isMounted.current) setError(t("error_general") + " (AI Init)");
      console.error("AI Init Error:", err);
    }
  }, []); // Run only once on mount

  // Update navigation header title when chat title changes
  useEffect(() => {
    navigation.setOptions({
      title: currentTitle,
      headerStyle: { backgroundColor: theme.headerBackground },
      headerTintColor: theme.text,
      headerTitleStyle: { fontWeight: "600" },
    });
  }, [navigation, currentTitle, theme]);

  // Handle initial data passed via route params to start a new chat
  useEffect(() => {
    if (
      loadScanData &&
      !currentChatId && // Only if no chat is currently active
      isMounted.current &&
      !scanDataProcessed.current // Ensure it only runs once per load
    ) {
      console.log(
        "Processing INITIAL loadScanData param to start NEW chat context..."
      );
      const formattedMessage = formatScanDataForMessage(loadScanData);
      if (formattedMessage) {
        scanDataProcessed.current = true; // Mark as processed
        // Send the formatted scan data as the first message
        sendMessage(formattedMessage);
        // Clear the param from navigation state
        navigation.setParams({ loadScanData: undefined });
      } else {
        console.warn("Failed to format initial load scan data for message.");
        navigation.setParams({ loadScanData: undefined }); // Still clear param on failure
      }
    }
  }, [
    loadScanData,
    currentChatId,
    navigation,
    formatScanDataForMessage,
    sendMessage,
  ]); // Re-run if these params/functions change

  // Reset the initial data processed flag when the screen gains focus
  useFocusEffect(
    useCallback(() => {
      scanDataProcessed.current = false;
      // console.log("ChatScreen focused, reset scanDataProcessed flag.");
    }, [])
  );

  // Fetch and subscribe to chat messages from Firestore
  useFocusEffect(
    useCallback(() => {
      // Skip if no chat ID or user is available
      if (!currentChatId || !user?.uid || !db) {
        if (!currentChatId && isMounted.current) setIsLoadingMessages(false); // Stop loading if starting a new chat
        return;
      }

      // Set loading state and clear previous errors
      if (isMounted.current) {
        setIsLoadingMessages(true);
        setError(null);
      }

      console.log(`Subscribing to messages for chat: ${currentChatId}`);
      const messagesCollectionRef = getMessagesCollectionRef(currentChatId);
      if (!messagesCollectionRef) {
        if (isMounted.current) {
          setError(t("error_loading_data") + " (Ref)");
          setIsLoadingMessages(false);
        }
        return; // Stop if collection ref is invalid
      }

      // Create Firestore query
      const messagesQuery = query(
        messagesCollectionRef,
        where("deleted", "==", false), // Filter out soft-deleted messages
        orderBy("timestamp", "asc") // Order by time
      );

      // Subscribe to real-time updates
      const unsubscribe = onSnapshot(
        messagesQuery,
        (snapshot) => {
          // Process snapshot data
          const fetched = snapshot.docs
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
              timestamp: doc.data().timestamp, // Keep Firestore timestamp object
              editedAt: doc.data().editedAt,
            }))
            // Basic validation: Ensure role and parts array exist and are valid
            .filter(
              (m) => m.role && Array.isArray(m.parts) && m.parts.length > 0
            );

          // Update state if component is still mounted
          if (isMounted.current) {
            setMessages(fetched);
            setIsLoadingMessages(false); // Stop loading indicator
            // Scroll to bottom unless user is editing a message
            if (!editingMessageId) scrollToBottom(false);
          }
        },
        (err) => {
          // Handle subscription errors
          if (isMounted.current) {
            setError(t("chat_messages_load_error"));
            setIsLoadingMessages(false);
          }
          console.error("Message fetch snapshot error:", err);
        }
      );

      // Cleanup function: Unsubscribe when the screen loses focus or unmounts
      return () => {
        console.log("Unsubscribing from messages for chat:", currentChatId);
        unsubscribe();
      };
    }, [
      currentChatId,
      user?.uid, // Use specific user ID for dependency stability
      getMessagesCollectionRef,
      editingMessageId,
      t,
    ])
  );

  // --- Format Scan Data for Message ---
  const formatScanDataForMessage = useCallback(
    (scanData) => {
      if (!scanData) return "";
      const { scanId, bestLabel, bestConfidence, description, top5 } = scanData;
      const confidencePercent = ((bestConfidence || 0) * 100).toFixed(1);
      const top5Text =
        top5 && top5.length > 1
          ? "\n" +
            t("scan_result_other_possibilities") +
            ":\n" +
            top5
              .slice(1, 5) // Show top 2-5 possibilities
              .map((p) => `- ${p.label} (${(p.confidence * 100).toFixed(1)}%)`)
              .join("\n")
          : "";
      const descText =
        description && typeof description === "string"
          ? `\n\n*${t("scan_result_description")}*\n${description}`
          : `\n\n*${t("scan_result_description")}*\n${t(
              "scan_result_no_description",
              { label: bestLabel || "?" }
            )}`; // Fallback if description is missing
      const details = `*${t("chat_disease")}* ${
        bestLabel || "N/A"
      } (${confidencePercent}%)${top5Text}${descText}\n\n(Scan ID: ${
        scanId || "?"
      })`;
      // Return the introductory text with formatted details
      return t("chat_scan_context_message", { details });
    },
    [t] // Depend on translation function
  );

  // --- Get Messages Collection Ref ---
  const getMessagesCollectionRef = useCallback(
    (chatId) => {
      if (!user?.uid || !db || !chatId) return null;
      return collection(db, CHATS_COLLECTION, chatId, MESSAGES_SUBCOLLECTION);
    },
    [user?.uid] // Depend only on stable user ID
  );

  // --- Helper Functions ---
  // Scroll FlatList to the bottom
  const scrollToBottom = useCallback(
    (animated = true) => {
      if (messages.length > 0 && flatListRef.current) {
        setTimeout(() => {
          // Use timeout to ensure layout is complete before scrolling
          flatListRef.current?.scrollToEnd({ animated });
        }, 150);
      }
    },
    [messages.length] // Depend on message count
  );

  // Convert URI (local or remote) to Base64 for Gemini API
  const uriToBase64 = useCallback(
    async (uri) => {
      if (!uri) return { base64Data: null, mimeType: null };

      let localUri = uri;
      let mustDeleteTemporaryFile = false;

      try {
        // --- Download Step (if remote URL) ---
        if (uri.startsWith("http")) {
          console.log(`Downloading remote image: ${uri}`);
          const filename =
            uri.split("/").pop().split("#")[0].split("?")[0] ||
            `temp_image_${Date.now()}`;
          const extension = filename.includes(".")
            ? filename.split(".").pop()
            : "jpg"; // Try to keep extension
          const tempPath =
            FileSystem.cacheDirectory +
            `${Date.now()}_${filename.split(".")[0]}.${extension}`;

          const downloadResult = await FileSystem.downloadAsync(uri, tempPath);
          localUri = downloadResult.uri; // Use the local URI of the downloaded file
          mustDeleteTemporaryFile = true;
          console.log(`Downloaded to temporary local URI: ${localUri}`);
        } else if (!uri.startsWith("file://")) {
          throw new Error(`Unsupported URI scheme: ${uri}`);
        }

        // --- Read Local File Step ---
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (!fileInfo.exists) {
          throw new Error(`Local file not found at ${localUri}`);
        }

        // Determine MIME type
        let mimeType = "image/jpeg"; // Default
        const fileExtension = localUri.split(".").pop()?.toLowerCase();
        if (fileExtension === "png") mimeType = "image/png";
        else if (fileExtension === "webp") mimeType = "image/webp";
        else if (fileExtension === "gif") mimeType = "image/gif";
        else if (fileExtension === "heic" || fileExtension === "heif")
          mimeType = "image/heic"; // Common iOS format

        console.log(`Reading local file as base64: ${localUri}`);
        const base64Data = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        console.log(
          `Successfully encoded image, MIME type: ${mimeType}, Length: ${base64Data.length}`
        );

        return { base64Data, mimeType };
      } catch (error) {
        console.error(`Error processing URI "${uri}":`, error);
        // Re-throw specific error for sendMessage to handle UI feedback
        throw new Error(t("chat_error_processing_image"));
      } finally {
        // --- Cleanup Step ---
        if (
          mustDeleteTemporaryFile &&
          localUri.startsWith(FileSystem.cacheDirectory)
        ) {
          try {
            await FileSystem.deleteAsync(localUri, { idempotent: true });
            console.log(`Deleted temporary file: ${localUri}`);
          } catch (deleteError) {
            console.warn(
              `Failed to delete temporary file ${localUri}:`,
              deleteError
            );
          }
        }
      }
    },
    [t] // Depend on translation function for error message
  );

  // --- Image Picker Logic ---
  // Request necessary permissions for camera and gallery
  const requestPermissions = async () => {
    // Check current status first
    const camPerm = await ImagePicker.getCameraPermissionsAsync();
    const libPerm = await ImagePicker.getMediaLibraryPermissionsAsync();

    let cameraGranted = camPerm.granted;
    let libraryGranted = libPerm.granted;

    // Request if not already granted
    if (!cameraGranted) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      cameraGranted = status === "granted";
    }
    if (!libraryGranted) {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      libraryGranted = status === "granted";
    }

    if (!cameraGranted || !libraryGranted) {
      Alert.alert(t("Error"), t("permission_required_camera_gallery"));
      return false;
    }
    return true;
  };

  // Handle choosing an image (either from camera or library)
  const handleChooseImage = async (useCamera = false) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return; // Stop if permissions not granted

    const options = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // Keep original image for analysis
      quality: 0.7, // Reduce quality slightly
    };
    let result;
    try {
      if (useCamera) {
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      // Process the result if not cancelled
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        console.log("Image selected/captured:", selectedUri);
        if (isMounted.current) {
          setAttachedImageUri(selectedUri); // Set the new image URI
          setPendingScanData(null); // Clear any pending saved scan context
        }
      }
    } catch (error) {
      console.error("Image Picker Error:", error);
      Alert.alert(
        t(useCamera ? "error_camera" : "error_library"),
        error.message || t("error_general")
      );
    }
  };

  // --- Attachment Handling ---
  // Show options when the attach button is pressed
  const handleAttachPress = () => {
    if (isSending || editingMessageId) return; // Don't allow if busy
    Keyboard.dismiss(); // Dismiss keyboard first

    // Define options for the action sheet/alert
    const options = [
      t("chat_attach_scan"), // "Select Saved Scan"
      t("chat_attach_gallery"), // "Choose from Gallery"
      t("chat_attach_camera"), // "Take Photo"
      t("cancel"), // "Cancel"
    ];
    const cancelButtonIndex = options.length - 1;

    // Use platform-specific UI for options
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex },
        (buttonIndex) => {
          if (buttonIndex === 0) setIsSelectScanDialogVisible(true);
          else if (buttonIndex === 1) handleChooseImage(false); // Gallery
          else if (buttonIndex === 2) handleChooseImage(true); // Camera
        }
      );
    } else {
      // Use standard Alert for Android
      Alert.alert(
        t("chat_attach_title"), // Title: "Attach"
        t("chat_attach_message"), // Message: "Choose an option"
        [
          {
            text: options[0],
            onPress: () => setIsSelectScanDialogVisible(true),
          },
          { text: options[1], onPress: () => handleChooseImage(false) },
          { text: options[2], onPress: () => handleChooseImage(true) },
          { text: options[3], style: "cancel" },
        ],
        { cancelable: true } // Allow dismissing by tapping outside
      );
    }
  };

  // --- Core Actions ---
  // Generate AI response using Gemini
  const generateAiResponse = useCallback(
    async (chatId, messageHistory) => {
      if (!chatModel)
        throw new Error(t("error_general") + " (AI Model Missing)");
      if (messageHistory.length === 0) {
        console.warn("generateAiResponse called with empty history.");
        return;
      }

      // Ensure history format is valid for the API
      const formattedHistory = messageHistory
        .filter((m) => m.role && Array.isArray(m.parts) && m.parts.length > 0)
        .map((m) => ({ role: m.role, parts: m.parts })); // parts can be [{text...}] or [{inlineData...}] or mix

      // Extract the last message (which might be multimodal)
      const lastMessageObject = formattedHistory[formattedHistory.length - 1];
      if (!lastMessageObject)
        throw new Error(t("error_general") + " (History Format - Last Msg)");

      try {
        // History for starting the chat session (excludes the last message)
        const historyForStartChat = formattedHistory.slice(0, -1);
        console.log(
          "Starting chat session with history length:",
          historyForStartChat.length
        );
        const chatSession = chatModel.startChat({
          history: historyForStartChat,
          // You might add generationConfig here if needed
        });

        // Send the parts array of the last message
        console.log(
          "Sending last message parts to AI:",
          JSON.stringify(lastMessageObject.parts).substring(0, 150) + "..."
        );
        const result = await chatSession.sendMessage(lastMessageObject.parts);

        // Process the response
        if (result.response.promptFeedback?.blockReason) {
          throw new Error(
            t("chat_ai_blocked", {
              reason: result.response.promptFeedback.blockReason,
            })
          );
        }

        const aiResponseText = result.response.text();
        // Check if the response contains usable text
        if (
          aiResponseText &&
          typeof aiResponseText === "string" &&
          aiResponseText.trim()
        ) {
          // Create the Firestore document for the AI message
          const aiMsgFirestore = {
            role: MODEL_ROLE,
            parts: [{ text: aiResponseText.trim() }], // Store only text part from AI for now
            timestamp: serverTimestamp(),
            deleted: false,
          };
          const messagesCollectionRef = getMessagesCollectionRef(chatId);
          if (!messagesCollectionRef)
            throw new Error(t("error_saving_data") + " (AI Ref)");

          console.log(
            "Adding AI response to Firestore:",
            JSON.stringify(aiMsgFirestore).substring(0, 100) + "..."
          );
          // Add the AI message document to Firestore
          await addDoc(messagesCollectionRef, aiMsgFirestore);
        } else {
          console.warn(
            "AI response did not contain valid text content:",
            result.response // Log the full response for debugging if needed
          );
          // Handle cases where the AI might respond with something other than text if needed
        }

        // Update the chat's 'updatedAt' timestamp
        const chatDocRef = doc(db, CHATS_COLLECTION, chatId);
        await updateDoc(chatDocRef, { updatedAt: serverTimestamp() });
        console.log("AI interaction processed and chat updated.");
      } catch (err) {
        // Handle specific Gemini errors or general errors
        let msg = err.message || t("chat_ai_error", { error: "Unknown" });
        if (msg.includes("API key not valid"))
          msg = t("chat_ai_error", { error: "Key" });
        else if (msg.includes("quota"))
          msg = t("chat_ai_error", { error: "Quota" });
        else if (msg.includes("reason: SAFETY"))
          msg = t("chat_ai_blocked", { reason: "SAFETY" });
        console.error("Error generating AI response:", err); // Log the original error too
        throw new Error(msg); // Re-throw the processed error message
      }
    },
    [chatModel, getMessagesCollectionRef, t] // Dependencies
  );

  // Send message (text, attached image, or context)
  const sendMessage = useCallback(
    async (textToSend = inputText) => {
      const userMessageText = textToSend.trim();
      const imageToAttach = attachedImageUri; // Current attached image
      const contextData = pendingScanData; // Current pending scan context

      // Conditions to allow sending
      if (!userMessageText && !imageToAttach && !contextData) {
        console.log("Send cancelled: No input, attachment, or context.");
        return;
      }
      // Core checks
      if (isSending || !chatModel || !user?.uid || !db || isApiKeyPlaceholder) {
        if (isApiKeyPlaceholder) Alert.alert(t("error"), "Dev: AI Key Missing");
        if (!user?.uid) Alert.alert(t("Error"), t("login_required"));
        console.warn(
          `Send cancelled: isSending=${isSending}, chatModel=${!!chatModel}, user=${!!user?.uid}, apiKeyOk=${!isApiKeyPlaceholder}`
        );
        return;
      }

      // --- Start Sending Process ---
      if (isMounted.current) {
        setIsSending(true);
        setError(null); // Clear previous errors
      }
      Keyboard.dismiss();

      // Clear inputs *before* async operations
      if (isMounted.current) {
        setInputText("");
        setAttachedImageUri(null);
        // Don't clear pendingScanData here yet, wait until it's processed
      }

      let tempChatId = currentChatId;
      let isNewChat = !tempChatId;
      // Optimistic ID only needed if there's text content to display immediately
      const optimisticId = userMessageText ? `optimistic-${Date.now()}` : null;

      // Optimistic UI for text part
      if (optimisticId) {
        const optimisticMsg = {
          id: optimisticId,
          role: USER_ROLE,
          parts: [{ text: userMessageText }],
          timestamp: new Date(),
          deleted: false,
          isOptimistic: true,
        };
        if (isMounted.current) {
          setMessages((prev) => [...prev, optimisticMsg]);
          scrollToBottom();
        }
      }

      let contextParts = [];
      let attachedImageParts = [];
      let processingErrorOccurred = false;

      try {
        // --- Process Pending Saved Scan Context (if exists) ---
        if (contextData) {
          console.log("Processing pending scan context data...");
          // Immediately clear the pending data state once we start processing it
          if (isMounted.current) setPendingScanData(null);

          if (contextData.imageUri) {
            // If saved scan included an image, encode it
            const { base64Data, mimeType } = await uriToBase64(
              contextData.imageUri
            );
            if (base64Data && mimeType) {
              // Create parts array with text and image data
              contextParts = [
                { text: `Context: ${contextData.text}` }, // Prefix text for clarity
                { inlineData: { mimeType, data: base64Data } },
              ];
            } else {
              // Fallback if image encoding failed
              contextParts = [
                { text: `Context (Image Failed): ${contextData.text}` },
              ];
              processingErrorOccurred = true; // Mark that an error occurred
            }
          } else {
            // Text-only context
            contextParts = [{ text: `Context: ${contextData.text}` }];
          }
          console.log(
            `Prepared ${contextParts.length} parts for scan context.`
          );
        }

        // --- Process Newly Attached Image (if exists) ---
        if (imageToAttach) {
          console.log("Processing newly attached image...");
          const { base64Data, mimeType } = await uriToBase64(imageToAttach);
          if (base64Data && mimeType) {
            // Create parts array for the attached image
            attachedImageParts = [
              { inlineData: { mimeType, data: base64Data } },
            ];
            console.log("Prepared image part for attached image.");
          } else {
            console.warn("Failed to process newly attached image.");
            processingErrorOccurred = true; // Mark error
          }
        }

        // If image processing failed, stop and show error
        if (processingErrorOccurred) {
          throw new Error(t("chat_error_processing_image"));
        }

        // --- Database Operations ---
        // 1. Create Chat Document or Update Timestamp
        if (isNewChat) {
          // Determine title based on what's being sent
          const titleText =
            userMessageText ||
            (contextData?.text ? "Chat with Scan Context" : "") ||
            (imageToAttach ? "Chat with Image" : "") ||
            t("chat_new_chat");
          const firstLine = titleText.split("\n")[0];
          const title =
            firstLine.substring(0, MAX_CHAT_TITLE_LENGTH) +
            (firstLine.length > MAX_CHAT_TITLE_LENGTH ? "..." : "");

          const chatDocRef = await addDoc(collection(db, CHATS_COLLECTION), {
            userId: user.uid,
            title: title,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          tempChatId = chatDocRef.id;
          if (isMounted.current) {
            setCurrentChatId(tempChatId); // Update state with new chat ID
            setCurrentTitle(title);
          }
          console.log("New chat created with ID:", tempChatId);
        } else if (tempChatId) {
          // Update existing chat's timestamp
          await updateDoc(doc(db, CHATS_COLLECTION, tempChatId), {
            updatedAt: serverTimestamp(),
          });
          console.log("Updated existing chat timestamp for:", tempChatId);
        } else {
          // This should not happen if logic is correct
          throw new Error(t("error_saving_data") + " (Chat ID Missing)");
        }
        // Ensure we have a valid chat ID now
        if (!tempChatId) {
          throw new Error(
            t("error_saving_data") + " (Chat ID Invalid After Check)"
          );
        }

        // 2. Combine parts for the CURRENT user message (Text + Attached Image)
        const currentUserMessageParts = [
          ...(userMessageText ? [{ text: userMessageText }] : []), // Add text part if exists
          ...attachedImageParts, // Add encoded attached image part(s) if they exist
        ];

        // 3. Add Current User Message to Firestore (only if it has content)
        let addedDocRefId = null;
        if (currentUserMessageParts.length > 0) {
          const messagesCollectionRef = getMessagesCollectionRef(tempChatId);
          if (!messagesCollectionRef)
            throw new Error(t("error_saving_data") + " (Msg Ref)");

          const userMsgFirestore = {
            role: USER_ROLE,
            parts: currentUserMessageParts, // Store the combined parts
            timestamp: serverTimestamp(),
            deleted: false,
          };
          const addedDocRef = await addDoc(
            messagesCollectionRef,
            userMsgFirestore
          );
          addedDocRefId = addedDocRef.id;
          console.log(
            "User message (multimodal) added with ID:",
            addedDocRefId
          );

          // Update optimistic message state if it existed
          if (optimisticId && isMounted.current) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === optimisticId
                  ? {
                      ...m,
                      id: addedDocRefId, // Replace temp ID with real ID
                      isOptimistic: false,
                      timestamp: new Date(), // Use local time for now, Firestore listener will update
                    }
                  : m
              )
            );
          }
        }

        // --- Prepare History for AI ---
        // 4. Prepare FULL History (Context -> Past -> Current)
        let finalHistoryForAPI = [];
        if (isMounted.current) {
          // Get confirmed messages from current state
          const confirmedMessages = messages.filter(
            (m) =>
              m.id !== optimisticId && // Exclude the optimistic message
              !m.deleted &&
              m.role &&
              m.parts?.length > 0
          );

          // Prepare the context message (from saved scan) if it exists
          const contextMessageForHistory =
            contextParts.length > 0
              ? { role: USER_ROLE, parts: contextParts } // Use prepared contextParts
              : null;

          // Prepare the current user message (that we just saved) if it exists
          const currentMessageForHistory =
            currentUserMessageParts.length > 0
              ? { role: USER_ROLE, parts: currentUserMessageParts }
              : null;

          // Combine all parts in the correct order for the AI
          finalHistoryForAPI = [
            ...(contextMessageForHistory ? [contextMessageForHistory] : []), // Context first
            ...confirmedMessages.map((m) => ({ role: m.role, parts: m.parts })), // Then past messages
            ...(currentMessageForHistory ? [currentMessageForHistory] : []), // Then the current message
          ];
        } else {
          // Component unmounted before history preparation
          setIsSending(false); // Reset sending state
          return;
        }

        // --- Call AI ---
        // 5. Call generateAiResponse if history is not empty
        if (finalHistoryForAPI.length > 0) {
          console.log(
            `Generating AI response for chat ${tempChatId} with history length: ${finalHistoryForAPI.length}.`
          );
          await generateAiResponse(tempChatId, finalHistoryForAPI); // Await AI response
        } else {
          console.warn(
            "Constructed history for API was empty, skipping AI generation."
          );
        }
      } catch (err) {
        // Catch errors from processing, Firestore, or AI generation
        console.error("Error during sendMessage:", err);
        if (isMounted.current) {
          // Show error to user, avoid showing the specific processing error again if already set
          setError(
            err.message === t("chat_error_processing_image")
              ? t("chat_error_processing_image") // Show the specific processing error
              : err.message || t("chat_send_error") // Otherwise show general send error
          );
          // Remove optimistic message on failure
          if (optimisticId) {
            setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          }
        }
      } finally {
        // Always reset sending state if component is still mounted
        if (isMounted.current) {
          setIsSending(false);
        }
      }
    },
    [
      // Dependencies for useCallback
      inputText,
      attachedImageUri,
      pendingScanData,
      isSending,
      chatModel,
      user, // Use full user object if needed, or user?.uid
      db,
      isApiKeyPlaceholder,
      currentChatId,
      generateAiResponse,
      getMessagesCollectionRef,
      messages, // Include messages state for history building
      t,
      uriToBase64, // Include the base64 helper
    ]
  );

  // --- Scan Selection Handling ---
  // Callback when a saved scan is selected from the dialog
  const handleScanSelectedFromDialog = useCallback(
    (scanData) => {
      if (!scanData) {
        console.warn("Dialog returned no scan data.");
        return;
      }
      console.log(
        "Scan selected:",
        scanData.scanId || "No ID",
        "Image URI:",
        scanData.imageUri
      );
      // Format the text part of the context
      const formattedContext = formatScanDataForMessage(scanData);

      // Store data if formatting was successful and image URI exists
      if (formattedContext && scanData.imageUri) {
        setPendingScanData({
          text: formattedContext,
          imageUri: scanData.imageUri,
        });
        setAttachedImageUri(null); // Clear any newly attached image
        Alert.alert(t("Success"), t("chat_scan_context_image_added")); // Notify user
      } else if (formattedContext) {
        // Fallback if image URI is missing
        console.warn(
          "Scan selected but imageUri is missing. Adding text context only."
        );
        setPendingScanData({ text: formattedContext, imageUri: null });
        setAttachedImageUri(null); // Clear any newly attached image
        Alert.alert(t("Success"), t("chat_scan_context_added"));
      } else {
        // Handle formatting failure
        console.error("Failed to format scan data from dialog for context.");
        Alert.alert(t("error"), t("error_general") + " (Format Fail)");
      }
    },
    [formatScanDataForMessage, t] // Dependencies
  );

  // --- Editing Logic ---
  // Handle long press on a user message to initiate editing
  const handleLongPressMessage = useCallback(
    (message) => {
      // Allow editing only for user's own, non-deleted, non-optimistic, text-only messages
      const isEditable =
        message.role === USER_ROLE &&
        !message.deleted &&
        !isSending &&
        !editingMessageId &&
        message.id &&
        !message.id.startsWith("optimistic") &&
        message.parts?.every((p) => p.text); // Ensure all parts are text

      if (isEditable) {
        if (isMounted.current) {
          setEditingMessageId(message.id);
          // Set edit text (assuming single text part for simplicity in editing)
          setEditText(message.parts.find((p) => p.text)?.text || "");
          // Focus the input field after a short delay
          setTimeout(() => editInputRef.current?.focus(), 100);
        }
      } else if (
        message.role === USER_ROLE &&
        message.parts?.some((p) => p.inlineData) // Check if it contains an image
      ) {
        // Inform user that messages with images cannot be edited
        Alert.alert(t("Info"), t("chat_edit_image_not_supported"));
      }
    },
    [isSending, editingMessageId, t] // Dependencies
  );

  // Cancel the editing process
  const handleCancelEdit = useCallback(() => {
    if (isMounted.current) {
      setEditingMessageId(null);
      setEditText("");
    }
    Keyboard.dismiss();
  }, []); // No dependencies

  // Save the edited message
  const handleSaveEdit = useCallback(async () => {
    const originalMessage = messages.find((m) => m.id === editingMessageId);
    const editedText = editText.trim();
    // Extract original text (assuming single text part for editable messages)
    const originalText =
      originalMessage?.parts?.find((p) => p.text)?.text || "";

    // --- Validation ---
    // Ensure editing is active, text is valid and changed, not sending, etc.
    if (
      !editingMessageId ||
      !editedText ||
      isSending ||
      !currentChatId ||
      !db ||
      !originalMessage ||
      editedText === originalText
    ) {
      handleCancelEdit(); // Cancel if validation fails
      return;
    }
    // Double-check it's not an image message (should be prevented by long press logic)
    if (originalMessage.parts?.some((p) => p.inlineData)) {
      Alert.alert(t("Error"), t("chat_edit_image_not_supported"));
      handleCancelEdit();
      return;
    }
    // --- End Validation ---

    const originalTimestamp = originalMessage.timestamp; // Needed for deleting subsequent messages

    // Set sending state and clear errors
    if (isMounted.current) {
      setIsSending(true);
      setError(null);
    }
    Keyboard.dismiss();

    try {
      // Use Firestore batch write for atomic update/delete
      const batch = writeBatch(db);

      // 1. Update the edited message document
      const msgDocRef = doc(
        db,
        CHATS_COLLECTION,
        currentChatId,
        MESSAGES_SUBCOLLECTION,
        editingMessageId
      );
      batch.update(msgDocRef, {
        parts: [{ text: editedText }], // Update parts with new text
        editedAt: serverTimestamp(), // Mark as edited
      });

      // 2. Mark subsequent messages as deleted
      const messagesCollectionRef = getMessagesCollectionRef(currentChatId);
      // Ensure timestamp is valid for querying
      if (
        !messagesCollectionRef ||
        !(originalTimestamp instanceof firebase.firestore.Timestamp)
      ) {
        throw new Error(
          t("error_saving_data") + " (Edit State - Invalid Timestamp)"
        );
      }
      // Query messages after the edited one
      const q = query(
        messagesCollectionRef,
        where("timestamp", ">", originalTimestamp)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnapshot) => {
        // Update subsequent messages to be deleted (soft delete)
        if (docSnapshot.id !== editingMessageId)
          batch.update(docSnapshot.ref, { deleted: true });
      });

      // 3. Commit the batch write
      await batch.commit();
      console.log("Batch edit successful.");

      // 4. Prepare history for regenerating AI response
      let historyForAPI = [];
      if (isMounted.current) {
        // Rebuild history based on current state up to the edited message
        // Note: This relies on local state, Firestore listener will update eventually
        const editIndex = messages.findIndex((m) => m.id === editingMessageId);
        if (editIndex !== -1) {
          historyForAPI = messages
            .slice(0, editIndex + 1) // Get messages up to and including the edited one
            .map((m, i) =>
              // Replace the edited message content in the history array
              i === editIndex
                ? { ...m, parts: [{ text: editedText }], editedAt: new Date() } // Optimistically update local history
                : m
            )
            // Filter out deleted and ensure structure is valid for AI (text only for edit history)
            .filter(
              (m) =>
                !m.deleted &&
                m.role &&
                m.parts?.length > 0 &&
                m.parts.every((p) => p.text) // Ensure only text parts for regeneration after edit
            )
            .map((m) => ({ role: m.role, parts: m.parts })); // Format for API
        }
      } else {
        return; // Component unmounted
      }

      // 5. Regenerate AI response if history is valid
      if (historyForAPI.length > 0) {
        console.log("Regenerating AI response after edit...");
        await generateAiResponse(currentChatId, historyForAPI);
      } else {
        console.warn(
          "History for AI regeneration was empty or invalid after edit."
        );
      }

      // 6. Exit editing mode
      if (isMounted.current) handleCancelEdit();
    } catch (err) {
      console.error("Error saving edit:", err);
      if (isMounted.current)
        setError(err.message || t("error_saving_data") + " (Edit)");
    } finally {
      // Always reset sending state
      if (isMounted.current) setIsSending(false);
    }
  }, [
    // Dependencies for useCallback
    editingMessageId,
    editText,
    isSending,
    currentChatId,
    db,
    messages,
    getMessagesCollectionRef,
    generateAiResponse,
    handleCancelEdit,
    t,
  ]);

  // --- UI Rendering ---
  // Render individual message item
  const renderMessageItem = useCallback(
    ({ item }) => {
      // Use optimistic ID if real ID isn't available yet
      const messageId = item.id || `optimistic-${item.timestamp?.toString()}`;
      // Don't render the message currently being edited
      if (editingMessageId === messageId) return null;

      const isUser = item.role === USER_ROLE;
      // Find text and image parts within the message's parts array
      const textPart = item.parts?.find((part) => part.text);
      const imagePart = item.parts?.find((part) => part.inlineData);
      const textContent = textPart?.text ?? ""; // Get text content or empty string
      const wasEdited = !!item.editedAt;
      const isOptimistic = !!item.isOptimistic;

      // Determine display text: use text content or placeholder if only image exists
      const displayText =
        textContent ||
        (imagePart ? t("chat_image_sent_placeholder") : "[Error: No Content]");

      return (
        // Touchable area for long press (editing)
        <TouchableOpacity
          activeOpacity={isUser ? 0.7 : 1} // Different feedback for user bubbles
          onLongPress={() => handleLongPressMessage(item)}
          delayLongPress={400} // Standard long press delay
          // Disable long press for AI messages, optimistic messages, or messages with images
          disabled={!item.id || isOptimistic || !isUser || !!imagePart}
        >
          {/* The message bubble view */}
          <View
            style={[
              styles.messageBubble,
              // Apply different styles based on user/AI and optimistic state
              isUser
                ? [styles.userBubble, { backgroundColor: theme.userBubble }]
                : [styles.aiBubble, { backgroundColor: theme.aiBubble }],
              isOptimistic && { opacity: 0.7 }, // Dim optimistic messages slightly
            ]}
          >
            {/* Render content based on whether it's a user or AI message */}
            {isUser ? (
              // Simple text rendering for user messages
              <View>
                <Text
                  style={[styles.messageText, { color: theme.userBubbleText }]}
                  selectable={true} // Allow text selection
                >
                  {displayText}
                  {/* Add a small indicator if text AND image were sent */}
                  {imagePart && textContent && (
                    <Text
                      style={[
                        styles.imageIndicator,
                        { color: theme.userBubbleText },
                      ]}
                    >
                      {" "}
                      (+{t("Image")})
                    </Text>
                  )}
                </Text>
              </View>
            ) : (
              // Use Markdown rendering for AI messages
              <Markdown style={markdownStyles(theme)}>{displayText}</Markdown>
            )}
            {/* Show '(edited)' indicator if applicable */}
            {wasEdited && !isOptimistic && (
              <Text
                style={[
                  styles.editedIndicatorBase,
                  { color: theme.editedIndicator },
                  isUser
                    ? styles.editedIndicatorUser
                    : styles.editedIndicatorAI,
                ]}
              >
                {t("chat_edited")}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [editingMessageId, handleLongPressMessage, theme, t] // Dependencies
  );

  // --- Remove Attached Image Handler ---
  const handleRemoveAttachedImage = () => {
    if (isMounted.current) setAttachedImageUri(null); // Simply clear the state
  };

  // --- Main Component Return ---
  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      {/* --- Render the Saved Scan Selection Dialog (Modal) --- */}
      <SelectScanDialog
        isVisible={isSelectScanDialogVisible}
        onClose={() => setIsSelectScanDialogVisible(false)} // Close handler
        onScanSelect={handleScanSelectedFromDialog} // Callback when scan is selected
        theme={theme} // Pass theme for consistent styling
      />

      {/* --- MAIN CHAT UI --- */}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined} // Use "padding" for iOS
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0} // Adjust offset based on header height if necessary
      >
        {/* Wrapper for messages list and error display */}
        <View style={styles.contentWrapper}>
          {/* Initial Loading Indicator */}
          {isLoadingMessages && messages.length === 0 && (
            <ActivityIndicator
              color={theme.primary}
              style={styles.initialLoader}
              size="large"
            />
          )}
          {/* Messages List */}
          <FlatList
            ref={flatListRef} // Ref for scrolling control
            data={messages} // Data source
            renderItem={renderMessageItem} // Function to render each message
            keyExtractor={
              (item) =>
                item.id || `msg-${item.timestamp?.toString()}-${Math.random()}` // Unique key, fallback for optimistic
            }
            style={styles.messagesList} // Styles for the list container
            contentContainerStyle={styles.messagesContainer} // Styles for the inner content
            onContentSizeChange={() => scrollToBottom(false)} // Auto-scroll when content size changes
            onLayout={() => scrollToBottom(false)} // Auto-scroll on initial layout
            ListEmptyComponent={
              // Display placeholder text when list is empty and not loading/error
              !isLoadingMessages && !error ? (
                <View style={styles.centeredMessageContainer}>
                  <Text
                    style={[
                      styles.emptyListText,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {isApiKeyPlaceholder
                      ? "(Dev: AI Disabled - Invalid Key)" // Dev message if key is bad
                      : t("chat_start_message")}
                  </Text>
                </View>
              ) : null
            }
            // Performance optimizations
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={21}
            removeClippedSubviews={Platform.OS !== "ios"} // Useful on Android
          />
          {/* Error Display Area */}
          {error && (
            <View
              style={[
                styles.statusContainer,
                { backgroundColor: theme.errorBackground },
              ]}
            >
              <AlertCircle
                size={16}
                color={theme.error}
                style={{ marginRight: 8 }}
              />
              <Text
                style={[styles.errorText, { color: theme.error }]}
                selectable={true} // Allow copying error messages
              >
                {error}
              </Text>
            </View>
          )}
        </View>

        {/* --- INPUT AREA (Conditional: Edit or Send) --- */}
        {editingMessageId ? (
          // Editing Input View
          <View
            style={[
              styles.editInputContainer,
              { borderTopColor: theme.border },
            ]}
          >
            {/* Cancel Edit Button */}
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleCancelEdit}
              disabled={isSending} // Disable while network request is active
            >
              <XCircle
                size={28}
                color={
                  isSending ? theme.deleteButtonDisabled : theme.deleteButton
                }
              />
            </TouchableOpacity>
            {/* Edit Text Input */}
            <TextInput
              ref={editInputRef} // Ref for focusing
              style={[
                styles.editInput,
                { backgroundColor: theme.inputBackground, color: theme.text },
              ]}
              value={editText}
              onChangeText={setEditText}
              placeholder={t("edit_message_placeholder")}
              placeholderTextColor={theme.inputPlaceholder}
              multiline
              editable={!isSending} // Disable while sending edit
            />
            {/* Save Edit Button */}
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleSaveEdit}
              // Disable if sending, text is empty, or text hasn't changed
              disabled={
                isSending ||
                !editText.trim() ||
                editText.trim() ===
                  messages // Compare with original text
                    .find((m) => m.id === editingMessageId)
                    ?.parts.find((p) => p.text)?.text
              }
            >
              <CheckCircle
                size={28}
                color={
                  // Conditional color based on disabled state
                  isSending || !editText.trim()
                    ? theme.confirmButtonDisabled
                    : theme.confirmButton
                }
              />
            </TouchableOpacity>
          </View>
        ) : (
          // Standard Send Input View
          <View>
            {/* Image Attachment Preview */}
            {attachedImageUri && (
              <View
                style={[
                  styles.previewContainer,
                  { borderBottomColor: theme.border },
                ]}
              >
                <Image
                  source={{ uri: attachedImageUri }}
                  style={styles.previewImage}
                />
                {/* Remove Image Button */}
                <TouchableOpacity
                  onPress={handleRemoveAttachedImage}
                  style={styles.removePreviewButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increase touch area
                >
                  <XIcon size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
            {/* Input Bar */}
            <View
              style={[
                styles.inputContainer,
                {
                  borderTopColor: theme.border,
                  // Hide top border if preview is shown directly above
                  borderTopWidth: attachedImageUri ? 0 : 1,
                },
              ]}
            >
              {/* Attach Button */}
              <TouchableOpacity
                style={styles.attachButton}
                onPress={handleAttachPress} // Shows attach options
                disabled={isSending} // Disable while sending
              >
                <Paperclip
                  size={24}
                  color={isSending ? theme.iconDisabled : theme.iconDefault}
                />
              </TouchableOpacity>
              {/* Text Input */}
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.inputBackground, color: theme.text },
                ]}
                value={inputText}
                onChangeText={setInputText}
                placeholder={t("chat_placeholder")}
                placeholderTextColor={theme.inputPlaceholder}
                multiline
                editable={!isSending && !isApiKeyPlaceholder} // Disable if sending or key missing
                blurOnSubmit={false} // Prevent keyboard hide on newline
              />
              {/* Send Button */}
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  { backgroundColor: theme.primary },
                  // Apply disabled styles conditionally
                  (isSending ||
                    (!inputText.trim() && // No text
                      !attachedImageUri && // No attached image
                      !pendingScanData) || // No pending context
                    isApiKeyPlaceholder) && [
                    styles.sendButtonDisabled,
                    { backgroundColor: theme.primaryDisabled },
                  ],
                ]}
                onPress={() => sendMessage()} // Send current inputText
                // Disable button based on multiple conditions
                disabled={
                  isSending ||
                  (!inputText.trim() &&
                    !attachedImageUri &&
                    !pendingScanData) ||
                  isApiKeyPlaceholder
                }
              >
                {/* Show spinner or send icon */}
                {isSending ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.userBubbleText}
                  />
                ) : (
                  <Send
                    size={20}
                    color={theme.userBubbleText}
                    strokeWidth={2.5}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// --- Styles ---
// (Styles are included below as defined previously - no changes needed here)
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  contentWrapper: { flex: 1 },
  initialLoader: { marginVertical: 50 },
  messagesList: {},
  messagesContainer: {
    paddingTop: 15,
    paddingBottom: 10,
    paddingHorizontal: 12,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  centeredMessageContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    marginBottom: 50,
  },
  emptyListText: { textAlign: "center", fontSize: 15, lineHeight: 21 },
  messageBubble: {
    maxWidth: "85%",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 18,
    marginBottom: 10,
    minWidth: 50,
    position: "relative",
  },
  userBubble: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  messageText: { fontSize: 16, lineHeight: 22 },
  statusContainer: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  errorText: { flex: 1, textAlign: "left", fontSize: 13 },
  inputContainer: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    alignItems: "flex-end",
  },
  attachButton: {
    paddingHorizontal: 8,
    height: 44,
    justifyContent: "center",
    marginRight: 5,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 130,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 16,
    marginRight: 10,
    lineHeight: 20,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: { opacity: 0.7 },
  editedIndicatorBase: {
    fontSize: 11,
    position: "absolute",
    bottom: 3,
    opacity: 0.8,
  },
  editedIndicatorUser: { right: 10 },
  editedIndicatorAI: { left: 10 },
  editInputContainer: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    alignItems: "center",
  },
  editInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 130,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 16,
    lineHeight: 20,
  },
  editButton: { paddingHorizontal: 12, height: 44, justifyContent: "center" },
  previewContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  previewImage: { width: 40, height: 40, borderRadius: 6, marginRight: 10 },
  removePreviewButton: {
    marginLeft: "auto",
    padding: 8,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  imageIndicator: { fontSize: 12, fontStyle: "italic" },
});

// --- Markdown Styles Function ---
// Provides styling for AI responses rendered using Markdown
const markdownStyles = (theme) =>
  StyleSheet.create({
    body: { color: theme.aiBubbleText, fontSize: 16, lineHeight: 23 },
    heading1: {
      color: theme.text,
      fontWeight: "bold",
      fontSize: 22,
      marginTop: 15,
      marginBottom: 8,
      borderBottomWidth: 1,
      borderColor: theme.border,
      paddingBottom: 5,
    },
    heading2: {
      color: theme.text,
      fontWeight: "600",
      fontSize: 19,
      marginTop: 12,
      marginBottom: 6,
    },
    heading3: {
      color: theme.text,
      fontWeight: "600",
      fontSize: 17,
      marginTop: 10,
      marginBottom: 4,
    },
    strong: { fontWeight: "bold", color: theme.text },
    em: { fontStyle: "italic", color: theme.textSecondary },
    link: { color: "#90CAF9", textDecorationLine: "underline" }, // Use a link color
    bullet_list: { marginVertical: 8, marginLeft: 5 },
    ordered_list: { marginVertical: 8, marginLeft: 5 },
    list_item: {
      marginVertical: 5,
      flexDirection: "row",
      alignItems: "flex-start",
    },
    bullet_list_icon: {
      marginRight: 10,
      marginTop: 7,
      height: 7,
      width: 7,
      borderRadius: 4,
      backgroundColor: theme.primary,
    },
    ordered_list_icon: {
      marginRight: 10,
      color: theme.primary,
      marginTop: 5,
      fontSize: 16,
      fontWeight: "bold",
    },
    code_inline: {
      backgroundColor: theme.inputBackground,
      color: "#FFD600", // Yellowish for code
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 15,
    },
    code_block: {
      backgroundColor: theme.background, // Use main background for contrast
      color: theme.text,
      padding: 15,
      borderRadius: 8,
      marginVertical: 10,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 14.5,
    },
    fence: {
      // Usually same as code_block
      backgroundColor: theme.background,
      color: theme.text,
      padding: 15,
      borderRadius: 8,
      marginVertical: 10,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 14.5,
    },
    blockquote: {
      backgroundColor: "rgba(191, 255, 0, 0.08)", // Faint primary background
      borderLeftColor: theme.primary,
      borderLeftWidth: 4,
      paddingLeft: 12,
      paddingRight: 10,
      paddingVertical: 8,
      marginVertical: 10,
      marginLeft: 2,
      marginRight: 5,
    },
    hr: { backgroundColor: theme.border, height: 1, marginVertical: 15 }, // Horizontal rule
    table: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 4,
      marginVertical: 12,
      overflow: "hidden",
    },
    th: {
      // Table header
      backgroundColor: theme.aiBubble, // Slightly different bg for header
      padding: 10,
      color: theme.text,
      fontWeight: "bold",
      textAlign: "left",
      flex: 1,
    },
    tr: {
      // Table row
      borderBottomWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
    },
    td: {
      // Table cell
      padding: 10,
      textAlign: "left",
      color: theme.aiBubbleText,
      flex: 1,
      borderWidth: 0.5, // Fainter cell borders
      borderColor: theme.border,
    },
  });

export default ChatScreen; // Export the component
