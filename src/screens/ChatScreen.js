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
} from "react-native";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { useAuth } from "../context/AuthContext";
import { db, firebase } from "../firebase/firebaseInit"; // Import both db and firebase
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import Markdown from "react-native-markdown-display";
// Import necessary icons
import { Send, XCircle, CheckCircle } from "lucide-react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

// --- Configuration ---
const GEMINI_API_KEY = "AIzaSyDEhRYRo_ajQdvHlEdm44vu_MSPSX5T5Vw"; // TODO: Secure this API Key!
const GEMINI_MODEL_NAME = "gemini-1.5-flash";

// --- Constants ---
const USER_ROLE = "user";
const MODEL_ROLE = "model";
const MAX_CHAT_TITLE_LENGTH = 35;
const CHATS_COLLECTION = "ai_chats";
const MESSAGES_SUBCOLLECTION = "messages";

const ChatScreen = () => {
  // --- Hooks ---
  const { user } = useAuth();
  const route = useRoute();
  const navigation = useNavigation();
  const flatListRef = useRef(null);
  const editInputRef = useRef(null);

  // --- Route Params ---
  const { chatId: initialChatId, initialTitle } = route.params || {};

  // --- State ---
  const [genAI, setGenAI] = useState(null);
  const [chatModel, setChatModel] = useState(null);
  const [isLoading, setIsLoading] = useState(!!initialChatId); // True if loading messages for existing chat
  const [isSending, setIsSending] = useState(false); // True when sending msg or saving edit
  const [error, setError] = useState(null);
  const [currentChatId, setCurrentChatId] = useState(initialChatId);
  const [currentTitle, setCurrentTitle] = useState(initialTitle || "New Chat");
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");

  // --- State for Editing ---
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");

  // --- Effects ---

  // Initialize Gemini
  useEffect(() => {
    if (
      !GEMINI_API_KEY ||
      GEMINI_API_KEY.includes("YOUR") ||
      GEMINI_API_KEY.length < 10
    ) {
      setError("Gemini API Key missing/invalid.");
      Alert.alert("Config Error", "Invalid Gemini API Key.");
      return;
    }
    try {
      const ai = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = ai.getGenerativeModel({ model: GEMINI_MODEL_NAME });
      setGenAI(ai);
      setChatModel(model);
      console.log("ChatScreen: Gemini AI Initialized");
    } catch (err) {
      console.error("ChatScreen: Gemini Init Error:", err);
      setError("Failed to init AI.");
    }
  }, []);

  // Set Header Title dynamically
  useEffect(() => {
    navigation.setOptions({
      title: currentTitle, // Use state which updates for new chats
      headerStyle: { backgroundColor: "#101010" },
      headerTintColor: "#FFFFFF",
      headerTitleStyle: { fontWeight: "600" },
    });
  }, [navigation, currentTitle]); // Depend on currentTitle

  // Get Messages Collection Reference (Memoized)
  const getMessagesCollectionRef = useCallback(
    (chatId) => {
      if (!user || !db || !chatId) return null;
      return collection(db, CHATS_COLLECTION, chatId, MESSAGES_SUBCOLLECTION);
    },
    [user]
  ); // Depends only on user

  // Fetch Messages for the current chat
  useEffect(() => {
    if (!currentChatId || !user || !db) {
      setIsLoading(false); // Ensure loading stops if we can't fetch
      setMessages([]);
      return;
    }
    console.log("ChatScreen: Subscribing to messages for:", currentChatId);
    setIsLoading(true);
    setError(null);
    const messagesCollectionRef = getMessagesCollectionRef(currentChatId);
    if (!messagesCollectionRef) {
      setError("Failed msg collection ref.");
      setIsLoading(false);
      return;
    }
    const messagesQuery = query(
      messagesCollectionRef,
      orderBy("timestamp", "asc")
    );
    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const fetched = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((m) => m.role && m.parts);
        setMessages(fetched);
        setIsLoading(false);
        scrollToBottom();
      },
      (err) => {
        console.error(
          `ChatScreen: Error fetching messages ${currentChatId}:`,
          err
        );
        setError("Could not load messages.");
        setIsLoading(false);
      }
    );
    return () => {
      console.log("ChatScreen: Unsubscribing msgs:", currentChatId);
      unsubscribe();
    };
  }, [currentChatId, user, db, getMessagesCollectionRef]); // Add db dependency

  // --- Actions ---

  // Send a new message
  const sendMessage = async () => {
    if (!inputText.trim() || isSending || !chatModel || !user || !db) return;
    const userMessageText = inputText.trim();
    setInputText("");
    setIsSending(true);
    setError(null);
    const optimisticMsg = {
      role: USER_ROLE,
      parts: [{ text: userMessageText }],
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom();
    let chatId = currentChatId;
    let chatDocRef;
    let messagesCollectionRef;
    let isNewChat = !chatId;
    try {
      if (isNewChat) {
        const title =
          userMessageText.substring(0, MAX_CHAT_TITLE_LENGTH) +
          (userMessageText.length > MAX_CHAT_TITLE_LENGTH ? "..." : "");
        const newChatData = {
          userId: user.uid,
          title,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        chatDocRef = await addDoc(
          collection(db, CHATS_COLLECTION),
          newChatData
        );
        chatId = chatDocRef.id;
        setCurrentChatId(chatId);
        setCurrentTitle(title); // Update state
        console.log("ChatScreen Send: New chat:", chatId);
      } else {
        chatDocRef = doc(db, CHATS_COLLECTION, chatId);
        await updateDoc(chatDocRef, { updatedAt: serverTimestamp() });
      }
      messagesCollectionRef = getMessagesCollectionRef(chatId);
      if (!messagesCollectionRef) throw new Error("Msg collection ref error.");
      const userMsgFirestore = {
        role: USER_ROLE,
        parts: [{ text: userMessageText }],
        timestamp: serverTimestamp(),
      };
      await addDoc(messagesCollectionRef, userMsgFirestore);
      console.log("User msg saved.");
      let historyForAPI = [];
      setMessages((currentMsgs) => {
        historyForAPI = currentMsgs
          .filter((m) => m.id)
          .map((m) => ({ role: m.role, parts: m.parts }));
        return currentMsgs;
      });
      const chatSession = chatModel.startChat({
        history: historyForAPI,
        safetySettings: [
          /* Add your safety settings here */
        ],
      });
      const result = await chatSession.sendMessage(userMessageText);
      if (result.response.promptFeedback?.blockReason) {
        throw new Error(
          `Blocked: ${result.response.promptFeedback.blockReason}`
        );
      }
      const aiResponseText = result.response.text();
      console.log("Gemini response received.");
      const aiMsgFirestore = {
        role: MODEL_ROLE,
        parts: [{ text: aiResponseText }],
        timestamp: serverTimestamp(),
      };
      await addDoc(messagesCollectionRef, aiMsgFirestore);
      console.log("AI msg saved.");
      if (chatDocRef) {
        await updateDoc(chatDocRef, { updatedAt: serverTimestamp() });
      }
    } catch (err) {
      console.error("ChatScreen Send Error:", err);
      setMessages((prev) => prev.filter((m) => m !== optimisticMsg));
      setError(err.message || "Send failed.");
    } finally {
      setIsSending(false);
    }
  };

  // Start editing a message
  const handleLongPressMessage = (message) => {
    if (message.role === USER_ROLE && !isSending && !editingMessageId) {
      setEditingMessageId(message.id);
      setEditText(message.parts[0].text);
      setTimeout(() => editInputRef.current?.focus(), 100); // Focus input after state updates
    }
  };

  // Cancel the edit mode
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditText("");
  };

  // Save the edited message
  const handleSaveEdit = async () => {
    if (!editingMessageId || !editText.trim() || isSending || !currentChatId)
      return;
    const originalMessage = messages.find((m) => m.id === editingMessageId);
    if (!originalMessage || editText.trim() === originalMessage.parts[0].text) {
      handleCancelEdit();
      return;
    } // Exit if no change or message not found

    console.log("Saving edit for message:", editingMessageId);
    setIsSending(true);
    setError(null);
    const messageDocRef = doc(
      db,
      CHATS_COLLECTION,
      currentChatId,
      MESSAGES_SUBCOLLECTION,
      editingMessageId
    );
    try {
      await updateDoc(messageDocRef, {
        parts: [{ text: editText.trim() }],
        editedAt: serverTimestamp(),
      });
      console.log("Edit saved successfully");
      handleCancelEdit(); // Close edit mode on success
    } catch (err) {
      console.error("Error saving edit:", err);
      setError("Failed to save edit. Check permissions.");
      // Decide if you want to keep the user in edit mode on error
    } finally {
      setIsSending(false);
    }
  };

  // --- UI Rendering ---

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  // Render a single message bubble
  const renderMessageItem = ({ item }) => {
    const isUser = item.role === USER_ROLE;
    const textContent = item.parts?.[0]?.text ?? "[empty]";
    const isEditingThis = editingMessageId === item.id;

    if (isEditingThis) return null; // Don't render bubble if it's being edited

    return (
      <TouchableOpacity
        activeOpacity={isUser ? 0.7 : 1}
        onLongPress={() => isUser && handleLongPressMessage(item)}
        delayLongPress={400}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.aiBubble,
          ]}
        >
          {isUser ? (
            <Text style={styles.messageText} selectable={true}>
              {textContent}
            </Text>
          ) : (
            <Markdown style={markdownStyles}>{textContent}</Markdown>
          )}
          {item.editedAt && (
            <Text
              style={
                isUser ? styles.editedIndicatorUser : styles.editedIndicatorAI
              }
            >
              (edited)
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Show loading indicator if Gemini or user isn't ready
  if (!user || !genAI) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#BFFF00" style={{ flex: 1 }} />
      </View>
    );
  }

  // Main component return
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      // No vertical offset needed now
    >
      {/* Header handled by React Navigation */}

      {/* Wrapper for list and status */}
      <View style={styles.contentWrapper}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={(item) => item.id || `msg-${Math.random()}`} // Fallback key
          style={styles.messagesList}
          contentContainerStyle={{
            ...styles.messagesContainer,
            paddingBottom: editingMessageId ? 10 : 70,
          }} // Dynamic padding
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
          ListEmptyComponent={
            isLoading ? (
              <ActivityIndicator color="#BFFF00" style={{ marginTop: 50 }} />
            ) : (
              <View style={styles.centeredMessageContainer}>
                <Text style={styles.emptyListText}>
                  {currentChatId
                    ? "No messages yet."
                    : "Send a message to start chatting!"}
                </Text>
              </View>
            )
          }
        />
        {/* Status Area: Keep minimal, only show errors */}
        {error && (
          <View style={styles.statusContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>

      {/* Input Area: Conditional rendering for Edit vs Send */}
      {editingMessageId ? (
        <View style={styles.editInputContainer}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleCancelEdit}
            disabled={isSending}
          >
            <XCircle size={28} color="#FF6B6B" />
          </TouchableOpacity>
          <TextInput
            ref={editInputRef}
            style={styles.editInput}
            value={editText}
            onChangeText={setEditText}
            placeholder="Edit message..."
            placeholderTextColor="#999"
            multiline
            autoFocus={true}
          />
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleSaveEdit}
            disabled={isSending || !editText.trim()}
          >
            <CheckCircle size={28} color="#BFFF00" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask Dr. Plant AI..."
            placeholderTextColor="#888888"
            multiline
            editable={!isSending}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (isSending || !inputText.trim()) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={isSending || !inputText.trim()}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <Send size={20} color="#000000" />
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  contentWrapper: { flex: 1 }, // Holds list and status
  centeredMessageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  messagesList: { paddingHorizontal: 10 },
  messagesContainer: { paddingTop: 15 }, // Removed bottom padding, handled dynamically
  messageBubble: {
    maxWidth: "85%",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 12,
    position: "relative",
  },
  userBubble: {
    backgroundColor: "#BFFF00",
    alignSelf: "flex-end",
    borderBottomRightRadius: 6,
  },
  aiBubble: {
    backgroundColor: "#2A2A2A",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 6,
  },
  messageText: { color: "#000000", fontSize: 15.5, lineHeight: 21 }, // Slightly larger text
  statusContainer: { paddingVertical: 5, paddingHorizontal: 15 },
  errorText: { color: "#FF6B6B", textAlign: "center", fontSize: 14 },
  inputContainer: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#282828",
    backgroundColor: "#111111",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: "#2C2C2E",
    borderRadius: 21,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 16,
    marginRight: 10,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#BFFF00",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: { backgroundColor: "#5A6A00" },
  emptyListText: { color: "#AAAAAA", textAlign: "center", fontSize: 16 },
  editedIndicatorBase: { fontSize: 10, position: "absolute", bottom: -2 }, // Base style for "(edited)"
  editedIndicatorUser: { color: "#555", right: 8 }, // Position for user
  editedIndicatorAI: { color: "#777", left: 8 }, // Position for AI
  // --- Edit Input Styles ---
  editInputContainer: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#282828",
    backgroundColor: "#111111",
    alignItems: "center",
  },
  editInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: "#3A3A3C",
    borderRadius: 21,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 15.5,
  },
  editButton: { paddingHorizontal: 10, paddingVertical: 5 }, // Add padding around edit buttons
});

// --- Markdown Styles ---
const markdownStyles = StyleSheet.create({
  body: { color: "#E0E0E0", fontSize: 15.5, lineHeight: 22 }, // Match text size, increase line height
  heading1: {
    color: "#FFFFFF",
    fontWeight: "bold",
    marginVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#444",
    paddingBottom: 6,
  },
  heading2: { color: "#FFFFFF", fontWeight: "bold", marginVertical: 10 },
  strong: { fontWeight: "bold", color: "#FFFFFF" },
  em: { fontStyle: "italic" },
  link: { color: "#87CEFA", textDecorationLine: "underline" }, // Lighter blue
  bullet_list: { marginVertical: 10 },
  ordered_list: { marginVertical: 10 },
  list_item: {
    marginVertical: 6,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bullet_list_icon: {
    marginRight: 10,
    color: "#BFFF00",
    marginTop: 6,
    fontSize: 16,
  }, // Larger bullet
  ordered_list_icon: {
    marginRight: 10,
    color: "#BFFF00",
    marginTop: 6,
    fontSize: 15.5,
  }, // Match text size
  code_inline: {
    backgroundColor: "#444",
    color: "#FFD700",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 14.5,
  },
  code_block: {
    backgroundColor: "#1A1A1A",
    color: "#E0E0E0",
    padding: 14,
    borderRadius: 6,
    marginVertical: 12,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 14.5,
  },
  fence: {
    backgroundColor: "#1A1A1A",
    color: "#E0E0E0",
    padding: 14,
    borderRadius: 6,
    marginVertical: 12,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 14.5,
  },
  table: {
    borderWidth: 1,
    borderColor: "#555",
    borderRadius: 4,
    marginVertical: 12,
  },
  th: {
    backgroundColor: "#333",
    padding: 10,
    color: "#FFF",
    fontWeight: "bold",
    textAlign: "left",
  },
  tr: { borderBottomWidth: 1, borderColor: "#444", flexDirection: "row" },
  td: { padding: 10, textAlign: "left", flex: 1 },
  blockquote: {
    backgroundColor: "#222",
    borderLeftColor: "#BFFF00",
    borderLeftWidth: 5,
    padding: 12,
    marginVertical: 12,
    marginLeft: 5,
    marginRight: 10,
  },
  hr: { backgroundColor: "#555", height: 1.5, marginVertical: 18 },
});

export default ChatScreen;
