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
} from "react-native";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { useAuth } from "../context/AuthContext";
import { db, firebase } from "../firebase/firebaseInit";
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
  Timestamp,
} from "firebase/firestore";
import Markdown from "react-native-markdown-display";
import {
  Send,
  XCircle,
  CheckCircle,
  AlertCircle,
  Paperclip,
} from "lucide-react-native";
import {
  useRoute,
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";
import { t } from "../localization/strings";

// --- IMPORT THE NEW DIALOG ---
import SelectScanDialog from "../components/SelectScanDialog"; // Adjust path if needed

// --- Configuration & Constants ---
const GEMINI_API_KEY = "AIzaSyDEhRYRo_ajQdvHlEdm44vu_MSPSX5T5Vw"; // Replace!
const GEMINI_MODEL_NAME = "gemini-1.5-flash";
const USER_ROLE = "user";
const MODEL_ROLE = "model";
const MAX_CHAT_TITLE_LENGTH = 35;
const CHATS_COLLECTION = "ai_chats";
const MESSAGES_SUBCOLLECTION = "messages";
const isApiKeyPlaceholder = !GEMINI_API_KEY || GEMINI_API_KEY.includes("YOUR");

const ChatScreen = () => {
  // --- Hooks ---
  const { user } = useAuth();
  const route = useRoute();
  const navigation = useNavigation();
  const flatListRef = useRef(null);
  const editInputRef = useRef(null);
  const isMounted = useRef(true);
  // Flag for processing initial load data (still relevant)
  const scanDataProcessed = useRef(false);

  // --- Route Params ---
  const {
    chatId: initialChatId,
    initialTitle,
    loadScanData,
  } = route.params || {};
  // selectedScanData from route params is NO LONGER USED for selecting scans

  // --- Theme ---
  const theme = {
    /* Consistent dark theme */ background: "#0A0A0A",
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
    error: "#FF9A9A",
    errorBackground: "rgba(255, 0, 0, 0.1)",
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
  const [error, setError] = useState(null);
  const [currentChatId, setCurrentChatId] = useState(initialChatId);
  const [currentTitle, setCurrentTitle] = useState(
    initialChatId ? initialTitle || t("chat_new_chat") : t("chat_new_chat")
  );
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");

  // --- ADD STATE FOR DIALOG VISIBILITY ---
  const [isSelectScanDialogVisible, setIsSelectScanDialogVisible] =
    useState(false);

  // --- Effects ---
  useEffect(() => {
    /* Mount tracking */
    isMounted.current = true;
    // Reset processed flag on initial mount only? Or on focus? Let's use FocusEffect
    // scanDataProcessed.current = false;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    /* Gemini Init */
    if (isApiKeyPlaceholder) {
      if (isMounted.current)
        setError("Dev: " + t("error_general") + " (API Key)");
      return;
    }
    try {
      const ai = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = ai.getGenerativeModel({
        model: GEMINI_MODEL_NAME,
        safetySettings: [
          /*...*/
        ],
      });
      if (isMounted.current) {
        setGenAI(ai);
        setChatModel(model);
      }
    } catch (err) {
      if (isMounted.current) setError(t("error_general") + " (AI Init)");
    }
  }, []);

  useEffect(() => {
    /* Header Title */
    navigation.setOptions({
      title: currentTitle,
      headerStyle: { backgroundColor: theme.headerBackground },
      headerTintColor: theme.text,
      headerTitleStyle: { fontWeight: "600" },
    });
  }, [navigation, currentTitle, theme]);

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
              .slice(1, 5)
              .map((p) => `- ${p.label} (${(p.confidence * 100).toFixed(1)}%)`)
              .join("\n")
          : "";
      // Handle missing/non-string description gracefully
      const descText =
        description && typeof description === "string"
          ? `\n\n*${t("scan_result_description")}*\n${description}`
          : `\n\n*${t("scan_result_description")}*\n${t(
              "scan_result_no_description",
              { label: bestLabel || "?" }
            )}`;
      const details = `*${t("chat_disease")}* ${
        bestLabel || "N/A"
      } (${confidencePercent}%)${top5Text}${descText}\n\n(Scan ID: ${
        scanId || "?"
      })`;
      return t("chat_scan_context_message", { details });
    },
    [t]
  ); // Added t dependency

  // --- Effect for Initial LoadScanData (From Navigation Params) ---
  // This handles the case where ChatScreen is opened INITIALLY with scan data
  useEffect(() => {
    // Only process initial loadScanData if it exists, we DON'T have a chatId yet,
    // component is mounted, and scan data hasn't been processed yet for this instance.
    if (
      loadScanData &&
      !currentChatId &&
      isMounted.current &&
      !scanDataProcessed.current
    ) {
      console.log(
        "Processing INITIAL loadScanData param to start NEW chat context..."
      );
      const formattedMessage = formatScanDataForMessage(loadScanData);
      if (formattedMessage) {
        scanDataProcessed.current = true; // Mark as processed FIRST for this instance
        sendMessage(formattedMessage); // This will create a new chat
        // Clear the param AFTER initiating send
        navigation.setParams({ loadScanData: undefined });
      } else {
        console.warn("Failed to format initial load scan data for message.");
        // Still clear the param
        navigation.setParams({ loadScanData: undefined });
      }
    }
    // React only to initial loadScanData param and lack of chatId
  }, [
    loadScanData,
    currentChatId,
    navigation,
    formatScanDataForMessage,
    sendMessage,
  ]);

  // --- Effect to Reset Processed Flag on Screen Focus ---
  // Ensures that if the user navigates away and back with NEW initial params (unlikely but possible),
  // or just for general robustness, the flag is reset when the screen becomes active.
  useFocusEffect(
    useCallback(() => {
      scanDataProcessed.current = false;
      console.log("ChatScreen focused, reset scanDataProcessed flag.");
      // Optional cleanup function if needed when screen loses focus
      // return () => { console.log("ChatScreen blurred/unmounted"); };
    }, [])
  );

  // --- Get Messages Collection Ref ---
  const getMessagesCollectionRef = useCallback(
    (chatId) => {
      if (!user || !db || !chatId) return null;
      return collection(db, CHATS_COLLECTION, chatId, MESSAGES_SUBCOLLECTION);
    },
    [user]
  ); // db is constant, user object reference might change on login/logout

  // --- Fetch Messages ---
  useFocusEffect(
    useCallback(() => {
      if (!currentChatId || !user || !db) {
        if (!currentChatId && isMounted.current) setIsLoadingMessages(false);
        return;
      }
      if (isMounted.current) {
        setIsLoadingMessages(true);
        setError(null);
      }
      const messagesCollectionRef = getMessagesCollectionRef(currentChatId);
      if (!messagesCollectionRef) {
        if (isMounted.current) {
          setError(t("error_loading_data") + " (Ref)");
          setIsLoadingMessages(false);
        }
        return;
      }
      const messagesQuery = query(
        messagesCollectionRef,
        where("deleted", "==", false),
        orderBy("timestamp", "asc")
      );
      const unsubscribe = onSnapshot(
        messagesQuery,
        (snapshot) => {
          const fetched = snapshot.docs
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
              timestamp: doc.data().timestamp, // Keep as Firestore Timestamp or Date
              editedAt: doc.data().editedAt,
            }))
            .filter((m) => m.role && m.parts?.[0]?.text !== undefined); // Basic validation

          if (isMounted.current) {
            setMessages(fetched);
            setIsLoadingMessages(false);
            if (!editingMessageId) scrollToBottom(false); // Scroll down when new messages load (unless editing)
          }
        },
        (err) => {
          if (isMounted.current) {
            setError(t("chat_messages_load_error"));
            setIsLoadingMessages(false);
          }
          console.error("Msg fetch err:", err);
        }
      );

      // Cleanup function for onSnapshot listener
      return () => {
        console.log("Unsubscribing from messages for chat:", currentChatId);
        unsubscribe();
      };
    }, [currentChatId, user, getMessagesCollectionRef, editingMessageId, t]) // Added t for error messages
  );

  // --- Helper Functions ---
  const scrollToBottom = useCallback(
    (animated = true) => {
      if (messages.length > 0 && flatListRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated });
        }, 150); // Short delay allows layout updates
      }
    },
    [messages.length]
  ); // Depends only on message count

  // --- Core Actions ---
  const generateAiResponse = useCallback(
    async (chatId, messageHistory) => {
      // messageHistory is the full history now
      if (!chatModel)
        throw new Error(t("error_general") + " (AI Model Missing)");
      // messageHistory ALREADY includes the last user message
      if (messageHistory.length === 0) return;

      // Ensure history format is correct (should be already, but double-check)
      const formattedHistory = messageHistory
        .filter((m) => m.role && m.parts?.[0]?.text)
        .map((m) => ({ role: m.role, parts: m.parts }));

      // Get the last message text from the provided history
      const lastUserMessageText =
        formattedHistory[formattedHistory.length - 1]?.parts[0]?.text;
      if (!lastUserMessageText)
        throw new Error(t("error_general") + " (History Format - Last Msg)");

      try {
        // IMPORTANT: Pass history *excluding* the last message to startChat
        const historyForStartChat = formattedHistory.slice(0, -1);
        console.log(
          "Starting chat session with history length:",
          historyForStartChat.length
        );

        const chatSession = chatModel.startChat({
          history: historyForStartChat, // Send history *excluding* the last message
        });

        // Send ONLY the last message text to sendMessage
        console.log(
          "Sending last message to AI:",
          lastUserMessageText.substring(0, 100) + "..."
        );
        const result = await chatSession.sendMessage(lastUserMessageText);

        // ... rest of the generateAiResponse function remains the same ...
        if (result.response.promptFeedback?.blockReason) {
          throw new Error(
            t("chat_ai_blocked", {
              reason: result.response.promptFeedback.blockReason,
            })
          );
        }
        const aiResponseText = result.response.text();
        if (!aiResponseText || typeof aiResponseText !== "string") {
          throw new Error(t("chat_ai_error", { error: "Format" }));
        }
        const aiMsgFirestore = {
          role: MODEL_ROLE, // Use the constant for the AI's role
          parts: [{ text: aiResponseText.trim() }], // Add the response text
          timestamp: serverTimestamp(), // Add the server timestamp
          deleted: false, // Set deleted flag to false
        };
        const messagesCollectionRef = getMessagesCollectionRef(chatId);
        if (!messagesCollectionRef)
          throw new Error(t("error_saving_data") + " (AI Ref)");
        console.log("Adding AI response to Firestore...");
        await addDoc(messagesCollectionRef, aiMsgFirestore);
        const chatDocRef = doc(db, CHATS_COLLECTION, chatId);
        await updateDoc(chatDocRef, { updatedAt: serverTimestamp() });
        console.log("AI response saved and chat updated.");
      } catch (err) {
        let msg = err.message || t("chat_ai_error", { error: "Unknown" });
        if (msg.includes("API key not valid"))
          msg = t("chat_ai_error", { error: "Key" });
        else if (msg.includes("quota"))
          msg = t("chat_ai_error", { error: "Quota" });
        else if (msg.includes("reason: SAFETY"))
          msg = t("chat_ai_blocked", { reason: "SAFETY" });
        // Add more specific error checks if needed
        console.error("Error generating AI response:", msg);
        throw new Error(msg); // Re-throw cleaned error message
      }
    },
    [chatModel, getMessagesCollectionRef, t]
  ); // Added t dependency

  const sendMessage = useCallback(
    async (textToSend = inputText) => {
      const userMessageText = textToSend.trim();
      if (
        !userMessageText ||
        isSending ||
        !chatModel ||
        !user ||
        !db ||
        isApiKeyPlaceholder
      ) {
        if (isApiKeyPlaceholder) Alert.alert(t("error"), "Dev: AI Key Missing");
        return;
      }

      // Clear input only if sending the text currently in the input box
      if (textToSend === inputText && isMounted.current) {
        setInputText("");
      }
      if (isMounted.current) {
        setIsSending(true);
        setError(null);
      }
      Keyboard.dismiss();

      let tempChatId = currentChatId;
      let isNewChat = !tempChatId;
      const optimisticId = `optimistic-${Date.now()}`; // Unique ID for optimistic UI

      // Optimistic UI update: Add message immediately
      const optimisticMsg = {
        id: optimisticId, // Use temporary ID
        role: USER_ROLE,
        parts: [{ text: userMessageText }],
        timestamp: new Date(), // Use JS Date for optimistic UI
        deleted: false,
        isOptimistic: true, // Flag for potential styling
      };
      if (isMounted.current) {
        setMessages((prev) => [...prev, optimisticMsg]);
        scrollToBottom(); // Scroll after adding optimistic message
      }

      try {
        // 1. Create Chat or Update Timestamp
        if (isNewChat) {
          console.log("Creating new chat document...");
          const firstLine = userMessageText.split("\n")[0];
          const title =
            firstLine.substring(0, MAX_CHAT_TITLE_LENGTH) +
            (firstLine.length > MAX_CHAT_TITLE_LENGTH ? "..." : "");
          const chatDocRef = await addDoc(collection(db, CHATS_COLLECTION), {
            userId: user.uid,
            title: title || t("chat_new_chat"), // Default title if message is empty somehow
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          tempChatId = chatDocRef.id;
          console.log("New chat created with ID:", tempChatId);
          if (isMounted.current) {
            // Update state AFTER Firestore operation is successful
            setCurrentChatId(tempChatId);
            setCurrentTitle(title || t("chat_new_chat"));
          }
        } else {
          console.log("Updating existing chat timestamp for:", tempChatId);
          await updateDoc(doc(db, CHATS_COLLECTION, tempChatId), {
            updatedAt: serverTimestamp(),
          });
        }

        // Ensure we have a valid Chat ID before proceeding
        if (!tempChatId) {
          throw new Error(t("error_saving_data") + " (Chat ID Missing)");
        }

        // 2. Add User Message to Firestore
        const messagesCollectionRef = getMessagesCollectionRef(tempChatId);
        if (!messagesCollectionRef)
          throw new Error(t("error_saving_data") + " (Msg Ref)");

        const userMsgFirestore = {
          role: USER_ROLE,
          parts: [{ text: userMessageText }],
          timestamp: serverTimestamp(), // Use server timestamp for actual data
          deleted: false,
        };
        console.log("Adding user message to Firestore for chat:", tempChatId);
        const addedDocRef = await addDoc(
          messagesCollectionRef,
          userMsgFirestore
        );
        console.log("User message added with ID:", addedDocRef.id);

        // Update optimistic message ID once saved (optional but good practice)
        if (isMounted.current) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === optimisticId
                ? {
                    ...m,
                    id: addedDocRef.id,
                    isOptimistic: false,
                    timestamp: new Date() /* Or fetch actual timestamp later */,
                  }
                : m
            )
          );
        }

        // 3. Prepare History and Generate AI Response
        // Construct history reliably using current state + the message just sent
        let finalHistoryForAPI = [];
        if (isMounted.current) {
          // Get the current messages from state (excluding the optimistic one we added)
          const confirmedMessages = messages.filter(
            (m) =>
              m.id !== optimisticId &&
              !m.deleted &&
              m.role &&
              m.parts?.[0]?.text
          );

          // Manually add the message we just processed (userMessageText)
          // Ensure it has the correct structure for the generateAiResponse function
          const currentMessageForHistory = {
            role: USER_ROLE,
            parts: [{ text: userMessageText }],
          };

          // Combine confirmed history with the current message
          finalHistoryForAPI = [
            ...confirmedMessages.map((m) => ({ role: m.role, parts: m.parts })), // Format previous messages
            currentMessageForHistory, // Add the current one
          ];
        } else {
          // Component unmounted, abort AI generation
          console.warn(
            "Component unmounted before preparing history for AI response."
          );
          setIsSending(false); // Ensure sending state is reset
          return;
        }

        // Ensure the history isn't empty before calling AI
        if (finalHistoryForAPI.length > 0) {
          console.log(
            `Generating AI response for chat ${tempChatId} with constructed history length: ${finalHistoryForAPI.length}`
          );
          try {
            // Pass the FULL constructed history to generateAiResponse
            await generateAiResponse(tempChatId, finalHistoryForAPI);
          } catch (aiError) {
            // Catch errors specifically from generateAiResponse
            console.error("Error from generateAiResponse:", aiError);
            if (isMounted.current) {
              // Optionally update UI error state here if needed beyond the generic catch
              setError(
                aiError.message ||
                  t("chat_ai_error", { error: "Generation Failed" })
              );
              // Consider if you need to remove the user's optimistic message here too if AI fails
              // setMessages(prev => prev.filter(m => m.id !== optimisticId));
            }
          }
        } else {
          // This warning should ideally not happen now, but keep it for debugging
          console.warn(
            "Constructed history for API was unexpectedly empty, skipping AI generation."
          );
        }
      } catch (err) {
        // Keep the outer catch block for Firestore errors etc.
        console.error("Error during sendMessage (outside AI generation):", err);
        if (isMounted.current) {
          // Remove optimistic message on failure
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          setError(err.message || t("chat_send_error"));
        }
      } finally {
        if (isMounted.current) {
          setIsSending(false);
        }
      }
    },
    [
      inputText,
      isSending,
      chatModel,
      user,
      db,
      isApiKeyPlaceholder,
      currentChatId,
      generateAiResponse,
      getMessagesCollectionRef,
      messages,
      t,
      handleCancelEdit,
    ]
  ); // Added handleCancelEdit if used within try/catch/finally

  // --- MODIFY handleAttachScan TO OPEN DIALOG ---
  const handleAttachScan = useCallback(() => {
    if (isSending || editingMessageId) return;
    console.log("Opening SelectScanDialog...");
    Keyboard.dismiss(); // Dismiss keyboard before opening dialog
    setIsSelectScanDialogVisible(true); // <-- Open the dialog
  }, [isSending, editingMessageId]); // Depends on sending/editing state

  // --- ADD HANDLER FOR WHEN A SCAN IS SELECTED FROM DIALOG ---
  const handleScanSelectedFromDialog = useCallback(
    (scanData) => {
      if (!scanData) {
        console.warn("Dialog returned no scan data.");
        return;
      }
      console.log("Scan selected from dialog:", scanData.scanId || "No ID");
      const formattedMessage = formatScanDataForMessage(scanData);
      if (formattedMessage) {
        // Use the sendMessage function to handle adding it (handles new chat creation too)
        sendMessage(formattedMessage);
      } else {
        console.error("Failed to format scan data from dialog for message.");
        Alert.alert(t("error"), t("error_general") + " (Format Fail)");
      }
      // Dialog closes itself via its internal logic (onScanSelect calls onClose)
    },
    [formatScanDataForMessage, sendMessage, t]
  ); // Added t dependency

  // --- Editing Logic (Keep existing refined versions) ---
  const handleLongPressMessage = useCallback(
    (message) => {
      // Allow long press only on user's own, non-deleted, non-optimistic messages when not sending/editing
      if (
        message.role === USER_ROLE &&
        !message.deleted &&
        !isSending &&
        !editingMessageId &&
        message.id &&
        !message.id.startsWith("optimistic")
      ) {
        if (isMounted.current) {
          setEditingMessageId(message.id);
          setEditText(message.parts[0].text);
          setTimeout(() => editInputRef.current?.focus(), 100); // Focus after state update
        }
      }
    },
    [isSending, editingMessageId]
  ); // Depends only on sending/editing state

  const handleCancelEdit = useCallback(() => {
    if (isMounted.current) {
      setEditingMessageId(null);
      setEditText("");
    }
    Keyboard.dismiss();
  }, []); // No dependencies

  const handleSaveEdit = useCallback(async () => {
    const originalMessage = messages.find((m) => m.id === editingMessageId);
    const editedText = editText.trim();

    // Basic validation: Check if editing, text changed, etc.
    if (
      !editingMessageId ||
      !editedText ||
      isSending ||
      !currentChatId ||
      !db ||
      !originalMessage ||
      editedText === originalMessage.parts[0].text
    ) {
      handleCancelEdit();
      return;
    }

    const originalTimestamp = originalMessage.timestamp; // Get timestamp for deletion query

    if (isMounted.current) {
      setIsSending(true);
      setError(null);
    }
    Keyboard.dismiss();

    try {
      console.log("Starting batch write for edit...");
      const batch = writeBatch(db);

      // 1. Update the edited message
      const msgDocRef = doc(
        db,
        CHATS_COLLECTION,
        currentChatId,
        MESSAGES_SUBCOLLECTION,
        editingMessageId
      );
      batch.update(msgDocRef, {
        parts: [{ text: editedText }],
        editedAt: serverTimestamp(), // Mark as edited
      });
      console.log("Batch: Updated message", editingMessageId);

      // 2. Delete subsequent messages (if any)
      const messagesCollectionRef = getMessagesCollectionRef(currentChatId);
      if (
        !messagesCollectionRef ||
        !(originalTimestamp instanceof firebase.firestore.Timestamp)
      ) {
        // Need a valid Firestore timestamp to query reliably
        throw new Error(
          t("error_saving_data") + " (Edit State - Invalid Timestamp)"
        );
      }
      console.log(
        "Batch: Querying messages after timestamp:",
        originalTimestamp.toDate()
      );
      const q = query(
        messagesCollectionRef,
        where("timestamp", ">", originalTimestamp)
      );
      const snapshot = await getDocs(q);

      let subsequentMessageCount = 0;
      snapshot.forEach((docSnapshot) => {
        // Ensure we don't accidentally delete the message being edited if timestamps are identical (unlikely)
        if (docSnapshot.id !== editingMessageId) {
          batch.update(docSnapshot.ref, { deleted: true }); // Soft delete
          subsequentMessageCount++;
        }
      });
      console.log(
        "Batch: Marked",
        subsequentMessageCount,
        "subsequent messages as deleted."
      );

      // 3. Commit the batch
      await batch.commit();
      console.log("Batch commit successful.");

      // 4. Prepare history for new AI response (up to and including the edited message)
      let historyForAPI = [];
      if (isMounted.current) {
        setMessages((currentMsgs) => {
          const editIndex = currentMsgs.findIndex(
            (m) => m.id === editingMessageId
          );
          if (editIndex === -1) {
            console.warn(
              "Edited message not found in state after batch commit."
            );
            historyForAPI = []; // Safety fallback
            return currentMsgs; // Return unchanged state
          }
          // Take messages up to the edited one, apply the edit, filter deleted
          historyForAPI = currentMsgs
            .slice(0, editIndex + 1)
            .map((m, i) => {
              if (i === editIndex)
                return {
                  ...m,
                  parts: [{ text: editedText }],
                  editedAt: new Date(),
                }; // Update text optimistically
              return m;
            })
            .filter((m) => !m.deleted && m.role && m.parts?.[0]?.text) // Filter invalid/deleted
            .map((m) => ({ role: m.role, parts: m.parts })); // Format for API
          // Return the current state, the listener will update it properly from Firestore soon
          return currentMsgs;
        });
      } else {
        return; // Component unmounted
      }

      // 5. Regenerate AI response if history exists
      if (historyForAPI.length > 0) {
        console.log("Regenerating AI response after edit...");
        await generateAiResponse(currentChatId, historyForAPI);
      } else {
        console.warn("History was empty after edit, skipping AI regeneration.");
      }

      // Reset editing state *after* operations
      if (isMounted.current) handleCancelEdit();
    } catch (err) {
      console.error("Error saving edit:", err);
      if (isMounted.current)
        setError(err.message || t("error_saving_data") + " (Edit)");
    } finally {
      if (isMounted.current) setIsSending(false);
    }
  }, [
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
  ]); // Added t dependency

  // --- UI Rendering ---
  const renderMessageItem = useCallback(
    ({ item }) => {
      const messageId = item.id || `optimistic-${item.timestamp?.toString()}`; // Handle optimistic ID
      if (editingMessageId === messageId) return null; // Don't render the message being edited

      const isUser = item.role === USER_ROLE;
      const textContent = item.parts?.[0]?.text ?? "[Error: No Content]";
      const wasEdited = !!item.editedAt;
      const isOptimistic = !!item.isOptimistic; // Check for optimistic flag

      return (
        <TouchableOpacity
          activeOpacity={isUser ? 0.7 : 1}
          onLongPress={() => handleLongPressMessage(item)}
          delayLongPress={400}
          disabled={!item.id || isOptimistic || !isUser} // Disable long press on AI, optimistic, or non-user messages
        >
          <View
            style={[
              styles.messageBubble,
              isUser
                ? [styles.userBubble, { backgroundColor: theme.userBubble }]
                : [styles.aiBubble, { backgroundColor: theme.aiBubble }],
              isOptimistic && { opacity: 0.7 }, // Style optimistic messages differently
            ]}
          >
            {isUser ? (
              <Text
                style={[styles.messageText, { color: theme.userBubbleText }]}
                selectable={true}
              >
                {textContent}
              </Text>
            ) : (
              <Markdown style={markdownStyles(theme)}>{textContent}</Markdown>
            )}
            {wasEdited &&
              !isOptimistic && ( // Show edited only if not optimistic
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
            {/* Optional: Visual indicator for optimistic messages */}
            {/* {isOptimistic && <Text style={{ fontSize: 10, color: theme.optimisticIndicator, alignSelf: 'flex-end', marginTop: 2 }}>Sending...</Text>} */}
          </View>
        </TouchableOpacity>
      );
    },
    [editingMessageId, handleLongPressMessage, theme, t]
  ); // Added t dependency

  // --- Main Component Return ---
  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      {/* --- RENDER THE DIALOG --- */}
      <SelectScanDialog
        isVisible={isSelectScanDialogVisible}
        onClose={() => setIsSelectScanDialogVisible(false)}
        onScanSelect={handleScanSelectedFromDialog}
        theme={theme} // Pass theme down
      />

      {/* Rest of the ChatScreen UI */}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined} // Use undefined for Android (usually handles itself)
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0} // Adjust offset as needed
      >
        <View style={styles.contentWrapper}>
          {isLoadingMessages && messages.length === 0 && (
            <ActivityIndicator
              color={theme.primary}
              style={styles.initialLoader}
              size="large"
            />
          )}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) =>
              item.id || `msg-${item.timestamp?.toString()}-${Math.random()}`
            } // Fallback key for optimistic
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContainer}
            onContentSizeChange={() => scrollToBottom(false)} // Scroll on size change (e.g., keyboard)
            onLayout={() => scrollToBottom(false)} // Scroll on initial layout
            ListEmptyComponent={
              !isLoadingMessages && !error ? (
                <View style={styles.centeredMessageContainer}>
                  <Text
                    style={[
                      styles.emptyListText,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {isApiKeyPlaceholder
                      ? "(Dev: AI Disabled - Invalid Key)"
                      : t("chat_start_message")}
                  </Text>
                </View>
              ) : null
            }
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={21}
            removeClippedSubviews={Platform.OS !== "ios"} // Perf optimization on Android
          />
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
                selectable={true}
              >
                {error}
              </Text>
            </View>
          )}
        </View>

        {/* Conditional Input Area: Edit or Send */}
        {editingMessageId ? (
          <View
            style={[
              styles.editInputContainer,
              { borderTopColor: theme.border },
            ]}
          >
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleCancelEdit}
              disabled={isSending}
            >
              <XCircle
                size={28}
                color={
                  isSending ? theme.deleteButtonDisabled : theme.deleteButton
                }
              />
            </TouchableOpacity>
            <TextInput
              ref={editInputRef}
              style={[
                styles.editInput,
                { backgroundColor: theme.inputBackground, color: theme.text },
              ]}
              value={editText}
              onChangeText={setEditText}
              placeholder={t("edit_message_placeholder")}
              placeholderTextColor={theme.inputPlaceholder}
              multiline
              editable={!isSending} // Disable input while sending edit
            />
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleSaveEdit}
              disabled={
                isSending ||
                !editText.trim() ||
                editText.trim() ===
                  messages.find((m) => m.id === editingMessageId)?.parts[0].text
              } // Disable if sending, empty, or unchanged
            >
              <CheckCircle
                size={28}
                color={
                  isSending || !editText.trim()
                    ? theme.confirmButtonDisabled
                    : theme.confirmButton
                }
              />
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={[styles.inputContainer, { borderTopColor: theme.border }]}
          >
            {/* Attach Button - Uses MODIFIED handler to open dialog */}
            <TouchableOpacity
              style={styles.attachButton}
              onPress={handleAttachScan} // Opens the dialog
              disabled={isSending} // Disable while sending a message
            >
              <Paperclip
                size={24}
                color={isSending ? theme.iconDisabled : theme.iconDefault}
              />
            </TouchableOpacity>
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
              editable={!isSending && !isApiKeyPlaceholder} // Disable if sending or API key missing
              blurOnSubmit={false} // Prevent keyboard dismiss on newline/submit (for multiline)
              // onSubmitEditing={() => sendMessage()} // Optional: Send on hardware keyboard return key
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: theme.primary },
                (isSending || !inputText.trim() || isApiKeyPlaceholder) && [
                  styles.sendButtonDisabled,
                  { backgroundColor: theme.primaryDisabled },
                ],
              ]}
              onPress={() => sendMessage()} // Pass nothing to send current inputText
              disabled={isSending || !inputText.trim() || isApiKeyPlaceholder} // Disable if sending, empty, or API key missing
            >
              {isSending ? (
                <ActivityIndicator size="small" color={theme.userBubbleText} />
              ) : (
                <Send
                  size={20}
                  color={theme.userBubbleText}
                  strokeWidth={2.5}
                />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  contentWrapper: { flex: 1 },
  initialLoader: { marginVertical: 50 },
  messagesList: {
    // The list itself takes up available space
  },
  messagesContainer: {
    paddingTop: 15, // Space at the top
    paddingBottom: 10, // Space at the bottom before input
    paddingHorizontal: 12,
    flexGrow: 1, // Ensure container grows to allow scrolling
    justifyContent: "flex-end", // Messages start from the bottom
  },
  centeredMessageContainer: {
    // For Empty list message
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    marginBottom: 50, // Push it up slightly from the input bar area
  },
  emptyListText: {
    textAlign: "center",
    fontSize: 15,
    lineHeight: 21,
  },
  messageBubble: {
    maxWidth: "85%", // Limit bubble width
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 18,
    marginBottom: 10, // Space between bubbles
    minWidth: 50, // Ensure very short messages have some width
    position: "relative", // Needed for absolute positioned indicators
  },
  userBubble: {
    alignSelf: "flex-end", // Align user messages to the right
    borderBottomRightRadius: 4, // Characteristic chat bubble shape
  },
  aiBubble: {
    alignSelf: "flex-start", // Align AI messages to the left
    borderBottomLeftRadius: 4, // Characteristic chat bubble shape
  },
  messageText: {
    // Style for user text (inside Text component)
    fontSize: 16,
    lineHeight: 22,
  },
  statusContainer: {
    // For Errors
    paddingVertical: 8,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  errorText: {
    flex: 1, // Take remaining space
    textAlign: "left",
    fontSize: 13,
  },
  inputContainer: {
    // Container for attach, text input, send button
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    alignItems: "flex-end", // Align items to bottom (for multiline input growth)
  },
  attachButton: {
    paddingHorizontal: 8,
    // Adjust vertical padding/margin to align with input center
    height: 44, // Match typical input height
    justifyContent: "center",
    marginRight: 5,
    // marginBottom: Platform.OS === 'ios' ? 2 : 5, // Fine-tune vertical alignment
  },
  input: {
    flex: 1, // Take available horizontal space
    minHeight: 44, // Good default height
    maxHeight: 130, // Limit multiline growth
    borderRadius: 22, // Pill shape
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === "ios" ? 12 : 8, // iOS needs more padding
    fontSize: 16,
    marginRight: 10,
    lineHeight: 20, // Adjust line height for multiline
  },
  sendButton: {
    width: 44, // Circular button
    height: 44,
    borderRadius: 22, // Make it circular
    justifyContent: "center",
    alignItems: "center",
    // marginBottom: Platform.OS === 'ios' ? 0 : 0, // Align with input bottom
  },
  sendButtonDisabled: {
    opacity: 0.7, // Indicate disabled state
  },
  editedIndicatorBase: {
    fontSize: 11,
    position: "absolute",
    bottom: 3, // Position at bottom of bubble
    opacity: 0.8,
  },
  editedIndicatorUser: {
    right: 10, // Position for user bubble
  },
  editedIndicatorAI: {
    left: 10, // Position for AI bubble
  },
  editInputContainer: {
    // Container for editing input/buttons
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    alignItems: "center", // Center items vertically for single line edit
  },
  editInput: {
    // Similar to send input, but maybe slightly different padding
    flex: 1,
    minHeight: 44,
    maxHeight: 130,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 16,
    lineHeight: 20,
  },
  editButton: {
    // For Cancel/Confirm edit buttons
    paddingHorizontal: 12,
    paddingVertical: 8, // Adjust padding for touch area
    height: 44, // Match input height
    justifyContent: "center",
  },
});

// --- Markdown Styles Function ---
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
    link: { color: "#90CAF9", textDecorationLine: "underline" },
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
      color: "#FFD600",
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 15,
    },
    code_block: {
      backgroundColor: theme.background,
      color: theme.text,
      padding: 15,
      borderRadius: 8,
      marginVertical: 10,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 14.5,
    },
    fence: {
      backgroundColor: theme.background,
      color: theme.text,
      padding: 15,
      borderRadius: 8,
      marginVertical: 10,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 14.5,
    },
    blockquote: {
      backgroundColor: "rgba(191, 255, 0, 0.08)",
      borderLeftColor: theme.primary,
      borderLeftWidth: 4,
      paddingLeft: 12,
      paddingRight: 10,
      paddingVertical: 8,
      marginVertical: 10,
      marginLeft: 2,
      marginRight: 5,
    },
    hr: { backgroundColor: theme.border, height: 1, marginVertical: 15 },
    table: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 4,
      marginVertical: 12,
      overflow: "hidden",
    },
    th: {
      backgroundColor: theme.aiBubble,
      padding: 10,
      color: theme.text,
      fontWeight: "bold",
      textAlign: "left",
      flex: 1,
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
    },
    td: {
      padding: 10,
      textAlign: "left",
      color: theme.aiBubbleText,
      flex: 1,
      borderWidth: 0.5,
      borderColor: theme.border,
    },
  });

export default ChatScreen;
