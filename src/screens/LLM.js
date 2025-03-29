// src/screens/LLM.js
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
  // Import deleteDoc separately if needed (if using modular v9+ syntax elsewhere, but compat seems fine here)
  // import { deleteDoc } from "firebase/firestore";
} from "react-native";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { useAuth } from "../context/AuthContext";
import { db } from "../../App"; // Import the exported db instance
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  // getDoc, // Not currently used
  // setDoc, // Not currently used
  serverTimestamp,
  updateDoc,
  // limit, // Not currently used
  // getDocs, // Not currently used
  where,
  deleteDoc, // Ensure deleteDoc is imported correctly for compat
} from "firebase/firestore";
import Markdown from "react-native-markdown-display";
import {
  Send,
  ArrowLeft,
  MessageSquarePlus,
  Trash2,
} from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";

// --- Configuration ---
const GEMINI_API_KEY = "AIzaSyDEhRYRo_ajQdvHlEdm44vu_MSPSX5T5Vw";
const GEMINI_MODEL_NAME = "gemini-1.5-flash";

// --- Constants ---
const USER_ROLE = "user";
const MODEL_ROLE = "model";
const MAX_CHAT_TITLE_LENGTH = 35;
const CHATS_COLLECTION = "ai_chats";
const MESSAGES_SUBCOLLECTION = "messages";

const LLM = ({ navigation }) => {
  const { user } = useAuth();
  const [genAI, setGenAI] = useState(null);
  const [chatModel, setChatModel] = useState(null);

  const [viewMode, setViewMode] = useState("list");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null); // Ensure error is always string or null

  const [chats, setChats] = useState([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);

  const [currentChatId, setCurrentChatId] = useState(null);
  const [currentChatTitle, setCurrentChatTitle] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const flatListRef = useRef(null);

  // --- Initialization ---
  useEffect(() => {
    if (
      GEMINI_API_KEY === "YOUR_GEMINI_API_KEY" ||
      GEMINI_API_KEY.includes("Replace")
    ) {
      setError("Gemini API Key not configured.");
      Alert.alert(
        "Configuration Error",
        "Gemini API Key is missing or invalid in LLM.js"
      );
      return;
    }
    try {
      const ai = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = ai.getGenerativeModel({ model: GEMINI_MODEL_NAME });
      setGenAI(ai);
      setChatModel(model);
      console.log("Gemini AI Initialized");
    } catch (err) {
      console.error("Gemini Initialization Error:", err);
      setError("Failed to initialize AI service.");
    }
  }, []);

  // --- Firestore References ---
  const getUserChatsCollectionRef = useCallback(() => {
    if (!user || !db) return null;
    return query(
      collection(db, CHATS_COLLECTION),
      where("userId", "==", user.uid),
      orderBy("updatedAt", "desc")
    );
  }, [user]);

  const getMessagesCollectionRef = useCallback(
    (chatId) => {
      if (!user || !db || !chatId) return null;
      return collection(db, CHATS_COLLECTION, chatId, MESSAGES_SUBCOLLECTION);
    },
    [user]
  );

  // --- Fetch Chat List ---
  useFocusEffect(
    useCallback(() => {
      // Reset state on focus if needed, e.g., clear previous errors
      // setError(null);
      // setIsLoadingChats(true); // Set loading true at the start

      if (!user || !db || !genAI) {
        console.log(
          "useFocusEffect: Skipping chat list fetch (missing user, db, or genAI)"
        );
        // Only set loading false if we actually skip, otherwise let snapshot handle it
        if (!isLoadingChats) setIsLoadingChats(false);
        return;
      }

      console.log(
        "useFocusEffect: Attaching chat list listener for user:",
        user.uid
      );
      setIsLoadingChats(true); // Ensure loading is true before listener attach
      setError(null); // Clear previous errors

      const chatsCollectionRef = getUserChatsCollectionRef();
      if (!chatsCollectionRef) {
        console.error("useFocusEffect: Cannot get chats collection ref (null)");
        setError("Failed to prepare chat query.");
        setIsLoadingChats(false);
        return;
      }

      console.log(
        "useFocusEffect: Attempting to attach onSnapshot listener..."
      );
      const unsubscribe = onSnapshot(
        chatsCollectionRef,
        (querySnapshot) => {
          console.log(
            "useFocusEffect: Chat list snapshot received, docs:",
            querySnapshot.size
          );
          const fetchedChats = [];
          querySnapshot.forEach((doc) => {
            fetchedChats.push({ id: doc.id, ...doc.data() });
          });
          // Ensure sorting is correct
          fetchedChats.sort(
            (a, b) =>
              (b.updatedAt?.toDate()?.getTime() || 0) -
              (a.updatedAt?.toDate()?.getTime() || 0)
          );
          setChats(fetchedChats);
          console.log("useFocusEffect: Chat list state updated.");
          setIsLoadingChats(false); // Set loading false on successful data fetch
        },
        (err) => {
          console.error("useFocusEffect: Error in chat list onSnapshot:", err);
          console.error("useFocusEffect: Error code:", err.code);
          let detailedError = "Could not load chats. ";
          if (err.code === "permission-denied") {
            detailedError += "Check Firestore rules.";
          } else if (err.code === "failed-precondition") {
            detailedError += "Check Firestore index requirements.";
          } else {
            detailedError += `(${err.code || "Unknown Error"})`;
          }
          setError(detailedError);
          setIsLoadingChats(false); // Set loading false on error
        }
      );
      console.log("useFocusEffect: Chat list listener attached.");

      // Cleanup function
      return () => {
        console.log("useFocusEffect: Unsubscribing from chat list listener");
        unsubscribe();
      };
    }, [user, genAI, db, getUserChatsCollectionRef]) // Added db dependency
  );

  // --- Fetch Messages for Active Chat ---
  useEffect(() => {
    if (viewMode !== "chat" || !currentChatId || !db || !user) {
      if (viewMode === "chat" && !currentChatId) {
        // Special case: New chat mode, ensure loading is false
        setIsLoading(false);
      }
      setMessages([]);
      return;
    }

    console.log("Effect: Fetching messages for chat:", currentChatId);
    setIsLoading(true);
    setError(null); // Clear previous message errors
    const messagesCollectionRef = getMessagesCollectionRef(currentChatId);

    if (!messagesCollectionRef) {
      console.error(
        "Effect: Cannot get messages collection ref (null) for chat:",
        currentChatId
      );
      setError("Failed to prepare message query.");
      setIsLoading(false);
      return;
    }

    const messagesQuery = query(
      messagesCollectionRef,
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (querySnapshot) => {
        console.log(
          "Effect: Messages snapshot received, docs:",
          querySnapshot.size
        );
        const fetchedMessages = [];
        querySnapshot.forEach((doc) => {
          // Basic validation of message structure
          const data = doc.data();
          if (data && data.role && data.parts) {
            fetchedMessages.push({ id: doc.id, ...data });
          } else {
            console.warn("Skipping malformed message:", doc.id, data);
          }
        });
        setMessages(fetchedMessages);
        console.log("Effect: Messages state updated.");
        setIsLoading(false); // Set loading false on successful fetch
        scrollToBottom();
      },
      (err) => {
        console.error(
          `Effect: Error fetching messages for chat ${currentChatId}:`,
          err
        );
        setError("Could not load messages for this chat.");
        setIsLoading(false); // Set loading false on error
      }
    );

    return () => {
      console.log(
        "Effect: Unsubscribing from messages listener for chat:",
        currentChatId
      );
      unsubscribe();
    };
  }, [viewMode, currentChatId, user, db, getMessagesCollectionRef]); // Added db dependency

  // --- Actions ---

  const handleNewChat = () => {
    setCurrentChatId(null);
    setCurrentChatTitle("New Chat");
    setMessages([]);
    setInputText("");
    setError(null);
    setIsLoading(false); // Ensure loading is off for new chat screen
    setViewMode("chat");
  };

  const handleSelectChat = (chat) => {
    // Removed async as it wasn't needed
    console.log("Action: Selecting chat:", chat.id, chat.title);
    // Reset states before setting new ones
    setMessages([]);
    setError(null);
    setIsLoading(true); // Set loading true while message effect runs
    setCurrentChatId(chat.id);
    setCurrentChatTitle(chat.title || "Chat");
    setInputText("");
    setViewMode("chat");
  };

  const handleDeleteChat = (chatIdToDelete) => {
    // Removed async as it wasn't needed here
    if (!chatIdToDelete || !db || !user) return;

    Alert.alert(
      "Delete Chat",
      "Are you sure you want to permanently delete this chat history? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            // Make only the onPress async
            console.log("Action: Attempting to delete chat:", chatIdToDelete);
            // Consider adding visual feedback e.g., temporarily grey out item
            // setIsLoadingChats(true); // This might feel slow, alternative below

            try {
              const chatDocRef = doc(db, CHATS_COLLECTION, chatIdToDelete);
              await deleteDoc(chatDocRef);
              console.log(
                "Action: Chat metadata deleted from Firestore:",
                chatIdToDelete
              );

              // Optimistically remove from UI immediately
              setChats((prevChats) =>
                prevChats.filter((chat) => chat.id !== chatIdToDelete)
              );

              // If the currently viewed chat is deleted, go back to list
              if (currentChatId === chatIdToDelete) {
                setViewMode("list");
                setCurrentChatId(null);
                setCurrentChatTitle("");
                setMessages([]);
              }
              // setIsLoadingChats(false); // No longer needed if removing optimistically
            } catch (err) {
              console.error("Action: Error deleting chat:", err);
              Alert.alert(
                "Error",
                "Could not delete the chat. Please try again."
              );
              // setIsLoadingChats(false); // Ensure loading stops on error if you used it
            }
          },
        },
      ]
    );
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isSending || !chatModel || !user || !db) {
      console.log("Send message aborted. Conditions:", {
        inputText: !inputText.trim(),
        isSending,
        chatModel: !!chatModel,
        user: !!user,
        db: !!db,
      });
      return;
    }

    const userMessageText = inputText.trim();
    setInputText(""); // Clear input immediately
    setIsSending(true);
    setError(null); // Clear previous errors

    // Optimistic UI update
    const optimisticUserMessage = {
      // No firestore ID yet
      role: USER_ROLE,
      parts: [{ text: userMessageText }],
      timestamp: new Date(), // Use JS Date for optimistic UI
    };
    // Use a functional update to ensure we have the latest messages state
    setMessages((prevMessages) => [...prevMessages, optimisticUserMessage]);
    scrollToBottom();

    let chatId = currentChatId;
    let isNewChat = !chatId;
    let chatDocRef;
    let messagesCollectionRef;

    try {
      // --- 1. Ensure Chat Document Exists/Create ---
      if (isNewChat) {
        console.log("Send: Creating new chat document");
        const title =
          userMessageText.substring(0, MAX_CHAT_TITLE_LENGTH) +
          (userMessageText.length > MAX_CHAT_TITLE_LENGTH ? "..." : "");
        const newChatData = {
          userId: user.uid,
          title: title,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        // Add doc and get its reference
        chatDocRef = await addDoc(
          collection(db, CHATS_COLLECTION),
          newChatData
        );
        chatId = chatDocRef.id; // Get the new ID
        // Update state *after* successful creation
        setCurrentChatId(chatId);
        setCurrentChatTitle(title);
        console.log("Send: New chat created with ID:", chatId);
      } else {
        console.log("Send: Updating existing chat document timestamp:", chatId);
        chatDocRef = doc(db, CHATS_COLLECTION, chatId);
        // Update timestamp first (or maybe last?)
        await updateDoc(chatDocRef, { updatedAt: serverTimestamp() });
      }

      // --- 2. Get Messages Collection Reference ---
      messagesCollectionRef = getMessagesCollectionRef(chatId);
      if (!messagesCollectionRef) {
        // This case should ideally not happen if chat creation/finding succeeded
        throw new Error(
          "Send Error: Could not get messages collection reference."
        );
      }

      // --- 3. Save User Message to Firestore ---
      const userMessageForFirestore = {
        role: USER_ROLE,
        parts: [{ text: userMessageText }],
        timestamp: serverTimestamp(), // Use server time for storage
      };
      const userMessageRef = await addDoc(
        messagesCollectionRef,
        userMessageForFirestore
      );
      console.log("Send: User message saved to Firestore:", userMessageRef.id);
      // Note: Optimistic message is already in UI. Firestore listener will eventually
      // update it with the server timestamp and potentially re-order if needed.

      // --- 4. Prepare History for Gemini ---
      // Get the *current* messages state just before sending, exclude optimistic one
      const historyForAPI = messages
        .filter((msg) => msg.id) // Filter out messages without a Firestore ID (the optimistic one)
        .map((msg) => ({
          role: msg.role,
          parts: msg.parts,
        }));
      // If it's a brand new chat, history is empty
      console.log(
        "Send: Sending to Gemini with history count:",
        historyForAPI.length
      );

      // --- 5. Call Gemini API ---
      const chatSession = chatModel.startChat({
        history: historyForAPI, // Send confirmed history
        generationConfig: {
          /* Optional */
        },
        safetySettings: [
          /* Your settings */
        ],
      });

      const result = await chatSession.sendMessage(userMessageText);

      // --- 6. Process Gemini Response ---
      // Check for blocked content *before* accessing text()
      if (result.response.promptFeedback?.blockReason) {
        const blockReason = result.response.promptFeedback.blockReason;
        console.warn(`Send: Gemini response blocked: ${blockReason}`);
        throw new Error(
          `Message blocked due to safety settings: ${blockReason}`
        ); // Throw specific error
      }

      const aiResponseText = result.response.text();
      console.log("Send: Gemini Response received.");

      // --- 7. Save AI Response to Firestore ---
      const aiMessageForFirestore = {
        role: MODEL_ROLE,
        parts: [{ text: aiResponseText }],
        timestamp: serverTimestamp(),
      };
      const aiMessageRef = await addDoc(
        messagesCollectionRef,
        aiMessageForFirestore
      );
      console.log("Send: AI message saved to Firestore:", aiMessageRef.id);
      // UI will update via the onSnapshot listener for messages

      // --- 8. Update Chat Timestamp Again (Optional but ensures latest) ---
      if (chatDocRef) {
        // Ensure chatDocRef is valid
        await updateDoc(chatDocRef, { updatedAt: serverTimestamp() });
      }
    } catch (err) {
      console.error("Send: Error during message send process:", err);

      // Remove optimistic message on failure
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg !== optimisticUserMessage)
      );

      let userFriendlyError = "An error occurred while sending your message.";
      // More specific error checking
      if (err.message?.includes("API key not valid")) {
        userFriendlyError = "AI Service Error: Invalid API Key.";
      } else if (
        err.message?.includes("Could not get messages collection reference")
      ) {
        userFriendlyError = "Database Error: Could not save message.";
      } else if (
        err.message?.includes("permission-denied") ||
        err.message?.includes("Permissions error")
      ) {
        userFriendlyError = "Database Error: Permission denied.";
      } else if (
        err.message?.includes("Message blocked due to safety settings:")
      ) {
        userFriendlyError = err.message; // Use the specific block reason
      } else if (err instanceof Error) {
        // Handle generic errors
        userFriendlyError = `Error: ${err.message}`;
      }
      setError(userFriendlyError); // Set error state to display in UI
    } finally {
      setIsSending(false); // Ensure sending state is reset
      // scrollToBottom(); // Let the message listener handle scrolling
    }
  };

  // --- UI Rendering ---

  const scrollToBottom = () => {
    setTimeout(() => {
      // Timeout helps ensure layout is complete
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 150); // Slightly longer timeout maybe helps
  };

  // Render Chat List Item
  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chatListItem}
      onPress={() => handleSelectChat(item)}
      onLongPress={() => handleDeleteChat(item.id)}
    >
      <View style={styles.chatItemContent}>
        <Text style={styles.chatItemTitle} numberOfLines={1}>
          {item.title || "Untitled Chat"}
        </Text>
        <Text style={styles.chatItemTimestamp}>
          {item.updatedAt?.toDate()
            ? item.updatedAt.toDate().toLocaleDateString()
            : "..."}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => handleDeleteChat(item.id)} // Allow tap on icon too
        style={styles.deleteIcon}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increase tap area
      >
        <Trash2 size={18} color="#AAAAAA" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // Render Chat Message Item
  const renderMessageItem = ({ item }) => {
    const isUser = item.role === USER_ROLE;
    // Safely access text content
    const textContent = item.parts?.[0]?.text ?? "[empty message]";

    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.aiBubble,
        ]}
      >
        {isUser ? (
          <Text style={styles.messageText} selectable={true}>
            {textContent}
          </Text> // Make user text selectable
        ) : (
          <Markdown style={markdownStyles}>{textContent}</Markdown>
        )}
      </View>
    );
  };

  // --- Main Return ---

  // Handle user not logged in
  if (!user) {
    return (
      <View style={styles.container}>
        {/* Added a container for centering */}
        <View style={styles.centeredMessageContainer}>
          <Text style={styles.errorText}>Please log in to use the chat.</Text>
        </View>
      </View>
    );
  }

  // Render Chat List View
  if (viewMode === "list") {
    console.log("Rendering List View - State:", {
      isLoadingChats,
      hasError: !!error,
      chatCount: chats.length,
    }); // Keep debug log for now
    return (
      <View style={styles.container}>
        <View style={styles.listHeader}>
          <Text style={styles.headerTitle}>AI Chat History</Text>
          <TouchableOpacity
            onPress={handleNewChat}
            style={styles.newChatButton}
          >
            <MessageSquarePlus size={24} color="#BFFF00" />
          </TouchableOpacity>
        </View>

        {/* Conditional rendering using ternary for list view */}
        {isLoadingChats ? (
          <View style={styles.centeredMessageContainer}>
            <ActivityIndicator
              size="large"
              color="#BFFF00"
              style={styles.listLoader} // Keep style if needed
            />
          </View>
        ) : error ? (
          // --- ADDED TEMP BG COLOR FOR ERROR STATE ---
          <View
            style={[
              styles.centeredMessageContainer,
              { backgroundColor: "rgba(255,0,0,0.1)" },
            ]}
          >
            {console.log("Rendering List View - Showing Error Text")}
            <Text style={[styles.errorText, styles.listError]}>{error}</Text>
          </View>
        ) : // --- END TEMP BG COLOR ---
        chats.length === 0 ? (
          // --- ADDED TEMP BG COLOR FOR EMPTY STATE ---
          <View
            style={[
              styles.centeredMessageContainer,
              { backgroundColor: "rgba(0,255,0,0.1)" },
            ]}
          >
            {console.log("Rendering List View - Showing Empty Text")}
            <Text style={styles.emptyListText}>
              No chats yet. Start a new conversation!
            </Text>
          </View>
        ) : (
          // --- END TEMP BG COLOR ---
          // Using React.Fragment for the log doesn't add an extra View
          <React.Fragment>
            {console.log("Rendering List View - Showing FlatList")}
            <FlatList
              data={chats}
              renderItem={renderChatItem}
              keyExtractor={(item) => item.id}
              style={styles.chatList}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </React.Fragment>
        )}
      </View>
    );
  }

  // Render Chat View
  return (
    <KeyboardAvoidingView
      style={styles.container} // KAV takes full screen space
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 + 60 : 60} // Keep the offset! Adjust '60' as needed
    >
      {/* Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity
          onPress={() => setViewMode("list")}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.chatTitle} numberOfLines={1}>
          {currentChatTitle}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* --- NEW: Wrapper for flexible content --- */}
      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={(item, index) =>
            item.id || `msg-${index}-${item.timestamp?.toString()}`
          }
          style={styles.messagesList} // No flex: 1 here
          contentContainerStyle={styles.messagesContainer} // Has flexGrow: 1
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
          ListEmptyComponent={
            !isLoading ? (
              // Make this empty component container flexible too
              <View style={styles.centeredMessageContainer}>
                <Text style={styles.emptyListText}>
                  Send a message to start chatting!
                </Text>
              </View>
            ) : null
          }
        />

        {/* Status Area (Loading/Error) - Remains below list, inside flexible wrapper */}
        <View style={styles.statusContainer}>
          {isLoading && !isSending ? (
            <ActivityIndicator
              size="small"
              color="#BFFF00"
              style={styles.chatLoader}
            />
          ) : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
        {/* --- End flexible content wrapper --- */}
      </View>

      {/* Input Area - Now follows the flexible content wrapper */}
      <View style={styles.inputContainer}>
        {console.log("Rendering Chat View - Input Area")}
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask Dr. Plant AI..."
          placeholderTextColor="#888888"
          multiline
          editable={!isSending} // Disable input while sending
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
    </KeyboardAvoidingView>
  );
}; // End of LLM component

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  centeredMessageContainer: {
    // For centering messages/loaders/empty text
    flex: 1, // Make sure this takes up space if rendered
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#222222",
  },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "bold" },
  newChatButton: { padding: 5 },
  chatList: { flex: 1, paddingHorizontal: 10, marginTop: 10 },
  chatListItem: {
    backgroundColor: "#1A1A1A",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatItemContent: { flex: 1, marginRight: 10 },
  chatItemTitle: { color: "#E0E0E0", fontSize: 16, fontWeight: "500" },
  chatItemTimestamp: { color: "#888888", fontSize: 12, marginTop: 4 },
  deleteIcon: { padding: 5 },
  emptyListText: {
    color: "#AAAAAA",
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
  },
  listLoader: {
    /* Centered by container */
  },
  listError: {
    /* Centered by container */
  },

  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#222222",
    backgroundColor: "#101010",
  },
  backButton: { padding: 5, marginRight: 10 },
  chatTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  messagesList: {
    // Ensure NO flex: 1 here
  },
  messagesContainer: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexGrow: 1, // Important! This allows empty component to fill space
  },
  messageBubble: {
    maxWidth: "85%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    marginBottom: 10,
  },
  userBubble: {
    backgroundColor: "#BFFF00",
    alignSelf: "flex-end",
    borderBottomRightRadius: 5,
  },
  aiBubble: {
    backgroundColor: "#2A2A2A",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 5,
  },
  messageText: { color: "#000000", fontSize: 15 },

  statusContainer: {
    minHeight: 25,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2,
    // This is now inside the flexible wrapper, below the list
  },
  chatLoader: {
    /* Centered by statusContainer */
  },
  errorText: {
    color: "#FF6B6B",
    textAlign: "center",
    paddingHorizontal: 15,
    fontSize: 14,
  },

  inputContainer: {
    // This is the fixed bar at the bottom
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#222222",
    backgroundColor: "#000000",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    color: "#FFFFFF",
    fontSize: 15,
    marginRight: 10,
    textAlignVertical: "center",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#BFFF00",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: { backgroundColor: "#5A6A00" },
});

// --- Markdown Styles ---
const markdownStyles = StyleSheet.create({
  // Use StyleSheet.create for markdown styles too
  body: { color: "#E0E0E0", fontSize: 15 },
  heading1: {
    color: "#FFFFFF",
    fontWeight: "bold",
    marginVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#444",
    paddingBottom: 5,
  },
  heading2: { color: "#FFFFFF", fontWeight: "bold", marginVertical: 8 },
  strong: { fontWeight: "bold", color: "#FFFFFF" },
  em: { fontStyle: "italic" },
  link: { color: "#77BFFF", textDecorationLine: "underline" },
  bullet_list: { marginVertical: 10 },
  ordered_list: { marginVertical: 10 },
  list_item: {
    marginVertical: 5,
    flexDirection: "row",
    alignItems: "flex-start",
  }, // Ensure bullet/number aligns
  bullet_list_icon: { marginRight: 8, color: "#BFFF00", marginTop: 5 }, // Style the bullet point
  ordered_list_icon: { marginRight: 8, color: "#BFFF00", marginTop: 5 }, // Style the number
  code_inline: {
    backgroundColor: "#333333",
    color: "#FFD700",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 14,
  },
  code_block: {
    backgroundColor: "#1A1A1A",
    color: "#E0E0E0",
    padding: 12,
    borderRadius: 5,
    marginVertical: 10,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 14,
  },
  fence: {
    backgroundColor: "#1A1A1A",
    color: "#E0E0E0",
    padding: 12,
    borderRadius: 5,
    marginVertical: 10,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 14,
  },
  table: {
    borderWidth: 1,
    borderColor: "#555",
    borderRadius: 3,
    marginVertical: 10,
  },
  thead: {}, // Optional thead styling
  tbody: {}, // Optional tbody styling
  th: {
    backgroundColor: "#333",
    padding: 8,
    color: "#FFF",
    fontWeight: "bold",
    textAlign: "left",
  },
  tr: { borderBottomWidth: 1, borderColor: "#444", flexDirection: "row" },
  td: { padding: 8, textAlign: "left", flex: 1 }, // Allow table cells to flex
  blockquote: {
    backgroundColor: "#222",
    borderLeftColor: "#BFFF00",
    borderLeftWidth: 4,
    padding: 10,
    marginVertical: 10,
  },
  hr: { backgroundColor: "#555", height: 1, marginVertical: 15 },
});

export default LLM;
