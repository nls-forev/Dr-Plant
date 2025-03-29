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
} from "react-native";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { useAuth } from "../context/AuthContext";
import { db, firebase } from "../firebase/firebaseInit"; // Using the mixed export
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch, // Import writeBatch for atomic operations
  where,
  getDocs, // Import getDocs for querying subsequent messages
  Timestamp, // Import Timestamp for comparisons
} from "firebase/firestore";
import Markdown from "react-native-markdown-display";
import { Send, XCircle, CheckCircle, Paperclip } from "lucide-react-native"; // Added Paperclip
import { useRoute, useNavigation } from "@react-navigation/native";

// --- Configuration ---
// --- 🚨 EXTREMELY IMPORTANT SECURITY WARNING 🚨 ---
// DO NOT SHIP YOUR APP WITH THE API KEY HARDCODED. Use environment variables or a backend.
const GEMINI_API_KEY = "AIzaSyDEhRYRo_ajQdvHlEdm44vu_MSPSX5T5Vw"; // <-- PASTE YOUR KEY FOR TESTING ONLY
const GEMINI_MODEL_NAME = "gemini-1.5-flash";
// --- End Configuration ---

// --- Constants ---
const USER_ROLE = "user";
const MODEL_ROLE = "model";
const MAX_CHAT_TITLE_LENGTH = 35;
const CHATS_COLLECTION = "ai_chats";
const MESSAGES_SUBCOLLECTION = "messages";

// Simple check if the key is still the placeholder
const isApiKeyPlaceholder = !GEMINI_API_KEY || GEMINI_API_KEY.includes("YOUR");

const ChatScreen = () => {
  // --- Hooks ---
  const { user } = useAuth();
  const route = useRoute();
  const navigation = useNavigation();
  const flatListRef = useRef(null);
  const editInputRef = useRef(null);

  // --- Route Params ---
  const {
    chatId: initialChatId,
    initialTitle,
    loadScanData, // Expecting { scanId, bestLabel, bestConfidence, imageUri, description }
  } = route.params || {};

  // --- State ---
  const [genAI, setGenAI] = useState(null);
  const [chatModel, setChatModel] = useState(null);
  const [isLoading, setIsLoading] = useState(!!initialChatId);
  const [isSending, setIsSending] = useState(false); // Covers sending and AI response generation
  const [error, setError] = useState(null);
  const [currentChatId, setCurrentChatId] = useState(initialChatId);
  const [currentTitle, setCurrentTitle] = useState(
    initialChatId ? initialTitle || "Chat" : "New Chat"
  );
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");

  // --- State for Editing ---
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");

  // --- Effects ---

  // Initialize Gemini
  useEffect(() => {
    if (isApiKeyPlaceholder) {
      setError("Gemini API Key missing/invalid.");
      Alert.alert(
        "Configuration Error",
        "Developer: Please configure your Gemini API Key."
      );
      return;
    }
    try {
      const ai = new GoogleGenerativeAI(GEMINI_API_KEY);
      // Adjust safety settings as needed
      const model = ai.getGenerativeModel({
        model: GEMINI_MODEL_NAME,
        safetySettings: [
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
        ],
      });
      setGenAI(ai);
      setChatModel(model);
      console.log("ChatScreen: Gemini AI Initialized");
    } catch (err) {
      console.error("ChatScreen: Gemini Init Error:", err);
      setError("Failed to initialize AI. Please restart the app.");
      Alert.alert(
        "Initialization Error",
        "Could not connect to the AI service."
      );
    }
  }, []); // Run only once

  // Set Header Title dynamically
  useEffect(() => {
    navigation.setOptions({
      title: currentTitle,
      headerStyle: { backgroundColor: "#101010" },
      headerTintColor: "#FFFFFF",
      headerTitleStyle: { fontWeight: "600" },
      // Potentially add headerRight button for loading scans later
      // headerRight: () => ( <TouchableOpacity onPress={navigateToScanHistory}><Paperclip color="#FFF" size={24} style={{ marginRight: 15 }} /></TouchableOpacity> ),
    });
  }, [navigation, currentTitle]);

  // Load Initial Scan Data
  useEffect(() => {
    if (loadScanData && !currentChatId && !messages.length) {
      // Only if it's a NEW chat and we have data
      const formattedScanText = `Discussing Scan: ${
        loadScanData.scanId || "Unknown ID"
      }
**Disease:** ${loadScanData.bestLabel || "N/A"} (${(
        (loadScanData.bestConfidence || 0) * 100
      ).toFixed(1)}%)
${
  loadScanData.description ? `**Description:** ${loadScanData.description}` : ""
}
${loadScanData.imageUri ? `**(Image associated)**` : ""}

What would you like to ask about this specific plant scan?`;

      setInputText(formattedScanText); // Pre-fill input text
      // Optionally, auto-send this message? For now, let user press send.
      // sendMessage(formattedScanText); // Be cautious with auto-sending
    }
  }, [loadScanData, currentChatId, messages.length]); // Rerun if scan data changes

  // Get Messages Collection Reference (Memoized)
  const getMessagesCollectionRef = useCallback(
    (chatId) => {
      if (!user || !db || !chatId) return null;
      return collection(db, CHATS_COLLECTION, chatId, MESSAGES_SUBCOLLECTION);
    },
    [user]
  ); // Only user needed, db assumed stable

  // Fetch Messages for the current chat
  useEffect(() => {
    if (!currentChatId || !user || !db) {
      setIsLoading(false);
      setMessages([]);
      return;
    }
    console.log("ChatScreen: Subscribing to messages for chat:", currentChatId);
    setIsLoading(true);
    setError(null);
    const messagesCollectionRef = getMessagesCollectionRef(currentChatId);
    if (!messagesCollectionRef) {
      setError("Failed to get message collection reference.");
      setIsLoading(false);
      return;
    }

    // Query for messages that are NOT marked as deleted
    const messagesQuery = query(
      messagesCollectionRef,
      where("deleted", "==", false), // Filter out deleted messages
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const fetched = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
            // Convert Firestore Timestamps to JS Dates for easier handling if needed later
            timestamp: doc.data().timestamp?.toDate
              ? doc.data().timestamp.toDate()
              : null,
            editedAt: doc.data().editedAt?.toDate
              ? doc.data().editedAt.toDate()
              : null,
          }))
          // Basic validation - ensure role and parts exist
          .filter(
            (m) =>
              m.role &&
              m.parts &&
              m.parts.length > 0 &&
              m.parts[0].text !== undefined
          );

        setMessages(fetched);
        setIsLoading(false);
        // console.log("Messages updated:", fetched.length); // DEBUG
        scrollToBottom();
      },
      (err) => {
        console.error(
          `ChatScreen: Error fetching messages for ${currentChatId}:`,
          err
        );
        setError("Could not load messages. Please try again.");
        setIsLoading(false);
      }
    );

    // Cleanup function
    return () => {
      console.log(
        "ChatScreen: Unsubscribing messages for chat:",
        currentChatId
      );
      unsubscribe();
    };
  }, [currentChatId, user, getMessagesCollectionRef]); // Re-run if chat ID changes or user changes

  // --- Helper Functions ---
  const scrollToBottom = (animated = true) => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 100); // Short delay allows layout to settle
  };

  // --- Core Actions ---

  // Generate AI Response (factored out for reuse after edit)
  const generateAiResponse = async (chatId, messageHistory) => {
    if (!chatModel) {
      throw new Error("AI Model not initialized.");
    }
    if (messageHistory.length === 0) {
      console.warn(
        "generateAiResponse: Attempted to generate response with empty history."
      );
      return; // Or throw error?
    }

    const lastUserMessage =
      messageHistory[messageHistory.length - 1]?.parts[0]?.text;
    if (!lastUserMessage) {
      throw new Error("Could not get last user message for AI.");
    }

    console.log(
      `generateAiResponse: Sending history to AI (${messageHistory.length} messages)`
    );

    try {
      const chatSession = chatModel.startChat({
        history: messageHistory.map((m) => ({ role: m.role, parts: m.parts })), // Ensure correct format for API
        // safetySettings: [...] // Defined at model init
      });

      const result = await chatSession.sendMessage(lastUserMessage); // Send only the latest user message content

      if (result.response.promptFeedback?.blockReason) {
        const reason = result.response.promptFeedback.blockReason;
        console.warn("AI Response Blocked:", reason);
        throw new Error(
          `AI response blocked due to safety settings: ${reason}`
        );
      }

      const aiResponseText = result.response.text();
      if (!aiResponseText || typeof aiResponseText !== "string") {
        console.error("Invalid AI response structure:", result.response);
        throw new Error("Received invalid response format from AI.");
      }

      console.log("generateAiResponse: Gemini response received.");

      const aiMsgFirestore = {
        role: MODEL_ROLE,
        parts: [{ text: aiResponseText.trim() }],
        timestamp: serverTimestamp(),
        deleted: false, // Explicitly set deleted flag
      };

      const messagesCollectionRef = getMessagesCollectionRef(chatId);
      if (!messagesCollectionRef)
        throw new Error("Msg collection ref error during AI save.");

      await addDoc(messagesCollectionRef, aiMsgFirestore);
      console.log("generateAiResponse: AI message saved.");

      // Update chat's last updated timestamp
      const chatDocRef = doc(db, CHATS_COLLECTION, chatId);
      await updateDoc(chatDocRef, { updatedAt: serverTimestamp() });
    } catch (err) {
      console.error("generateAiResponse: Error interacting with Gemini:", err);
      // Propagate error to be handled by caller (sendMessage or handleSaveEdit)
      throw err;
    }
  };

  // Send a new message
  const sendMessage = async (textToSend = inputText) => {
    const userMessageText = textToSend.trim();
    if (!userMessageText || isSending || !chatModel || !user || !db) {
      console.log("sendMessage aborted:", {
        userMessageText,
        isSending,
        chatModel,
        user,
        db,
      });
      return;
    }

    setInputText(""); // Clear input immediately
    setIsSending(true);
    setError(null);
    Keyboard.dismiss();

    let chatId = currentChatId;
    let messagesCollectionRef;
    let isNewChat = !chatId;

    // Optimistic UI update (only for new messages, not edits)
    const optimisticMsg = {
      // No ID yet
      role: USER_ROLE,
      parts: [{ text: userMessageText }],
      timestamp: new Date(), // Use local time for optimistic
      deleted: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom();

    try {
      // 1. Create chat or update timestamp
      if (isNewChat) {
        const title =
          userMessageText.substring(0, MAX_CHAT_TITLE_LENGTH) +
          (userMessageText.length > MAX_CHAT_TITLE_LENGTH ? "..." : "");
        const newChatData = {
          userId: user.uid,
          title: title,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        const chatDocRef = await addDoc(
          collection(db, CHATS_COLLECTION),
          newChatData
        );
        chatId = chatDocRef.id;
        setCurrentChatId(chatId);
        setCurrentTitle(title); // Update state for header
        console.log("ChatScreen Send: New chat created:", chatId);
      } else {
        const chatDocRef = doc(db, CHATS_COLLECTION, chatId);
        await updateDoc(chatDocRef, { updatedAt: serverTimestamp() });
      }

      messagesCollectionRef = getMessagesCollectionRef(chatId);
      if (!messagesCollectionRef)
        throw new Error("Failed to get message collection reference.");

      // 2. Save User Message to Firestore
      const userMsgFirestore = {
        role: USER_ROLE,
        parts: [{ text: userMessageText }],
        timestamp: serverTimestamp(),
        deleted: false, // Ensure deleted flag is set
      };
      // Add the message and get its reference to update optimistic message later if needed
      const userMessageDocRef = await addDoc(
        messagesCollectionRef,
        userMsgFirestore
      );
      console.log("ChatScreen Send: User message saved:", userMessageDocRef.id);

      // Remove optimistic message now that Firestore listener will add the real one
      setMessages((prev) => prev.filter((m) => m !== optimisticMsg));

      // 3. Get History for AI (wait briefly for Firestore listener maybe? Or use current state?)
      // Using current state filtered *just before* calling AI seems safer.
      let historyForAPI = [];
      setMessages((currentMsgs) => {
        // Filter out any messages without a Firestore timestamp (e.g., potential remnants of failed optimistic updates)
        // and ensure they are not marked deleted.
        historyForAPI = currentMsgs
          .filter((m) => m.timestamp && !m.deleted)
          .map((m) => ({ role: m.role, parts: m.parts }));
        return currentMsgs; // Don't change state here, just extract history
      });

      // Ensure the message we just added is included for the API call
      if (
        !historyForAPI.find(
          (m) => m.parts[0].text === userMessageText && m.role === USER_ROLE
        )
      ) {
        // This can happen if the state update/firestore listener is slow
        // Manually add it to the history for the API call
        historyForAPI.push({
          role: USER_ROLE,
          parts: [{ text: userMessageText }],
        });
        console.log("Manually added current user message to history for API");
      }

      // 4. Generate and Save AI Response
      await generateAiResponse(chatId, historyForAPI);
    } catch (err) {
      console.error("ChatScreen Send Error:", err);
      setError(
        `Error: ${err.message || "Failed to send message or get AI response."}`
      );
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m !== optimisticMsg));
      // Consider adding the failed message back to input?
      // setInputText(userMessageText);
    } finally {
      setIsSending(false);
    }
  };

  // Start editing a message
  const handleLongPressMessage = (message) => {
    // Allow editing only own messages, not deleted, and not while sending/editing another
    if (
      message.role === USER_ROLE &&
      !message.deleted &&
      !isSending &&
      !editingMessageId
    ) {
      setEditingMessageId(message.id);
      setEditText(message.parts[0].text);
      setTimeout(() => editInputRef.current?.focus(), 100);
    } else if (message.role === MODEL_ROLE) {
      // Optional: Provide feedback or copy functionality for AI messages
      // console.log("Cannot edit AI messages.");
    }
  };

  // Cancel the edit mode
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditText("");
    Keyboard.dismiss();
  };

  // Save the edited message and handle regeneration
  const handleSaveEdit = async () => {
    if (
      !editingMessageId ||
      !editText.trim() ||
      isSending ||
      !currentChatId ||
      !db
    ) {
      handleCancelEdit(); // Exit if invalid state
      return;
    }

    const originalMessage = messages.find((m) => m.id === editingMessageId);
    if (!originalMessage || editText.trim() === originalMessage.parts[0].text) {
      handleCancelEdit(); // Exit if no change or message not found
      return;
    }

    const editedText = editText.trim();
    const originalTimestamp = originalMessage.timestamp; // Keep the original Firestore Timestamp for querying

    console.log("Saving edit for message:", editingMessageId);
    setIsSending(true); // Use isSending state to disable inputs
    setError(null);
    Keyboard.dismiss();

    try {
      const batch = writeBatch(db);

      // 1. Update the edited message
      const messageDocRef = doc(
        db,
        CHATS_COLLECTION,
        currentChatId,
        MESSAGES_SUBCOLLECTION,
        editingMessageId
      );
      batch.update(messageDocRef, {
        parts: [{ text: editedText }],
        editedAt: serverTimestamp(),
      });
      console.log("Edit queued in batch for:", editingMessageId);

      // 2. Mark subsequent messages as deleted
      const messagesCollectionRef = getMessagesCollectionRef(currentChatId);
      if (!messagesCollectionRef)
        throw new Error("Msg collection ref error during edit save.");

      if (!originalTimestamp) {
        console.error(
          "Original timestamp missing for message:",
          editingMessageId,
          originalMessage
        );
        throw new Error("Cannot determine order without original timestamp.");
      }

      const q = query(
        messagesCollectionRef,
        where("timestamp", ">", originalTimestamp) // Query messages STRICTLY AFTER the edited one
      );
      const subsequentMessagesSnapshot = await getDocs(q);

      let deletedCount = 0;
      subsequentMessagesSnapshot.forEach((docSnapshot) => {
        // Double check we aren't deleting the one being edited if timestamp is identical somehow
        if (docSnapshot.id !== editingMessageId) {
          batch.update(docSnapshot.ref, { deleted: true });
          deletedCount++;
        }
      });
      console.log(`Marking ${deletedCount} subsequent messages as deleted.`);

      // 3. Commit the batch
      await batch.commit();
      console.log("Batch commit successful (edit + deletions).");

      // 4. Prepare history UP TO the edited message (use local state, filtered)
      // The Firestore listener will update the `messages` state shortly to reflect deletions.
      // To avoid race conditions, construct history manually from local state filtered by the edit point.
      const editedMessageIndex = messages.findIndex(
        (m) => m.id === editingMessageId
      );
      if (editedMessageIndex === -1) {
        throw new Error(
          "Edited message not found in local state after update attempt."
        );
      }

      const historyForRegeneration = messages
        .slice(0, editedMessageIndex + 1) // Include messages up to and including the edited one
        .filter((m) => !m.deleted) // Ensure we don't include any already deleted ones
        .map((m, index) => ({
          // Construct the API history format
          role: m.role,
          parts:
            index === editedMessageIndex ? [{ text: editedText }] : m.parts, // Use NEW text for edited msg
        }));

      // 5. Trigger AI regeneration
      await generateAiResponse(currentChatId, historyForRegeneration);

      // 6. Exit edit mode on full success
      handleCancelEdit();
    } catch (err) {
      console.error("Error saving edit and regenerating:", err);
      setError(`Failed to save edit: ${err.message}`);
      // Do not cancel edit mode on error, allow user to retry or cancel manually
    } finally {
      setIsSending(false); // Re-enable input fields
    }
  };

  // --- UI Rendering ---

  // Render a single message bubble
  const renderMessageItem = ({ item }) => {
    // Item might not have an ID briefly during optimistic update
    const messageId = item.id || `optimistic-${item.timestamp?.toString()}`;
    const isUser = item.role === USER_ROLE;
    const textContent = item.parts?.[0]?.text ?? "[Error: No text content]";
    const isEditingThis = editingMessageId === messageId; // Check against ID

    // Don't render the bubble for the message currently being edited in the input area
    if (isEditingThis) return null;

    // Skip rendering if message has no text or role (data integrity issue)
    if (
      !item.role ||
      !item.parts ||
      item.parts.length === 0 ||
      !item.parts[0].text
    ) {
      console.warn("Skipping render for invalid message item:", item);
      return null;
    }

    return (
      <TouchableOpacity
        activeOpacity={isUser ? 0.7 : 1} // Only user messages respond visually to long press
        onLongPress={() => handleLongPressMessage(item)}
        delayLongPress={400}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.aiBubble,
            // Add margin if the next message is from the same role? (More complex)
          ]}
        >
          {isUser ? (
            <Text style={styles.messageText} selectable={true}>
              {textContent}
            </Text>
          ) : (
            // Use Markdown for AI responses
            <Markdown style={markdownStyles}>{textContent}</Markdown>
          )}
          {/* Show "(edited)" indicator */}
          {item.editedAt && (
            <Text
              style={
                isUser ? styles.editedIndicatorUser : styles.editedIndicatorAI
              }
            >
              edited
            </Text>
          )}
          {/* Indicate optimistic state (optional) */}
          {/* {!item.id && <ActivityIndicator size="small" color={isUser ? '#000' : '#FFF'} style={styles.optimisticIndicator} />} */}
        </View>
      </TouchableOpacity>
    );
  };

  // Show initial loading indicator
  if (isLoading && !messages.length) {
    return (
      <View style={styles.container}>
        <ActivityIndicator
          size="large"
          color="#BFFF00"
          style={styles.centeredMessageContainer}
        />
      </View>
    );
  }
  // Show loading indicator for missing essentials
  if (!user || (!genAI && !isApiKeyPlaceholder)) {
    // Show loader if user or AI isn't ready (unless API key is the issue)
    return (
      <View style={styles.container}>
        <ActivityIndicator
          size="large"
          color="#BFFF00"
          style={styles.centeredMessageContainer}
        />
      </View>
    );
  }

  // Main component return
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined} // Use undefined for Android, padding for iOS
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0} // Adjust offset as needed for iOS header
    >
      {/* Header handled by React Navigation */}

      {/* Wrapper for list and status */}
      <View style={styles.contentWrapper}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={(item) =>
            item.id || `msg-${item.timestamp?.toString()}-${Math.random()}`
          } // More robust key
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContainer}
          onContentSizeChange={() => scrollToBottom(false)} // Scroll down without animation on size change
          onLayout={() => scrollToBottom(false)} // Scroll down without animation on initial layout
          ListEmptyComponent={
            isLoading ? (
              <ActivityIndicator
                color="#BFFF00"
                style={styles.centeredMessageContainer}
              />
            ) : (
              <View style={styles.centeredMessageContainer}>
                <Text style={styles.emptyListText}>
                  {currentChatId
                    ? "No messages yet in this chat."
                    : "Send a message to start chatting with Dr. Plant AI!"}
                  {isApiKeyPlaceholder
                    ? "\n\n(Developer: AI is disabled due to missing API Key)"
                    : ""}
                </Text>
              </View>
            )
          }
          // Optimization props
          removeClippedSubviews={Platform.OS !== "ios"} // Can cause issues on iOS
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={21}
        />
        {/* Status Area: Only show persistent errors */}
        {error && (
          <View style={styles.statusContainer}>
            <Text style={styles.errorText} selectable={true}>
              {error}
            </Text>
          </View>
        )}
      </View>

      {/* Input Area: Conditional rendering for Edit vs Send */}
      {editingMessageId ? (
        // --- Edit Mode Input ---
        <View style={styles.editInputContainer}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleCancelEdit}
            disabled={isSending} // Disable while save/regeneration is in progress
          >
            <XCircle size={28} color={isSending ? "#888" : "#FF6B6B"} />
          </TouchableOpacity>
          <TextInput
            ref={editInputRef}
            style={styles.editInput}
            value={editText}
            onChangeText={setEditText}
            placeholder="Edit your message..."
            placeholderTextColor="#999"
            multiline
            autoFocus={false} // Usually focused via ref timeout, but ensure it's false otherwise
            editable={!isSending} // Disable editing during save/regeneration
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
              color={isSending || !editText.trim() ? "#5A6A00" : "#BFFF00"}
            />
          </TouchableOpacity>
        </View>
      ) : (
        // --- Normal Send Mode Input ---
        <View style={styles.inputContainer}>
          {/* Optional: Button to trigger scan loading */}
          {/* <TouchableOpacity style={styles.attachButton} onPress={navigateToScanHistory} disabled={isSending}>
            <Paperclip size={22} color={isSending ? "#555" : "#AEAEB2"} />
          </TouchableOpacity> */}
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask Dr. Plant AI..."
            placeholderTextColor="#8E8E93" // Subtle gray
            multiline
            editable={!isSending && !isApiKeyPlaceholder} // Disable if sending or no API key
            blurOnSubmit={false} // Prevent keyboard dismiss on newline/submit button press
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (isSending || !inputText.trim() || isApiKeyPlaceholder) &&
                styles.sendButtonDisabled,
            ]}
            onPress={() => sendMessage()}
            disabled={isSending || !inputText.trim() || isApiKeyPlaceholder}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <Send size={20} color="#000000" strokeWidth={2.5} />
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

// --- Styles --- (Refined UI)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  contentWrapper: { flex: 1 },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30, // More padding for empty/loading state
  },
  messagesList: { paddingHorizontal: 12 }, // Slightly more horizontal padding
  messagesContainer: {
    paddingTop: 15,
    paddingBottom: 10, // Base padding, input area adds more space
  },
  messageBubble: {
    maxWidth: "85%",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 18, // Slightly less rounded
    marginBottom: 10, // Slightly less margin
    minWidth: 50, // Ensure very short messages have some width
    position: "relative", // Needed for edited indicator absolute positioning
  },
  userBubble: {
    backgroundColor: "#BFFF00",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4, // Sharp corner
  },
  aiBubble: {
    backgroundColor: "#2C2C2E", // Darker gray, contrasts well
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4, // Sharp corner
  },
  messageText: {
    color: "#000000",
    fontSize: 16,
    lineHeight: 22, // Improved readability
  },
  statusContainer: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: "rgba(255, 0, 0, 0.1)", // Subtle background for error
  },
  errorText: {
    color: "#FF6B6B", // Bright red for error
    textAlign: "center",
    fontSize: 13, // Slightly smaller error text
  },
  inputContainer: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: "#282828",
    backgroundColor: "#101010", // Slightly darker than main background? Or same?
    alignItems: "flex-end", // Align items to bottom for multiline
  },
  // attachButton: { // Style for optional attach button
  //   padding: 10,
  //   marginRight: 5,
  //   marginBottom: 5, // Align with bottom of input field visually
  // },
  input: {
    flex: 1,
    minHeight: 44, // Standard height
    maxHeight: 130, // Allow more lines
    backgroundColor: "#2C2C2E",
    borderRadius: 22, // Fully rounded sides
    paddingHorizontal: 18, // More padding inside input
    paddingVertical: Platform.OS === "ios" ? 12 : 8, // Adjust padding for platform differences
    color: "#FFFFFF",
    fontSize: 16,
    marginRight: 10,
    lineHeight: 20, // Match text line height roughly
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22, // Match input
    backgroundColor: "#BFFF00",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Platform.OS === "ios" ? 0 : 0, // Adjust alignment if needed
  },
  sendButtonDisabled: {
    backgroundColor: "#5A6A00", // Darker green-yellow
    opacity: 0.7,
  },
  emptyListText: {
    color: "#AAAAAA",
    textAlign: "center",
    fontSize: 15, // Slightly smaller
    lineHeight: 21,
  },
  editedIndicatorBase: {
    fontSize: 11,
    color: "#888", // Default subtle color
    position: "absolute",
    bottom: 3,
    opacity: 0.8,
  },
  editedIndicatorUser: {
    color: "#333", // Darker on light background
    right: 10, // Position for user bubble
    position: "absolute",
    bottom: 3,
    fontSize: 11,
    opacity: 0.8,
  },
  editedIndicatorAI: {
    color: "#999", // Lighter on dark background
    left: 10, // Position for AI bubble
    position: "absolute",
    bottom: 3,
    fontSize: 11,
    opacity: 0.8,
  },
  // --- Edit Input Styles ---
  editInputContainer: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: "#282828",
    backgroundColor: "#181818", // Slightly different background for edit mode
    alignItems: "center", // Center items vertically for edit mode
  },
  editInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 130,
    backgroundColor: "#3A3A3C", // Slightly lighter than regular input bg
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 20,
  },
  editButton: {
    paddingHorizontal: 12, // More space around edit icons
    paddingVertical: 8,
  },
  // optimisticIndicator: { // Optional style for pending message indicator
  //    position: 'absolute',
  //    right: 5,
  //    top: 5,
  // },
});

// --- Markdown Styles --- (Refined for Chat UI)
const markdownStyles = StyleSheet.create({
  body: { color: "#E5E5EA", fontSize: 16, lineHeight: 23 },
  heading1: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 22,
    marginTop: 15,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderColor: "#4F4F4F",
    paddingBottom: 5,
  },
  heading2: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 19,
    marginTop: 12,
    marginBottom: 6,
  },
  heading3: {
    color: "#E0E0E0",
    fontWeight: "600",
    fontSize: 17,
    marginTop: 10,
    marginBottom: 4,
  },
  strong: { fontWeight: "bold", color: "#FFFFFF" },
  em: { fontStyle: "italic", color: "#C7C7CC" }, // Lighter italic
  link: { color: "#90CAF9", textDecorationLine: "underline" }, // Material Design light blue
  bullet_list: { marginVertical: 8, marginLeft: 5 },
  ordered_list: { marginVertical: 8, marginLeft: 5 },
  list_item: {
    marginVertical: 5,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bullet_list_icon: {
    marginRight: 10,
    color: "#BFFF00",
    marginTop: 7,
    fontSize: 7, // Small dot style bullet
    height: 7,
    width: 7,
    borderRadius: 4,
    backgroundColor: "#BFFF00",
  },
  ordered_list_icon: {
    marginRight: 10,
    color: "#BFFF00",
    marginTop: 5,
    fontSize: 16,
    fontWeight: "bold", // Use bold numbers
  },
  code_inline: {
    backgroundColor: "#1C1C1E", // Match bubble color
    color: "#FFD600", // Yellow for code
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 15,
  },
  code_block: {
    // Use 'fence' for consistency if library prefers it
    backgroundColor: "#1A1A1A",
    color: "#E5E5EA",
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 14.5,
  },
  fence: {
    // Explicit fence style
    backgroundColor: "#1A1A1A",
    color: "#E5E5EA",
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 14.5,
  },
  blockquote: {
    backgroundColor: "rgba(191, 255, 0, 0.08)", // Very subtle yellow-green background
    borderLeftColor: "#BFFF00",
    borderLeftWidth: 4,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 8,
    marginVertical: 10,
    marginLeft: 2,
    marginRight: 5,
  },
  hr: { backgroundColor: "#4F4F4F", height: 1, marginVertical: 15 },
  table: {
    borderWidth: 1,
    borderColor: "#4F4F4F",
    borderRadius: 4,
    marginVertical: 12,
    overflow: "hidden",
  }, // Added overflow hidden
  th: {
    backgroundColor: "#3A3A3C",
    padding: 10,
    color: "#FFF",
    fontWeight: "bold",
    textAlign: "left",
    flex: 1,
  },
  tr: { borderBottomWidth: 1, borderColor: "#4F4F4F", flexDirection: "row" },
  td: {
    padding: 10,
    textAlign: "left",
    color: "#E5E5EA",
    flex: 1,
    borderWidth: 0.5,
    borderColor: "#4F4F4F",
  }, // Added thin cell borders
});

export default ChatScreen;
